import { db } from '../lib/firebaseAdmin.js';
import { Resend } from 'resend';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { Buffer } from 'buffer';

// --- FUNCIÓN FINAL PARA CREAR EL PDF COMPLETO Y DETALLADO ---
async function crearPDFConsentimiento(datos) {
    const { demograficos, firmaDigital, fecha } = datos;
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    let y = height - 40;
    const margin = 50;
    const maxWidth = width - 2 * margin;
    const lineHeight = 14;
    const titleLineHeight = 12;

    const drawWrappedText = (text, options) => {
        const { font, size, color = rgb(0, 0, 0) } = options;
        const words = text.split(' ');
        let line = '';
        y -= 5;

        for (const word of words) {
            const testLine = line + word + ' ';
            const testWidth = font.widthOfTextAtSize(testLine, size);
            if (testWidth > maxWidth && line !== '') {
                page.drawText(line, { x: margin, y, font, size, color });
                y -= lineHeight;
                line = word + ' ';
            } else {
                line = testLine;
            }
        }
        page.drawText(line, { x: margin, y, font, size, color });
        y -= lineHeight;
    };

    page.drawText('Consentimiento Informado Digital - Caminos del Ser', { x: margin, y, font: boldFont, size: 16, color: rgb(0, 0.2, 0.4) });
    y -= 30;

    const esMenor = parseInt(demograficos.edad, 10) < 18;
    const textos = {
        intro: esMenor ? `Yo, ${demograficos.nombreAcudiente}, con documento ${demograficos.documentoAcudiente}, como ${demograficos.tipoAcudiente} de ${demograficos.nombre} (doc ${demograficos.documentoIdentidad}), declaro que:` : `Yo, ${demograficos.nombre}, con documento ${demograficos.documentoIdentidad}, declaro que:`,
        confidencialidad: 'Entiendo, acepto y soy consciente del trabajo profesional que realizará el psicólogo designado, y que este guardará una confidencialidad absoluta con el (la) paciente, la cual será inviolable, salvo que su integridad física se vea amenazada, y salvo los requerimientos de ley que así mismo pidan levantar la reserva profesional.',
        proposito: 'El propósito es realizar una evaluación y/o intervención psicológica, la cual se llevará a cabo utilizando técnicas y enfoques validados por la psicología como ciencia.',
        naturaleza: 'Se me ha informado que el proceso puede incluir entrevistas, pruebas psicométricas y tareas inter-sesión, y que mi participación activa es fundamental para el éxito del mismo.',
        evaluacion: esMenor ? 'Autorizo que le sean practicadas pruebas psicométricas y demás herramientas diagnósticas que el psicólogo designado así considere necesario, a fin de establecer cabal y puntualmente un diagnóstico asertivo sobre el motivo de consulta del (la) paciente menor de edad en consulta.' : 'Autorizo que sean practicadas pruebas psicométricas y demás herramientas diagnósticas que el psicólogo designado así considere necesario, a fin de establecer cabal y puntualmente un diagnóstico asertivo sobre el motivo de consulta.',
        costos: esMenor ? 'Me comprometo como acudiente del (la) paciente menor de edad, a cubrir todos los gastos económicos en que se incurra con motivo de la atención que recibirá, habiendo recibido la información de forma clara y oportuna y habiendo tenido la oportunidad de aceptar o rechazar dichas atenciones psicológicas y los costos asociados.' : 'Me comprometo a cubrir todos los gastos económicos en que se incurra con motivo de la atención que recibiré, habiendo recibido la información de forma clara y oportuna y habiendo tenido la oportunidad de aceptar o rechazar dichas atenciones psicológicas y los costos asociados.',
        datos: 'Autorizo el tratamiento de mis datos personales de acuerdo con la Ley 1581 de 2012 y la política de tratamiento de datos de "Caminos del Ser", la cual he podido consultar.'
    };

    drawWrappedText(textos.intro, { font, size: 10, lineHeight });

    // --- **INICIO DE LA CORRECCIÓN DE ESPACIADO** ---
    y -= 15;
    page.drawText('2.1 Confidencialidad:', { x: margin, y, font: boldFont, size: 10 });
    y -= titleLineHeight;
    drawWrappedText(textos.confidencialidad, { font, size: 10, lineHeight });

    y -= 5;
    page.drawText('2.2 Propósito de la Intervención:', { x: margin, y, font: boldFont, size: 10 });
    y -= titleLineHeight;
    drawWrappedText(textos.proposito, { font, size: 10, lineHeight });

    y -= 5;
    page.drawText('2.3 Naturaleza del Proceso:', { x: margin, y, font: boldFont, size: 10 });
    y -= titleLineHeight;
    drawWrappedText(textos.naturaleza, { font, size: 10, lineHeight });

    y -= 5;
    page.drawText('2.4 Proceso de evaluación:', { x: margin, y, font: boldFont, size: 10 });
    y -= titleLineHeight;
    drawWrappedText(textos.evaluacion, { font, size: 10, lineHeight });

    y -= 5;
    page.drawText('2.5 Costos económicos:', { x: margin, y, font: boldFont, size: 10 });
    y -= titleLineHeight;
    drawWrappedText(textos.costos, { font, size: 10, lineHeight });

    y -= 5;
    page.drawText('2.6 Tratamiento de Datos:', { x: margin, y, font: boldFont, size: 10 });
    y -= titleLineHeight;
    drawWrappedText(textos.datos, { font, size: 10, lineHeight });
    // --- **FIN DE LA CORRECCIÓN DE ESPACIADO** ---

    page = pdfDoc.addPage();
    y = height - 40;

    page.drawText('Datos Registrados', { x: margin, y, font: boldFont, size: 14, color: rgb(0, 0.2, 0.4) });
    y -= 30;
    
    const drawDetail = (label, value) => {
        if (value) {
            page.drawText(`${label}:`, { x: margin, y, font: boldFont, size: 10 });
            page.drawText(String(value), { x: margin + 150, y, font, size: 10 });
            y -= 18;
        }
    };
    drawDetail('Nombre Paciente', demograficos.nombre);
    drawDetail('Documento Paciente', `${demograficos.documentoIdentidad} (${demograficos.tipoDocumento})`);
    drawDetail('Fecha Nacimiento', demograficos.fechaNacimiento);
    drawDetail('Edad', demograficos.edad);
    drawDetail('Email', demograficos.email);
    drawDetail('Teléfono', demograficos.telefonoContacto);
    drawDetail('Dirección', demograficos.direccion);
    drawDetail('Ubicación', `${demograficos.ciudad || ''}, ${demograficos.departamento || ''}, ${demograficos.pais}`);
    drawDetail('Contacto Emergencia', `${demograficos.contactoEmergenciaNombre} (${demograficos.contactoEmergenciaTelefono})`);
    
    if(esMenor) {
        y -= 15;
        page.drawText('Datos del Acudiente', { x: margin, y, font: boldFont, size: 12, color: rgb(0, 0.2, 0.4) });
        y -= 20;
        drawDetail('Nombre Acudiente', demograficos.nombreAcudiente);
        drawDetail('Documento Acudiente', demograficos.documentoAcudiente);
        drawDetail('Relación', demograficos.tipoAcudiente);
    }
    
    y -= 30;
    page.drawText('Firma Digital:', { x: margin, y, font: boldFont, size: 12 });
    y -= 120;
    try {
        const pngImageBytes = Buffer.from(firmaDigital.split(',')[1], 'base64');
        const pngImage = await pdfDoc.embedPng(pngImageBytes);
        page.drawImage(pngImage, { x: margin, y, width: 150, height: 75 });
    } catch (e) { console.error("Error al incrustar firma en PDF", e); }
    page.drawLine({ start: { x: margin, y: y - 5 }, end: { x: margin + 200, y: y - 5 }, thickness: 1 });
    page.drawText('Firma Electrónica', { x: margin, y: y - 15, font, size: 8 });
    
    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
}

