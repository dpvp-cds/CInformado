import { db } from '../lib/firebaseAdmin.js';
import { Resend } from 'resend';
import { Buffer } from 'buffer';

// Helper para formatear fechas al estándar iCalendar (UTC)
function formatICSDate(dateStr, timeStr) {
    // Asumimos zona horaria de Colombia (UTC-5)
    const localDate = new Date(`${dateStr}T${timeStr}:00-05:00`);
    // Duración ajustada a 1 hora y 30 minutos (90 minutos)
    const endLocalDate = new Date(localDate.getTime() + 90 * 60 * 1000); 

    const toUTC = (d) => {
        return d.getUTCFullYear() +
               String(d.getUTCMonth() + 1).padStart(2, '0') +
               String(d.getUTCDate()).padStart(2, '0') + 'T' +
               String(d.getUTCHours()).padStart(2, '0') +
               String(d.getUTCMinutes()).padStart(2, '0') +
               String(d.getUTCSeconds()).padStart(2, '0') + 'Z';
    };

    return { start: toUTC(localDate), end: toUTC(endLocalDate), stamp: toUTC(new Date()) };
}

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ message: 'Método no permitido. Solo POST.' });
    }

    try {
        const { pacienteId, emailPaciente, nombrePaciente, fecha, hora, enlaceMeet } = request.body;

        if (!pacienteId || !emailPaciente || !fecha || !hora) {
            return response.status(400).json({ message: 'Faltan datos críticos para agendar la cita.' });
        }

        // 1. Guardar la cita y el enlace en la historia clínica (Memoria del sistema)
        await db.collection('historias_clinicas').doc(pacienteId).set({
            proximaCita: { fecha, hora },
            enlaceMeet: enlaceMeet || ''
        }, { merge: true });

        // 2. Lógica de Correos y Calendario
        const resendApiKey = process.env.RESEND2_API_KEY;
        if (resendApiKey) {
            const resend = new Resend(resendApiKey);

            // Generar fechas en formato ICS
            const icsDates = formatICSDate(fecha, hora);
            
            // Separar ubicación física de enlaces virtuales
            const safeMeet = enlaceMeet ? enlaceMeet : '';
            const meetDescription = enlaceMeet ? `Para ingresar a la videollamada, haz clic en el siguiente enlace de Google Meet:\\n${safeMeet}` : 'La sesión será presencial o el terapeuta te enviará el enlace pronto.';
            const locationStr = enlaceMeet ? 'Videollamada (Google Meet)' : 'Consultorio Caminos del Ser';
            const extraUrlStr = enlaceMeet ? `\nURL:${safeMeet}\nX-GOOGLE-CONFERENCE:${safeMeet}` : '';

            // Construir el archivo iCalendar nativo (.ics) CON INVITADOS Y ORGANIZADOR
            const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//CInformado//Citas//ES
CALSCALE:GREGORIAN
METHOD:REQUEST
BEGIN:VEVENT
UID:cita-${Date.now()}@caminosdelser.co
DTSTAMP:${icsDates.stamp}
DTSTART:${icsDates.start}
DTEND:${icsDates.end}
ORGANIZER;CN="Jorge Arango Castaño":mailto:caminosdelser@emcotic.com
ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN="${nombrePaciente}":mailto:${emailPaciente}
ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=FALSE;CN="Jorge Arango Castaño":mailto:caminosdelser@emcotic.com
SUMMARY:Sesión de Psicología - ${nombrePaciente}
DESCRIPTION:Tu sesión psicológica ha sido agendada.\\n\\n${meetDescription}\\n\\nTe esperamos.
LOCATION:${locationStr}${extraUrlStr}
STATUS:CONFIRMED
SEQUENCE:0
END:VEVENT
END:VCALENDAR`;

            const icsBuffer = Buffer.from(icsContent, 'utf-8');
            
            // FECHA BONITA CORREGIDA: Forzamos estrictamente la zona horaria de Colombia
            const localDateForText = new Date(`${fecha}T${hora}:00-05:00`);
            const fechaBonita = localDateForText.toLocaleString('es-CO', { 
                timeZone: 'America/Bogota',
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric', 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: true
            });
            const primerNombre = nombrePaciente.split(' ')[0];

            // A. Enviar correo al Paciente
            await resend.emails.send({
                from: 'Citas Caminos del Ser <caminosdelser@emcotic.com>',
                to: emailPaciente,
                subject: `📅 Confirmación de Sesión - ${fechaBonita}`,
                html: `
                    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eaeaea; border-radius: 10px; overflow: hidden;">
                        <div style="background-color: #003366; padding: 20px; text-align: center;">
                            <h2 style="color: white; margin: 0;">Confirmación de Cita</h2>
                        </div>
                        <div style="padding: 30px;">
                            <h3 style="color: #003366;">¡Hola ${primerNombre}!</h3>
                            <p>Tu próxima sesión de acompañamiento psicológico con <strong>Jorge Arango Castaño</strong> ha sido agendada exitosamente.</p>
                            <div style="background-color: #f4f6f8; border-left: 4px solid #003366; padding: 15px; margin: 20px 0;">
                                <p style="margin: 0 0 10px 0;"><strong>🗓️ Fecha y Hora:</strong><br>${fechaBonita}</p>
                                <p style="margin: 0;"><strong>💻 Enlace de Conexión:</strong><br><a href="${safeMeet || '#'}" target="_blank" style="color: #003366; text-decoration: underline;">${safeMeet || 'Presencial'}</a></p>
                            </div>
                            <p style="font-size: 13px; color: #666;"><i>💡 Sugerencia: En la parte superior de este correo o en los archivos adjuntos, encontrarás la opción para <strong>"Añadir a tu Calendario"</strong> (Google Calendar, Outlook, Apple). Haz clic allí para que te recordemos automáticamente.</i></p>
                        </div>
                    </div>
                `,
                attachments: [{ filename: 'invitacion-sesion.ics', content: icsBuffer }]
            });

            // B. Enviar copia al Psicólogo
            await resend.emails.send({
                from: 'Sistema de Citas <caminosdelser@emcotic.com>',
                to: 'caminosdelser@emcotic.com',
                subject: `NUEVA CITA AGENDADA: ${primerNombre}`,
                html: `
                    <div style="font-family: Arial, sans-serif; color: #333;">
                        <h2 style="color: #003366;">Cita Agendada Exitosamente</h2>
                        <p>Has programado una nueva sesión en el sistema.</p>
                        <ul>
                            <li><strong>Paciente:</strong> ${nombrePaciente}</li>
                            <li><strong>Fecha:</strong> ${fechaBonita}</li>
                            <li><strong>Meet:</strong> <a href="${safeMeet || '#'}">${safeMeet || 'Presencial'}</a></li>
                        </ul>
                        <p>El archivo de calendario está adjunto para que lo agregues a tu agenda personal. <strong>Verás al paciente en tu lista de invitados.</strong></p>
                    </div>
                `,
                attachments: [{ filename: 'invitacion-sesion.ics', content: icsBuffer }]
            });
        }

        return response.status(200).json({ message: 'Cita agendada y correos enviados.' });

    } catch (error) {
        console.error("Error al agendar cita:", error);
        return response.status(500).json({ message: 'Error interno del servidor.', detail: error.message });
    }
}
