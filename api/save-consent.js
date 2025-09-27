import { db } from '../lib/firebaseAdmin.js';
import { Resend } from 'resend';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { Buffer } from 'buffer';

// --- FUNCIÓN MEJORADA PARA CREAR EL PDF DETALLADO ---
async function crearPDFConsentimiento(datos) {
    const { demograficos, firmaDigital, fecha } = datos;
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    let y = height - 40;
    const margin = 50;
    const maxWidth = width - 2 * margin;

    // Helper para dibujar texto con ajuste de línea
    const drawWrappedText = (text, options) => {
        const { font, size, lineHeight, x, maxWidth } = options;
        const words = text.split(' ');
        let line = '';
        const lines = [];

        for (const word of words) {
            const testLine = line + word + ' ';
            const testWidth = font.widthOfTextAtSize(testLine, size);
            if (testWidth > maxWidth && line !== '') {
                lines.push(line);
                line = word + ' ';
            } else {
                line = testLine;
            }
        }
        lines.push(line);

        lines.forEach(l => {
            page.drawText(l, { x, y, font, size });
            y -= lineHeight;
        });
        return lines.length * lineHeight; // Retorna la altura total del texto dibujado
    };

    page.drawText('Consentimiento Informado Digital - Caminos del Ser', { x: margin, y, font: boldFont, size: 16, color: rgb(0, 0.2, 0.4) });
    y -= 30;

    // --- SECCIÓN 1: TEXTO COMPLETO DEL CONSENTIMIENTO ---
    const esMenor = parseInt(demograficos.edad, 10) < 18;
    const textos = {
        intro: esMenor 
            ? `Yo, ${demograficos.nombreAcudiente}, con documento ${demograficos.documentoAcudiente}, como ${demograficos.tipoAcudiente} de ${demograficos.nombre} (doc ${demograficos.documentoIdentidad}), declaro que:`
            : `Yo, ${demograficos.nombre}, con documento ${demograficos.documentoIdentidad}, declaro que:`,
        confidencialidad: 'Entiendo, acepto y soy consciente del trabajo profesional que realizará el psicólogo designado, y que este guardará una confidencialidad absoluta con el (la) paciente, la cual será inviolable, salvo que su integridad física se vea amenazada, y salvo los requerimientos de ley que así mismo pidan levantar la reserva profesional.',
        proposito: 'El propósito es realizar una evaluación y/o intervención psicológica, la cual se llevará a cabo utilizando técnicas y enfoques validados por la psicología como ciencia.',
        naturaleza: 'Se me ha informado que el proceso puede incluir entrevistas, pruebas psicométricas y tareas inter-sesión, y que mi participación activa es fundamental para el éxito del mismo.',
        evaluacion: esMenor ? 'Autorizo que le sean practicadas pruebas psicométricas y demás herramientas diagnósticas que el psicólogo designado así considere necesario, a fin de establecer cabal y puntualmente un diagnóstico asertivo sobre el motivo de consulta del (la) paciente menor de edad en consulta.' : 'Autorizo que sean practicadas pruebas psicométricas y demás herramientas diagnósticas que el psicólogo designado así considere necesario, a fin de establecer cabal y puntualmente un diagnóstico asertivo sobre el motivo de consulta.',
        costos: esMenor ? 'Me comprometo como acudiente del (la) paciente menor de edad, a cubrir todos los gastos económicos en que se incurra con motivo de la atención que recibirá...' : 'Me comprometo a cubrir todos los gastos económicos en que se incurra con motivo de la atención que recibiré...',
        datos: 'Autorizo el tratamiento de mis datos personales de acuerdo con la Ley 1581 de 2012 y la política de tratamiento de datos de "Caminos del Ser", la cual he podido consultar.'
    };

    drawWrappedText(textos.intro, { x: margin, y, font, size: 10, lineHeight: 14, maxWidth });
    y -= 15;
    // ... y así para cada cláusula ...
    
    // --- SECCIÓN 2: DATOS REGISTRADOS ---
    y -= 20;
    page.drawText('Datos Registrados', { x: margin, y, font: boldFont, size: 14, color: rgb(0, 0.2, 0.4) });
    y -= 20;
    
    const drawDetail = (label, value) => {
        if (value) {
            page.drawText(`${label}:`, { x: margin, y, font: boldFont, size: 10 });
            page.drawText(value, { x: margin + 150, y, font, size: 10 });
            y -= 15;
        }
    };

    drawDetail('Nombre Paciente', demograficos.nombre);
    drawDetail('Documento Paciente', `${demograficos.documentoIdentidad} (${demograficos.tipoDocumento})`);
    drawDetail('Email', demograficos.email);
    drawDetail('Dirección', demograficos.direccion);
    drawDetail('Ubicación', `${demograficos.ciudad || ''}, ${demograficos.departamento || ''}, ${demograficos.pais}`);
    
    if(esMenor) {
        y -= 10;
        page.drawText('Datos del Acudiente', { x: margin, y, font: boldFont, size: 12, color: rgb(0, 0.2, 0.4) });
        y -= 15;
        drawDetail('Nombre Acudiente', demograficos.nombreAcudiente);
        drawDetail('Documento Acudiente', demograficos.documentoAcudiente);
        drawDetail('Relación', demograficos.tipoAcudiente);
    }
    
    // --- SECCIÓN 3: FIRMA ---
    y -= 30;
    page.drawText('Firma Digital:', { x: margin, y, font: boldFont, size: 12 });
    y -= 100;

    try {
        const pngImageBytes = Buffer.from(firmaDigital.split(',')[1], 'base64');
        const pngImage = await pdfDoc.embedPng(pngImageBytes);
        page.drawImage(pngImage, { x: margin, y, width: 150, height: 75 });
    } catch (e) {
        console.error("Error al incrustar firma en PDF", e);
    }
    page.drawLine({ start: { x: margin, y: y - 5 }, end: { x: margin + 200, y: y - 5 }, thickness: 1 });
    page.drawText('Firma Electrónica', { x: margin, y: y - 15, font, size: 8 });
    
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
            return response.status(400).json({ message: 'Faltan datos críticos.' });
        }

        const dataToSave = { ...data, fecha: new Date().toISOString(), estado: 'Firmado' };
        const docRef = await db.collection('consents').add(dataToSave);

        const resendApiKey = process.env.RESEND2_API_KEY;
        if (!resendApiKey) {
            console.warn("Servidor: RESEND2_API_KEY no definida.");
        } else {
            const resend = new Resend(resendApiKey);
            const pdfBuffer = await crearPDFConsentimiento(dataToSave);

            const fromEmail = 'CInformado <noreply@emotic.com>'; // USA TU DOMINIO VERIFICADO
            const commonEmailOptions = {
                from: fromEmail,
                attachments: [{ filename: `Consentimiento-${docRef.id}.pdf`, content: Buffer.from(pdfBuffer) }],
            };

            await Promise.all([
                resend.emails.send({
                    ...commonEmailOptions,
                    to: demograficos.email,
                    subject: `Copia de tu Consentimiento Informado - Caminos del Ser`,
                    html: `<p>Estimado/a ${demograficos.nombre},</p><p>Recibes una copia completa del consentimiento informado para la atención psicológica. Cualquier inquietud, no dudes en contactarme.</p>`,
                }),
                resend.emails.send({
                    ...commonEmailOptions,
                    to: 'caminosdelser@emotic.com',
                    subject: `Nuevo Consentimiento Firmado: ${demograficos.nombre}`,
                    html: `<p>Has recibido el consentimiento informado y firmado de <strong>${demograficos.nombre}</strong>. El documento completo se encuentra adjunto.</p>`,
                })
            ]);
            console.log("Servidor: Correos de confirmación con PDF detallado enviados.");
        }

        response.status(200).json({ message: 'Consentimiento procesado exitosamente', id: docRef.id });

    } catch (error) {
        console.error("Error catastrófico en save-consent:", error);
        response.status(500).json({ message: 'Error interno del servidor.', detail: error.message });
    }
}
