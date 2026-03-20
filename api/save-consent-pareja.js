import { db } from '../lib/firebaseAdmin.js';
import { Resend } from 'resend';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { Buffer } from 'buffer';

async function crearPDFParejas(datos) {
    const { paciente1, paciente2, firmas, fechaDiligenciamiento } = datos;
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    let y = height - 40;
    const margin = 50;
    const maxWidth = width - 2 * margin;

    const drawText = (text, size, isBold = false) => {
        page.drawText(text, { x: margin, y, font: isBold ? boldFont : font, size });
        y -= (size + 4);
    };

    drawText('Consentimiento Informado - Terapia de Pareja', 16, true);
    y -= 10;

    const intro = `Nosotros, ${paciente1.nombre} (Doc: ${paciente1.documentoIdentidad}) y ${paciente2.nombre} (Doc: ${paciente2.documentoIdentidad}), declaramos voluntariamente que:`;
    drawText(intro, 10); y -= 10;
    
    drawText('3.1 Confidencialidad y Secreto Compartido:', 10, true);
    drawText('Entendemos y aceptamos que la terapia de pareja implica un "paciente conjunto".', 10);
    drawText('Se guardará estricta confidencialidad bajo una política de "no secretos".', 10); y -= 5;

    drawText('3.2 Propósito de la Intervención:', 10, true);
    drawText('Mejorar la dinámica relacional utilizando técnicas validadas.', 10); y -= 5;

    drawText('3.3 Tratamiento de Datos y Costos:', 10, true);
    drawText('Autorizamos el tratamiento de datos y nos comprometemos solidariamente a los costos.', 10); y -= 20;

    // --- DATOS PACIENTE 1 ---
    drawText('DATOS PACIENTE 1:', 12, true);
    drawText(`Nombre: ${paciente1.nombre} | Doc: ${paciente1.tipoDocumento} ${paciente1.documentoIdentidad}`, 9);
    drawText(`Edad: ${paciente1.edad} | Fecha Nacimiento: ${paciente1.fechaNacimiento}`, 9);
    drawText(`Ubicación: ${paciente1.ciudad || ''}, ${paciente1.departamento || ''}, ${paciente1.pais}`, 9);
    drawText(`Tel: ${paciente1.telefonoContacto} | Email: ${paciente1.email}`, 9);
    drawText(`EPS / Servicio de Salud: ${paciente1.eps}`, 9, true); // <--- EPS incluida
    y -= 10;

    // --- DATOS PACIENTE 2 ---
    drawText('DATOS PACIENTE 2:', 12, true);
    drawText(`Nombre: ${paciente2.nombre} | Doc: ${paciente2.tipoDocumento} ${paciente2.documentoIdentidad}`, 9);
    drawText(`Edad: ${paciente2.edad} | Fecha Nacimiento: ${paciente2.fechaNacimiento}`, 9);
    drawText(`Ubicación: ${paciente2.ciudad || ''}, ${paciente2.departamento || ''}, ${paciente2.pais}`, 9);
    drawText(`Tel: ${paciente2.telefonoContacto} | Email: ${paciente2.email}`, 9);
    drawText(`EPS / Servicio de Salud: ${paciente2.eps}`, 9, true); // <--- EPS incluida
    y -= 20;

    // --- FIRMAS ---
    drawText('Firmas Electrónicas de Aceptación:', 12, true);
    y -= 80; 
    try {
        const img1 = await pdfDoc.embedPng(Buffer.from(firmas.firma1.split(',')[1], 'base64'));
        const img2 = await pdfDoc.embedPng(Buffer.from(firmas.firma2.split(',')[1], 'base64'));
        page.drawImage(img1, { x: margin, y, width: 150, height: 70 });
        page.drawImage(img2, { x: margin + 200, y, width: 150, height: 70 });
    } catch (e) { console.error("Error incrustando firmas", e); }
    
    page.drawLine({ start: { x: margin, y: y - 5 }, end: { x: margin + 150, y: y - 5 }, thickness: 1 });
    page.drawLine({ start: { x: margin + 200, y: y - 5 }, end: { x: margin + 350, y: y - 5 }, thickness: 1 });
    
    page.drawText(paciente1.nombre, { x: margin, y: y - 15, font: font, size: 8 });
    page.drawText(paciente2.nombre, { x: margin + 200, y: y - 15, font: font, size: 8 });
    
    return await pdfDoc.save();
}

export default async function handler(request, response) {
    if (request.method !== 'POST') return response.status(405).json({ message: 'Método no permitido.' });
    
    try {
        const data = request.body;
        const dataToSave = { ...data, fecha: new Date().toISOString(), estado: 'Firmado Pareja' };
        
        // Guardar en la misma colección de consents o en una separada. Usamos 'consents_parejas' por orden.
        const docRef = await db.collection('consents_parejas').add(dataToSave);
        
        const resendApiKey = process.env.RESEND2_API_KEY;
        if (resendApiKey) {
            const resend = new Resend(resendApiKey);
            const pdfBuffer = await crearPDFParejas(dataToSave);
            
            const attachments = [{ filename: `Consentimiento-Pareja-${docRef.id}.pdf`, content: Buffer.from(pdfBuffer) }];
            
            // Enviar a Paciente 1, Paciente 2 y Terapeuta
            const correos = [
                { to: data.paciente1.email, subject: 'Copia de Consentimiento de Pareja' },
                { to: data.paciente2.email, subject: 'Copia de Consentimiento de Pareja' },
                { to: 'caminosdelser@emcotic.com', subject: `Nuevo Consentimiento Pareja: ${data.paciente1.nombre} y ${data.paciente2.nombre}` }
            ];

            const emailPromises = correos.map(correo => resend.emails.send({
                from: 'Notificación Consentimiento <caminosdelser@emcotic.com>',
                to: correo.to,
                subject: correo.subject,
                html: `<p>Adjunto encontrarás el PDF del consentimiento informado de terapia de pareja firmado digitalmente.</p>`,
                attachments: attachments
            }));

            await Promise.all(emailPromises);
        }
        
        response.status(200).json({ message: 'Procesado exitosamente', id: docRef.id });
    } catch (error) {
        console.error("Error en save-consent-pareja:", error);
        response.status(500).json({ message: 'Error interno del servidor.', detail: error.message });
    }
}