// --- HANDLER PRINCIPAL ---
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
            const mailToPaciente = {
              from: 'Notificación Consentimiento Informado <caminosdelser@emcotic.com>',
              to: demograficos.email,
              subject: `Copia de tu Consentimiento Informado - Caminos del Ser`,
              html: `<p>Estimado/a ${demograficos.nombre},</p><p>Recibes una copia del consentimiento informado para la atención psicológica con el Psicólogo Jorge Arango Castaño.</p><p>Cualquier inquietud puedes hacerla al correo caminosdelser@emcotic.com o al <a href="https://wa.me/573233796547" target="_blank">WhatsApp +573233796547</a>.</p><p>Adjunto, encontrarás el PDF con tu firma.</p>`,
              attachments: [{ filename: `Consentimiento-${docRef.id}.pdf`, content: Buffer.from(pdfBuffer) }],
            };
            const mailToTerapeuta = {
              from: 'Notificación Consentimiento Informado <caminosdelser@emcotic.com>',
              to: 'caminosdelser@emcotic.com',
              subject: `Nuevo Consentimiento Informado Firmado: ${demograficos.nombre}`,
              html: `<p>Has recibido el consentimiento informado firmado del paciente <strong>${demograficos.nombre}</strong>.</p><p>El documento PDF se encuentra adjunto.</p>`,
              attachments: [{ filename: `Consentimiento-${docRef.id}.pdf`, content: Buffer.from(pdfBuffer) }],
            };
            await Promise.all([ resend.emails.send(mailToPaciente), resend.emails.send(mailToTerapeuta) ]);
        }
        response.status(200).json({ message: 'Consentimiento procesado exitosamente', id: docRef.id });
    } catch (error) {
        console.error("Error catastrófico en save-consent:", error);
        response.status(500).json({ message: 'Error interno del servidor.', detail: error.message });
    }
}

