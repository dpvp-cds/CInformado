import { db } from '../lib/firebaseAdmin.js';
import { Resend } from 'resend';
import { Buffer } from 'buffer';

// Helper para formatear fechas al estándar iCalendar (UTC)
function formatICSDate(dateStr, timeStr) {
    const localDate = new Date(`${dateStr}T${timeStr}:00-05:00`);
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
    
    // =======================================================
    // BLOQUE GET: LECTURA PARA EL CALENDARIO 
    // =======================================================
    if (request.method === 'GET') {
        try {
            const patientsMap = {};
            
            const [indivSnap, parejaSnap, histSnap] = await Promise.all([
                db.collection('consents').get(),
                db.collection('consents_parejas').get(),
                db.collection('historias_clinicas').get()
            ]);

            indivSnap.forEach(doc => {
                const data = doc.data();
                patientsMap[doc.id] = {
                    nombre: data.demograficos?.nombreCompleto || data.demograficos?.nombre || 'Paciente',
                    email: data.demograficos?.email || ''
                };
            });

            parejaSnap.forEach(doc => {
                const data = doc.data();
                const n1 = data.paciente1?.nombreCompleto1 || data.paciente1?.nombre || 'P1';
                const n2 = data.paciente2?.nombreCompleto2 || data.paciente2?.nombre || 'P2';
                patientsMap[doc.id] = {
                    nombre: `${n1.split(' ')[0]} y ${n2.split(' ')[0]}`,
                    email: data.paciente1?.email1 || data.paciente1?.email || ''
                };
            });

            const eventosCalendario = [];

            histSnap.forEach(doc => {
                const data = doc.data();
                const pacienteId = doc.id;
                const infoPaciente = patientsMap[pacienteId] || { nombre: 'Paciente Sin Nombre', email: '' };

                // A. Extraer la PRÓXIMA CITA
                if (data.proximaCita && data.proximaCita.fecha && data.proximaCita.hora) {
                    const startDate = new Date(`${data.proximaCita.fecha}T${data.proximaCita.hora}:00-05:00`);
                    const endDate = new Date(startDate.getTime() + 90 * 60 * 1000); 

                    eventosCalendario.push({
                        id: `futura-${pacienteId}`,
                        pacienteId: pacienteId,
                        title: `🗓️ ${infoPaciente.nombre}`,
                        start: startDate.toISOString(),
                        end: endDate.toISOString(),
                        backgroundColor: '#4f46e5',
                        borderColor: '#4338ca',
                        extendedProps: { 
                            tipo: 'Futura', 
                            meet: data.enlaceMeet || '',
                            email: infoPaciente.email 
                        }
                    });
                }

                // B. Extraer las SESIONES PASADAS
                if (data.evoluciones && Array.isArray(data.evoluciones)) {
                    data.evoluciones.forEach((evo, index) => {
                        if (evo.fecha) {
                            eventosCalendario.push({
                                id: `pasada-${pacienteId}-${index}`,
                                pacienteId: pacienteId,
                                title: `✅ ${infoPaciente.nombre}`,
                                start: evo.fecha,
                                allDay: true,
                                backgroundColor: evo.pagado ? '#10b981' : '#f59e0b',
                                borderColor: evo.pagado ? '#059669' : '#d97706',
                                extendedProps: { tipo: 'Pasada', pagado: evo.pagado, valor: evo.valor || 0 }
                            });
                        }
                    });
                }
            });

            return response.status(200).json(eventosCalendario);

        } catch (error) {
            console.error("Error al obtener citas:", error);
            return response.status(500).json({ message: 'Error interno del servidor al cargar el calendario.' });
        }
    }

    // =======================================================
    // BLOQUE POST: MOTOR DE AGENDAMIENTO
    // =======================================================
    else if (request.method === 'POST') {
        try {
            const { pacienteId, emailPaciente, nombrePaciente, fecha, hora, enlaceMeet } = request.body;

            if (!pacienteId || !emailPaciente || !fecha || !hora) {
                return response.status(400).json({ message: 'Faltan datos críticos para agendar la cita.' });
            }

            await db.collection('historias_clinicas').doc(pacienteId).set({
                proximaCita: { fecha, hora },
                enlaceMeet: enlaceMeet || ''
            }, { merge: true });

            const resendApiKey = process.env.RESEND2_API_KEY;
            if (resendApiKey) {
                const resend = new Resend(resendApiKey);

                const icsDates = formatICSDate(fecha, hora);
                const safeMeet = enlaceMeet ? enlaceMeet : '';
                const meetDescription = enlaceMeet ? `Para ingresar a la videollamada, haz clic en el siguiente enlace de Google Meet:\\n${safeMeet}` : 'La sesión será presencial o el terapeuta te enviará el enlace pronto.';
                const locationStr = enlaceMeet ? 'Videollamada (Google Meet)' : 'Consultorio Caminos del Ser';
                const extraUrlStr = enlaceMeet ? `\nURL:${safeMeet}\nX-GOOGLE-CONFERENCE:${safeMeet}` : '';

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
ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=FALSE;CN="Jorge Arango (CUC)":mailto:jarango5@cuc.edu.co
SUMMARY:Sesión de Psicología - ${nombrePaciente}
DESCRIPTION:Tu sesión psicológica ha sido agendada.\\n\\n${meetDescription}\\n\\nTe esperamos.
LOCATION:${locationStr}${extraUrlStr}
STATUS:CONFIRMED
SEQUENCE:0
END:VEVENT
END:VCALENDAR`;

                const icsBuffer = Buffer.from(icsContent, 'utf-8');
                
                const localDateForText = new Date(`${fecha}T${hora}:00-05:00`);
                const fechaBonita = localDateForText.toLocaleString('es-CO', { 
                    timeZone: 'America/Bogota', weekday: 'long', year: 'numeric', month: 'long', 
                    day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true 
                });
                const primerNombre = nombrePaciente.split(' ')[0];

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

            await resend.emails.send({
                from: 'Sistema de Citas <caminosdelser@emcotic.com>',
                to: ['caminosdelser@emcotic.com', 'jarango5@cuc.edu.co'],
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
            return response.status(500).json({ message: 'Error interno del servidor al agendar.', detail: error.message });
        }
    } 

    // =======================================================
    // BLOQUE DELETE: CANCELACIÓN DE CITAS
    // =======================================================
    else if (request.method === 'DELETE') {
        try {
            const { pacienteId, enviarCorreo, emailPaciente, nombrePaciente, fechaStr } = request.body;

            if (!pacienteId) {
                return response.status(400).json({ message: 'Falta el ID del paciente.' });
            }

            // Borrar de la BD asignando null a la proximaCita
            await db.collection('historias_clinicas').doc(pacienteId).set({
                proximaCita: null
            }, { merge: true });

            // Enviar correo de cancelación
            const resendApiKey = process.env.RESEND2_API_KEY;
            if (resendApiKey && enviarCorreo && emailPaciente) {
                const resend = new Resend(resendApiKey);
                const primerNombre = nombrePaciente.split(' ')[0];

                await resend.emails.send({
                    from: 'Citas Caminos del Ser <caminosdelser@emcotic.com>',
                    to: emailPaciente,
                    subject: `❌ Cita Cancelada - Caminos del Ser`,
                    html: `
                        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eaeaea; border-radius: 10px; overflow: hidden;">
                            <div style="background-color: #e11d48; padding: 20px; text-align: center;">
                                <h2 style="color: white; margin: 0;">Cita Cancelada</h2>
                            </div>
                            <div style="padding: 30px;">
                                <h3 style="color: #e11d48;">Hola ${primerNombre},</h3>
                                <p>Te informamos que tu cita de psicología programada para el <strong>${fechaStr}</strong> ha sido cancelada.</p>
                                <p>Si deseas reprogramarla, por favor ponte en contacto con nosotros.</p>
                            </div>
                        </div>
                    `
                });
                
                await resend.emails.send({
                    from: 'Citas Caminos del Ser <caminosdelser@emcotic.com>',
                    to: ['caminosdelser@emcotic.com', 'jarango5@cuc.edu.co'],
                    subject: `❌ CITA CANCELADA: ${primerNombre}`,
                    html: `<p>Se ha cancelado correctamente la cita de <strong>${nombrePaciente}</strong> programada para el ${fechaStr}.</p>`
                });
            }

            return response.status(200).json({ message: 'Cancelación procesada.' });

        } catch (error) {
            console.error("Error al cancelar cita:", error);
            return response.status(500).json({ message: 'Error interno del servidor al cancelar.' });
        }
    }
    
    else {
        return response.status(405).json({ message: 'Método no soportado.' });
    }
}
