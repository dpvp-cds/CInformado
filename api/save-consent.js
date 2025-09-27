import { db } from '../lib/firebaseAdmin.js';
import { Resend } from 'resend';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { Buffer } from 'buffer';

// --- FUNCIÓN AUXILIAR PARA CREAR EL PDF ---
async function crearPDFConsentimiento(datos) {
    const { demograficos, firmaDigital } = datos;
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    let y = height - 50;

    // Título
    page.drawText('Consentimiento Informado Digital', { x: 50, y, font: boldFont, size: 18, color: rgb(0, 0.2, 0.4) });
    y -= 30;

    // Información del paciente
    const esMenor = parseInt(demograficos.edad, 10) < 18;
    const textoIntro = esMenor ? 
        `Yo, ${demograficos.nombreAcudiente}, con documento de identidad ${demograficos.documentoAcudiente}, actuando como acudiente en calidad de ${demograficos.tipoAcudiente}, de ${demograficos.nombre}, con documento de identidad ${demograficos.documentoIdentidad}.` :
        `Yo, ${demograficos.nombre}, con documento de identidad ${demograficos.documentoIdentidad}.`;

    page.drawText(textoIntro, { x: 50, y, font, size: 11, lineHeight: 15, maxWidth: width - 100 });
    y -= 60; // Espacio después de la introducción

    page.drawText('Declaro que he sido informado/a y acepto los términos del servicio con el Psicólogo Jorge Arango Castaño.', { x: 50, y, font, size: 11 });
    y -= 40;

    // Firma
    page.drawText('Firma del Paciente/Acudiente:', { x: 50, y, font: boldFont, size: 12 });
    y -= 120;
    
    const pngImageBytes = Buffer.from(firmaDigital.split(',')[1], 'base64');
    const pngImage = await pdfDoc.embedPng(pngImageBytes);
    page.drawImage(pngImage, {
        x: 50,
        y: y,
        width: 150,
        height: 75,
    });

    // Línea de firma
    page.drawLine({
        start: { x: 50, y: y - 5 },
        end: { x: 200, y: y - 5 },
        thickness: 1,
        color: rgb(0, 0, 0),
    });
    
    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
}


// --- HANDLER PRINCIPAL DE LA API ---
export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ message: 'Método no permitido.' });
    }

    try {
        const data = request.body;
        const { demograficos, firmaDigital } = data;

        if (!demograficos || !demograficos.nombre || !demograficos.email || !firmaDigital) {
            console.error("Servidor: Fallo de validación. Faltan datos críticos.", { hasDemograficos: !!demograficos, hasEmail: demograficos ? !!demograficos.email : false, hasFirma: !!firmaDigital });
            return response.status(400).json({ message: 'Faltan datos críticos (nombre, email o firma).' });
        }

        const consentData = { ...data, fecha: new Date().toISOString(), estado: 'Firmado' };
        const docRef = await db.collection('consents').add(consentData);
        console.log(`Servidor: Consentimiento guardado con ID: ${docRef.id}`);

        // --- LÓGICA DE CORREO MEJORADA ---
        const resendApiKey = process.env.RESEND2_API_KEY;
        if (!resendApiKey) {
            console.warn("Servidor: RESEND2_API_KEY no definida. Se saltará el envío de correos.");
        } else {
            console.log("Servidor: Clave de Resend encontrada. Procediendo a enviar correos.");
            const resend = new Resend(resendApiKey);
            
            // 1. Crear el PDF
            const pdfBuffer = await crearPDFConsentimiento(data);

            // 2. Enviar correo al paciente
            const mailToPaciente = await resend.emails.send({
              from: 'CInformado <tucorreo@tudominioverificado.com>', // IMPORTANTE: Cambiar esto
              to: demograficos.email,
              subject: 'Copia de tu Consentimiento Informado - Caminos del Ser',
              html: `<p>Estimado/a ${demograficos.nombre},</p><p>Recibes una copia del consentimiento informado para la atención psicológica con el Psicólogo Jorge Arango Castaño.</p><p>Cualquier inquietud puedes hacerla al correo caminosdelser@emotic.com o al WhatsApp +573233796547.</p><p>Adjunto, encontrarás el PDF con la información del consentimiento.</p>`,
              attachments: [{
                  filename: `Consentimiento-${demograficos.nombre}.pdf`,
                  content: Buffer.from(pdfBuffer),
              }],
            });
            console.log("Respuesta de Resend (paciente):", mailToPaciente);


            // 3. Enviar correo al terapeuta
            const mailToTerapeuta = await resend.emails.send({
              from: 'Notificación CInformado <tucorreo@tudominioverificado.com>', // IMPORTANTE: Cambiar esto
              to: 'caminosdelser@emotic.com',
              subject: `Nuevo Consentimiento Firmado: ${demograficos.nombre}`,
              html: `<p>Has recibido el consentimiento informado firmado del paciente <strong>${demograficos.nombre}</strong>.</p><p>El documento completo se encuentra adjunto.</p>`,
              attachments: [{
                  filename: `Consentimiento-${demograficos.nombre}.pdf`,
                  content: Buffer.from(pdfBuffer),
              }],
            });
            console.log("Respuesta de Resend (terapeuta):", mailToTerapeuta);
            
            console.log("Servidor: Correos de confirmación procesados.");
        }

        response.status(200).json({ message: 'Consentimiento procesado exitosamente', id: docRef.id });

    } catch (error) {
        console.error("Servidor: Error catastrófico en save-consent:", error);
        response.status(500).json({ message: 'Error interno del servidor.', detail: error.message });
    }
}
