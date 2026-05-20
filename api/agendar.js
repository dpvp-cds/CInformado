import { db } from '../lib/firebaseAdmin.js';
import { Resend } from 'resend';
import { Buffer } from 'buffer';

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ message: 'Método no permitido. Solo POST.' });
    }

    try {
        const { pacienteId, emailPaciente, nombrePaciente, fecha, hora, enlaceMeet } = request.body;

        if (!pacienteId || !emailPaciente || !fecha || !hora) {
            return response.status(400).json({ message: 'Faltan datos para agendar la cita.' });
        }

        // 1. Guardar la cita y el enlace en la historia clínica del paciente
        await db.collection('historias_clinicas').doc(pacienteId).set({
            proximaCita: { fecha, hora },
            enlaceMeet: enlaceMeet || ''
        }, { merge: true });

        // 2. Lógica de Correos y Calendario (Si hay API Key de Resend)
        const resendApiKey = process.env.RESEND2_API_KEY;
        if (resendApiKey) {
            const resend = new Resend(resendApiKey);

            // Crear fechas para el archivo de calendario (.ics)
            // Asumimos zona horaria de Colombia (-05:00)
            const startDate = new Date(`${fecha}T${hora}:00-05:00`);
            const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // Cita de 1 hora por defecto

            const formatICSDate = (dateObj) => {
                return dateObj.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
            };

            const dtStart = formatICSDate(startDate);
            const dtEnd = formatICSDate(endDate);
            const dtStamp = formatICSDate(new Date());
            const safeMeet = enlaceMeet ? enlaceMeet : 'Por definir';

            // Archivo iCalendar nativo
            const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//CInformado//Citas//ES
CALSCALE:GREGORIAN
METHOD:REQUEST
BEGIN:VEVENT
UID:cita-${Date.now()}@caminosdelser.co
DTSTAMP:${dtStamp}
DTSTART:${dtStart}
DTEND:${dtEnd}
SUMMARY:Sesión de Psicología - Jorge Arango
DESCRIPTION:Tu sesión psicológica ha sido confirmada.\\n\\nPara ingresar a la videollamada, haz clic en el siguiente enlace de Google Meet:\\n${safeMeet}\\n\\nTe esperamos.
LOCATION:${safeMeet}
STATUS:CONFIRMED
SEQUENCE:0
ACTION:DISPLAY
END:VEVENT
END:VCALENDAR`;

            const icsBuffer = Buffer.from(icsContent, 'utf-8');
            const fechaBonita = startDate.toLocaleString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

            // Enviar correo al Paciente
            await resend.emails.send({
                from: 'Citas Caminos del Ser <caminosdelser@emcotic.com>',
                to: emailPaciente,
                subject: `📅 Invitación: Sesión Psicológica - ${fechaBonita}`,
                html: `
                    <div style="font-family: Arial, sans-serif; color: #333;">
                        <h2 style="color: #003366;">¡Hola ${nombrePaciente.split(' ')[0]}!</h2>
                        <p>Tu próxima sesión psicológica ha sido agendada exitosamente.</p>
                        <p><strong>Fecha y Hora:</strong> ${fechaBonita}</p>
                        <p><strong>Enlace de Conexión:</strong> <a href="${safeMeet}" target="_blank">${safeMeet}</a></p>
                        <br>
                        <p><i>Nota: En este correo hemos adjuntado un archivo de calendario. Puedes hacer clic en "Añadir al Calendario" arriba o abrir el archivo adjunto para guardarlo en tu agenda.</i></p>
                    </div>
                `,
                attachments: [{ filename: 'invitacion-sesion.ics', content: icsBuffer }]
            });

            // Enviar copia al Psicólogo (Tú)
            await resend.emails.send({
                from: 'Citas Caminos del Ser <caminosdelser@emcotic.com>',
                to: 'caminosdelser@emcotic.com',
                subject: `📅 Cita Agendada: ${nombrePaciente}`,
                html: `<p>Has agendado una nueva sesión con <strong>${nombrePaciente}</strong> para el <strong>${fechaBonita}</strong>.</p>`,
                attachments: [{ filename: 'invitacion-sesion.ics', content: icsBuffer }]
            });
        }

        return response.status(200).json({ message: 'Cita agendada y correos enviados.' });

    } catch (error) {
        console.error("Error al agendar cita:", error);
        return response.status(500).json({ message: 'Error interno del servidor.', detail: error.message });
    }
}
