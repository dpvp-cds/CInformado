import { db } from '../lib/firebaseAdmin.js';
import { Resend } from 'resend';

// Esta función es el controlador (handler) de la API para guardar el consentimiento informado.
export default async function handler(request, response) {
    // 1. Verificación del método de solicitud. Solo se permite POST para guardar datos.
    if (request.method !== 'POST') {
        return response.status(405).json({ message: 'Método no permitido. Solo se acepta POST.' });
    }

    let data;
    try {
        // 2. Intentar parsear el cuerpo de la solicitud (que debe ser un JSON).
        data = request.body;
    } catch (e) {
        // Error si el cuerpo de la solicitud no es un JSON válido.
        return response.status(400).json({ message: 'Cuerpo de solicitud inválido (debe ser JSON).' });
    }

    const { demograficos, consentimiento, firmaDigital } = data;

    // 3. Validación de datos críticos (lo que estaba fallando en el envío anterior).
    // Se verifica la existencia de la sección de demográficos, el email, y la firma digital.
    if (!demograficos || !demograficos.nombre || !demograficos.email || !firmaDigital) {
        // Si falta alguno, se detiene el proceso y se envía un error específico.
        console.error("Servidor: Fallo de validación. Faltan datos críticos.");
        return response.status(400).json({ 
            message: 'Faltan datos críticos (nombre, email o firma).',
            receivedData: {
                hasDemograficos: !!demograficos,
                hasNombre: demograficos ? !!demograficos.nombre : false,
                hasEmail: demograficos ? !!demograficos.email : false,
                hasFirma: !!firmaDigital
            }
        });
    }

    // 4. Preparar el objeto final para guardar en Firestore.
    const consentData = {
        ...data,
        fecha: new Date().toISOString(), // Añadir una marca de tiempo estandarizada.
        estado: 'Firmado' // Estado inicial del documento.
    };
    
    let docRef;
    try {
        // 5. Guardar el documento en la colección 'consents' de Firestore.
        // Usamos una colección separada para diferenciar los Consentimientos de los Reportes (reports).
        docRef = await db.collection('consents').add(consentData);
        console.log(`Servidor: Consentimiento guardado con ID: ${docRef.id}`);

        // 6. Configuración y envío del correo electrónico de confirmación (usando Resend).
        const resendApiKey = process.env.RESEND2_API_KEY;
        if (!resendApiKey) {
            console.warn("Servidor: RESEND2_API_KEY no definida. Se saltará el envío de correo.");
        } else {
            const resend = new Resend(resendApiKey);

            // Contenido del email para el paciente.
            const emailPaciente = {
              from: 'CInformado <noreply@tudominio.com>', // Reemplaza tudominio.com
              to: demograficos.email, // Correo del paciente
              subject: `Confirmación de Consentimiento - Caminos del Ser`,
              html: `
                <h1>¡Gracias por tu Consentimiento, ${demograficos.nombre}!</h1>
                <p>Hemos recibido y archivado de forma segura tu Consentimiento Informado Digital.</p>
                <p>Tu código de referencia es: <strong>${docRef.id}</strong></p>
                <p>Esto marca el inicio oficial de nuestro proceso de orientación. Por favor, mantente atento a las instrucciones para nuestra primera sesión.</p>
                <br><p>Atentamente,<br>CInformado</p>
              `,
            };

            // Contenido del email para el terapeuta (Tú).
            const emailTerapeuta = {
                from: 'Sistema CInformado <noreply@tudominio.com>', // Reemplaza tudominio.com
                to: 'dpvp.cds@emcotic.com', // Tu correo para notificaciones.
                subject: `NUEVO CONSENTIMIENTO - ${demograficos.nombre}`,
                html: `<p>Un nuevo paciente, <strong>${demograficos.nombre}</strong> (${demograficos.email}), ha firmado el consentimiento informado digital. ID: ${docRef.id}</p>`,
            };
            
            // Enviar ambos correos simultáneamente.
            await Promise.all([
                resend.emails.send(emailPaciente),
                resend.emails.send(emailTerapeuta)
            ]);
            
            console.log("Servidor: Correos de confirmación enviados.");
        }

        // 7. Respuesta de éxito final.
        response.status(200).json({ message: 'Consentimiento guardado y procesado exitosamente', id: docRef.id });

    } catch (error) {
        // 8. Manejo de cualquier error de Firebase o Resend.
        console.error("Servidor: Error interno al procesar el consentimiento:", error);
        response.status(500).json({ message: 'Error interno del servidor al guardar el documento o enviar el correo.', detail: error.message });
    }
}
