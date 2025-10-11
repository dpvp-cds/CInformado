import { db } from '../lib/firebaseAdmin.js';
import { Resend } from 'resend';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { Buffer } from 'buffer';

// --- FUNCIÓN DEDICADA PARA CREAR EL PDF DE PAREJA ---
async function crearPDFConsentimientoPareja(datos) {
    const { demograficos, firmas, fecha } = datos;
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    let y = height - 40;
    const margin = 50;
    const maxWidth = width - 2 * margin;

    const drawWrappedText = (text, options) => {
        const { font: textFont = font, size = 10, color = rgb(0, 0, 0), lineHeight = 14 } = options;
        const words = text.split(' ');
        let line = '';
        
        for (const word of words) {
            const testLine = line + word + ' ';
            const testWidth = textFont.widthOfTextAtSize(testLine, size);
            if (testWidth > maxWidth && line !== '') {
                page.drawText(line, { x: margin, y, font: textFont, size, color });
                y -= lineHeight;
                line = word + ' ';
            } else {
                line = testLine;
            }
        }
        page.drawText(line, { x: margin, y, font: textFont, size, color });
        y -= (lineHeight + 4);
    };

    const drawDetail = (label, value) => {
        if (y < 40) {
            page = pdfDoc.addPage();
            y = height - 40;
        }
        if (value) {
            page.drawText(`${label}:`, { x: margin, y, font: boldFont, size: 10 });
            page.drawText(String(value), { x: margin + 170, y, font, size: 10 });
            y -= 18;
        }
    };
    
    // --- PÁGINA 1: TÉRMINOS DEL CONSENTIMIENTO ---
    page.drawText('Consentimiento Informado Digital de Pareja - Caminos del Ser', { x: margin, y, font: boldFont, size: 16, color: rgb(0, 0.2, 0.4) });
    y -= 30;

    const introText = `Nosotros, ${demograficos.nombreCompleto1}, identificado/a con documento de identidad ${demograficos.documentoIdentidad1}, y ${demograficos.nombreCompleto2}, identificado/a con documento de identidad ${demograficos.documentoIdentidad2}, declaramos que:`;
    drawWrappedText(introText, { size: 11 });
    y -= 10;
    
    const textos = {
        confidencialidad: [
            'Entendemos, aceptamos y somos conscientes del trabajo profesional que realizará el psicólogo designado, y que este guardará una confidencialidad absoluta con la pareja, la cual será inviolable, salvo que la integridad física de alguno de los miembros se vea amenazada, o la de terceros, y salvo los requerimientos de ley que así mismo pidan levantar la reserva profesional. La información compartida en sesiones individuales con cualquiera de los miembros podrá ser utilizada en la terapia conjunta si el terapeuta lo considera pertinente para el avance del proceso.',
            'Entendemos y nos comprometemos a respetar la privacidad y confidencialidad que el psicólogo tendrá con el otro miembro de la relación. Es decir, ninguno podrá preguntarle al psicólogo sobre las sesiones individuales que se tenga con el otro y el psicólogo no podrá divulgar información confidencial y privada que se hable en las sesiones individuales sin la previa autorización expresa del miembro de la pareja involucrado.'
        ],
        proposito: 'El propósito es realizar una evaluación y/o intervención psicológica de pareja, la cual se llevará a cabo utilizando técnicas y enfoques validados por la psicología como ciencia para mejorar la dinámica y el bienestar de la relación.',
        naturaleza: 'Se nos ha informado que el proceso puede incluir entrevistas conjuntas e individuales, pruebas psicométricas y tareas inter-sesión, y que nuestra participación activa y honesta es fundamental para el éxito del mismo.',
        costos: 'Nos comprometemos a cubrir todos los gastos económicos en que se incurra con motivo de la atención que recibiremos, habiendo recibido la información de forma clara y oportuna y habiendo tenido la oportunidad de aceptar o rechazar dichas atenciones psicológicas y los costos asociados.',
        datos: 'Autorizamos el tratamiento de nuestros datos personales de acuerdo con la Ley 1581 de 2012 y la política de tratamiento de datos de "Caminos del Ser", la cual hemos podido consultar.'
    };
    
    page.drawText('4.1 Confidencialidad:', { x: margin, y, font: boldFont, size: 10 }); y -= 15;
    textos.confidencialidad.forEach(p => drawWrappedText(p, {}));
    page.drawText('4.2 Propósito de la Intervención:', { x: margin, y, font: boldFont, size: 10 }); y -= 15;
    drawWrappedText(textos.proposito, {});
    page.drawText('4.3 Naturaleza del Proceso:', { x: margin, y, font: boldFont, size: 10 }); y -= 15;
    drawWrappedText(textos.naturaleza, {});
    page.drawText('4.4 Costos económicos:', { x: margin, y, font: boldFont, size: 10 }); y -= 15;
    drawWrappedText(textos.costos, {});
    page.drawText('4.5 Tratamiento de Datos:', { x: margin, y, font: boldFont, size: 10 }); y -= 15;
    drawWrappedText(textos.datos, {});

    // --- PÁGINA 2: DATOS REGISTRADOS ---
    page = pdfDoc.addPage();
    y = height - 40;

    page.drawText('Datos Registrados del Consentimiento', { x: margin, y, font: boldFont, size: 16, color: rgb(0, 0.2, 0.4) }); y -= 30;

    // MIEMBRO 1
    page.drawText('Información del Miembro 1', { x: margin, y, font: boldFont, size: 12, color: rgb(0.1, 0.1, 0.1) }); y -= 20;
    drawDetail('Nombre Completo', demograficos.nombreCompleto1);
    drawDetail('Documento', `${demograficos.documentoIdentidad1} (${demograficos.tipoDocumento1})`);
    drawDetail('Fecha de Nacimiento', demograficos.fechaNacimiento1);
    drawDetail('Email', demograficos.email1);
    drawDetail('Teléfono', demograficos.telefonoContacto1);
    drawDetail('Contacto de Emergencia', `${demograficos.contactoEmergenciaNombre1} (${demograficos.contactoEmergenciaTelefono1})`);
    y -= 15;

    // MIEMBRO 2
    page.drawText('Información del Miembro 2', { x: margin, y, font: boldFont, size: 12, color: rgb(0.1, 0.1, 0.1) }); y -= 20;
    drawDetail('Nombre Completo', demograficos.nombreCompleto2);
    drawDetail('Documento', `${demograficos.documentoIdentidad2} (${demograficos.tipoDocumento2})`);
    drawDetail('Fecha de Nacimiento', demograficos.fechaNacimiento2);
    drawDetail('Email', demograficos.email2);
    drawDetail('Teléfono', demograficos.telefonoContacto2);
    drawDetail('Contacto de Emergencia', `${demograficos.contactoEmergenciaNombre2} (${demograficos.contactoEmergenciaTelefono2})`);
    y -= 15;

    // INFORMACIÓN COMPARTIDA
    page.drawText('Información Compartida', { x: margin, y, font: boldFont, size: 12, color: rgb(0.1, 0.1, 0.1) }); y -= 20;
    drawDetail('Tipo de Unión', demograficos.tipoUnion);
    drawDetail('Tiempo de Relación', `${demograficos.tiempoRelacion} años`);
    if (demograficos.anosConvivencia) drawDetail('Años de Convivencia', demograficos.anosConvivencia);
    if (demograficos.anosCasados) drawDetail('Años de Casados', demograficos.anosCasados);
    if (demograficos.pais) drawDetail('Residencia', `${demograficos.ciudad || demograficos.municipio}, ${demograficos.departamento || ''}, ${demograficos.pais}`);
    if (demograficos.direccion) drawDetail('Dirección', demograficos.direccion);
    drawDetail('Hijos', demograficos.numHijos);
    drawDetail('Mascotas', demograficos.numMascotas);
    
    // --- FIRMAS ---
    y -= 30;
    page.drawText('Firmas Digitales', { x: margin, y, font: boldFont, size: 14 }); y -= 10;
    
    const firmaWidth = 150;
    const firmaHeight = 75;

    try {
        const firma1Bytes = Buffer.from(firmas.miembro1.split(',')[1], 'base64');
        const firma1Image = await pdfDoc.embedPng(firma1Bytes);
        page.drawImage(firma1Image, { x: margin, y: y - firmaHeight, width: firmaWidth, height: firmaHeight });
        page.drawLine({ start: { x: margin, y: y - firmaHeight - 5 }, end: { x: margin + firmaWidth, y: y - firmaHeight - 5 }, thickness: 1 });
        page.drawText(demograficos.nombreCompleto1, { x: margin, y: y - firmaHeight - 15, font, size: 8 });

        const firma2X = width - margin - firmaWidth;
        const firma2Bytes = Buffer.from(firmas.miembro2.split(',')[1], 'base64');
        const firma2Image = await pdfDoc.embedPng(firma2Bytes);
        page.drawImage(firma2Image, { x: firma2X, y: y - firmaHeight, width: firmaWidth, height: firmaHeight });
        page.drawLine({ start: { x: firma2X, y: y - firmaHeight - 5 }, end: { x: firma2X + firmaWidth, y: y - firmaHeight - 5 }, thickness: 1 });
        page.drawText(demograficos.nombreCompleto2, { x: firma2X, y: y - firmaHeight - 15, font, size: 8 });
    } catch (e) {
        console.error("Error al incrustar firmas en PDF", e);
    }
    
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
        const { demograficos, firmas } = data;

        if (!demograficos || !demograficos.nombreCompleto1 || !demograficos.email1 || !demograficos.nombreCompleto2 || !demograficos.email2 || !firmas || !firmas.miembro1 || !firmas.miembro2) {
            return response.status(400).json({ message: 'Faltan datos críticos de la pareja o las firmas.' });
        }
        
        const dataToSave = { ...data, fecha: new Date().toISOString(), estado: 'Firmado' };
        
        // Guardamos en la misma colección, el tipo de terapia nos ayudará a diferenciar.
        const docRef = await db.collection('consents').add(dataToSave);
        
        const resendApiKey = process.env.RESEND2_API_KEY;
        if (!resendApiKey) {
            console.warn("Servidor: RESEND2_API_KEY no definida.");
        } else {
            const resend = new Resend(resendApiKey);
            const pdfBuffer = await crearPDFConsentimientoPareja(dataToSave);
            
            const commonEmailData = {
              from: 'Notificación Consentimiento Informado <caminosdelser@emcotic.com>',
              attachments: [{ filename: `Consentimiento-Pareja-${docRef.id}.pdf`, content: Buffer.from(pdfBuffer) }],
            };

            const mailMiembro1 = {
              ...commonEmailData,
              to: demograficos.email1,
              subject: `Copia de su Consentimiento Informado de Pareja - Caminos del Ser`,
              html: `<p>Estimado/a ${demograficos.nombreCompleto1},</p><p>Recibes una copia del consentimiento informado para la atención psicológica con el <strong>Psicólogo Jorge Arango Castaño</strong>.</p><p>Cualquier inquietud puedes hacerla al correo caminosdelser@emcotic.com o al <a href="https://wa.me/573233796547" target="_blank">WhatsApp +57 3233796547</a>.</p><p>Adjunto, encontrarás el PDF con tu firma.</p>`,
            };
            
            const mailMiembro2 = {
              ...commonEmailData,
              to: demograficos.email2,
              subject: `Copia de su Consentimiento Informado de Pareja - Caminos del Ser`,
              html: `<p>Estimado/a ${demograficos.nombreCompleto2},</p><p>Recibes una copia del consentimiento informado para la atención psicológica con el <strong>Psicólogo Jorge Arango Castaño</strong>.</p><p>Cualquier inquietud puedes hacerla al correo caminosdelser@emcotic.com o al <a href="https://wa.me/573233796547" target="_blank">WhatsApp +57 3233796547</a>.</p><p>Adjunto, encontrarás el PDF con tu firma.</p>`,
            };

            const mailTerapeuta = {
              ...commonEmailData,
              to: 'caminosdelser@emcotic.com',
              subject: `Nuevo Consentimiento de Pareja: ${demograficos.nombreCompleto1} y ${demograficos.nombreCompleto2}`,
              html: `<p>Has recibido el consentimiento informado de la pareja compuesta por <strong>${demograficos.nombreCompleto1}</strong> y <strong>${demograficos.nombreCompleto2}</strong>.</p><p>El documento PDF se encuentra adjunto.</p>`,
            };
            
            await Promise.all([
                resend.emails.send(mailMiembro1),
                resend.emails.send(mailMiembro2),
                resend.emails.send(mailTerapeuta)
            ]);
        }
        
        response.status(200).json({ message: 'Consentimiento de pareja procesado exitosamente', id: docRef.id });
    } catch (error) {
        console.error("Error catastrófico en save-consent-pareja:", error);
        response.status(500).json({ message: 'Error interno del servidor.', detail: error.message });
    }
}
