import { db } from '../lib/firebaseAdmin.js';
import { Resend } from 'resend';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { Buffer } from 'buffer';

// Función para crear el PDF del consentimiento
async function crearPDFConsentimiento(datos) {
    const { demograficos, firmaDigital, fecha } = datos;
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    let y = height - 50;

    page.drawText('Consentimiento Informado Digital - Caminos del Ser', { x: 50, y, font: boldFont, size: 16, color: rgb(0, 0.2, 0.4) });
    y -= 25;

    const fechaFirma = new Date(fecha).toLocaleString('es-CO', { dateStyle: 'full', timeStyle: 'short' });
    page.drawText(`Firmado el: ${fechaFirma}`, { x: 50, y, font, size: 10 });
    y -= 40;

    const esMenor = parseInt(demograficos.edad, 10) < 18;
    const textoIntro = esMenor 
        ? `Yo, ${demograficos.nombreAcudiente}, con documento ${demograficos.documentoAcudiente}, como ${demograficos.tipoAcudiente} de ${demograficos.nombre} (doc ${demograficos.documentoIdentidad}), declaro que:`
        : `Yo, ${demograficos.nombre}, con documento ${demograficos.documentoIdentidad}, declaro que:`;

    page.drawText(textoIntro, { x: 50, y, font, size: 11, lineHeight: 15, maxWidth: width - 100 });
    y -= 100;

    page.drawText('He leído, comprendido y aceptado todos los términos presentados en el formulario digital.', { x: 50, y, font: boldFont, size: 11 });
    y -= 40;

    page.drawText('Firma del Paciente/Acudiente:', { x: 50, y, font, size: 11 });
    y -= 120;
    
    try {
        const pngImageBytes = Buffer.from(firmaDigital.split(',')[1], 'base64');
        const pngImage = await pdfDoc.embedPng(pngImageBytes);
        page.drawImage(pngImage, { x: 50, y: y, width: 150, height: 75 });
    } catch (e) {
        page.drawText('[Error al cargar imagen de firma]', { x: 50, y: y, font, size: 10, color: rgb(1, 0, 0) });
    }
    
    page.drawLine({ start: { x: 50, y: y - 5 }, end: { x: 250, y: y - 5 }, thickness: 1, color: rgb(0, 0, 0) });
    
    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
}

// Handler principal de la API
export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ message: 'Método no permitido.' });
    }

    try {
        const data = request.body;
        const { demograficos, firmaDigital } = data;

        if (!demograficos || !demograficos.nombre || !demograficos.email || !firmaDigital) {
            return response.status(400).json({ message: 'Faltan datos críticos.' });
        }

        const dataToSave = { ...data, fecha: new Date().toISOString(), estado: 'Firmado' };
        const docRef = await db.collection('consents').add(dataToSave);
        console.log(`Servidor: Consentimiento guardado con ID: ${docRef.id}`);

        const resendApiKey = process.env.RESEND2_API_KEY;
        if (!resendApiKey) {
            console.warn("Servidor: RESEND2_API_KEY no definida. Se saltará el envío de correos.");
        } else {
            const resend = new Resend(resendApiKey);
            const pdfBuffer = await crearPDFConsentimiento(dataToSave);

            // Correo para el paciente
            const mailToPaciente = {
              from: 'Notificación Consentimiento Informado <caminosdelser@emcotic.com>', // <<< ¡IMPORTANTE: CAMBIA ESTO!
              to: demograficos.email,
              subject: `Copia de tu Consentimiento Informado - Caminos del Ser`,
              html: `<p>Estimado/a ${demograficos.nombre},</p><p>Recibes una copia del consentimiento informado para la atención psicológica con el Psicólogo Jorge Arango Castaño.</p><p>Cualquier inquietud puedes hacerla al correo caminosdelser@emotic.com o al WhatsApp +573233796547.</p><p>Adjunto, encontrarás el PDF con tu firma.</p>`,
              attachments: [{ filename: `Consentimiento-${docRef.id}.pdf`, content: Buffer.from(pdfBuffer) }],
            };

            // Correo para el terapeuta
            const mailToTerapeuta = {
              from: 'Notificación Consentimiento Informado <caminosdelser@emcotic.com>', // <<< ¡IMPORTANTE: CAMBIA ESTO!
              to: 'caminosdelser@emcotic.com',
              subject: `Nuevo Consentimiento Firmado: ${demograficos.nombre}`,
              html: `<p>Has recibido el consentimiento informado firmado del paciente <strong>${demograficos.nombre}</strong>.</p><p>El documento PDF se encuentra adjunto.</p>`,
              attachments: [{ filename: `Consentimiento-${docRef.id}.pdf`, content: Buffer.from(pdfBuffer) }],
            };
            
            await Promise.all([
                resend.emails.send(mailToPaciente),
                resend.emails.send(mailToTerapeuta)
            ]);
            console.log("Servidor: Correos de confirmación enviados.");
        }

        response.status(200).json({ message: 'Consentimiento procesado exitosamente', id: docRef.id });

    } catch (error) {
        console.error("Error catastrófico en save-consent:", error);
        response.status(500).json({ message: 'Error interno del servidor.', detail: error.message });
    }
}
