import { db } from '../lib/firebaseAdmin.js';
import { Resend } from 'resend';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { Buffer } from 'buffer';

// =======================================================
// 1. FUNCIONES HELPER PARA GENERAR PDFs
// =======================================================
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
        intro: esMenor ? `Yo, ${demograficos.nombreAcudiente}, con documento ${demograficos.documentoAcudiente}, como ${demograficos.tipoAcudiente} de ${demograficos.nombreCompleto || demograficos.nombre} (doc ${demograficos.documentoIdentidad}), declaro que:` : `Yo, ${demograficos.nombreCompleto || demograficos.nombre}, con documento ${demograficos.documentoIdentidad}, declaro que:`,
        confidencialidad: 'Entiendo, acepto y soy consciente del trabajo profesional que realizará el psicólogo designado, y que este guardará una confidencialidad absoluta con el (la) paciente, la cual será inviolable, salvo que su integridad física se vea amenazada, y salvo los requerimientos de ley que así mismo pidan levantar la reserva profesional.',
        proposito: 'El propósito es realizar una evaluación y/o intervención psicológica, la cual se llevará a cabo utilizando técnicas y enfoques validados por la psicología como ciencia.',
        naturaleza: 'Se me ha informado que el proceso puede incluir entrevistas, pruebas psicométricas y tareas inter-sesión, y que mi participación activa es fundamental para el éxito del mismo.',
        evaluacion: esMenor ? 'Autorizo que le sean practicadas pruebas psicométricas y demás herramientas diagnósticas que el psicólogo designado así considere necesario, a fin de establecer cabal y puntualmente un diagnóstico asertivo sobre el motivo de consulta del (la) paciente menor de edad en consulta.' : 'Autorizo que sean practicadas pruebas psicométricas y demás herramientas diagnósticas que el psicólogo designado así considere necesario, a fin de establecer cabal y puntualmente un diagnóstico asertivo sobre el motivo de consulta.',
        costos: esMenor ? 'Me comprometo como acudiente del (la) paciente menor de edad, a cubrir todos los gastos económicos en que se incurra con motivo de la atención que recibirá, habiendo recibido la información de forma clara y oportuna y habiendo tenido la oportunidad de aceptar o rechazar dichas atenciones psicológicas y los costos asociados.' : 'Me comprometo a cubrir todos los gastos económicos en que se incurra con motivo de la atención que recibiré, habiendo recibido la información de forma clara y oportuna y habiendo tenido la oportunidad de aceptar o rechazar dichas atenciones psicológicas y los costos asociados.',
        datos: 'Autorizo el tratamiento de mis datos personales de acuerdo con la Ley 1581 de 2012 y la política de tratamiento de datos de "Caminos del Ser", la cual he podido consultar.'
    };

    drawWrappedText(textos.intro, { font, size: 10, lineHeight });

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
    drawDetail('Nombre Paciente', demograficos.nombreCompleto || demograficos.nombre);
    drawDetail('Documento Paciente', `${demograficos.documentoIdentidad} (${demograficos.tipoDocumento})`);
    drawDetail('Fecha Nacimiento', demograficos.fechaNacimiento);
    drawDetail('Edad', demograficos.edad);
    drawDetail('Email', demograficos.email);
    drawDetail('EPS / Serv. de Salud', demograficos.eps);
    drawDetail('Teléfono', demograficos.telefonoContacto);
    drawDetail('Dirección', demograficos.direccion);
    drawDetail('Ubicación', `${demograficos.ciudad || demograficos.municipio || ''}, ${demograficos.departamento || ''}, ${demograficos.pais}`);
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

async function crearPDFParejas(datos) {
    const { paciente1, paciente2, firmas, fechaDiligenciamiento } = datos;
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    let y = height - 40;
    const margin = 50;

    const drawText = (text, size, isBold = false) => {
        page.drawText(text, { x: margin, y, font: isBold ? boldFont : font, size });
        y -= (size + 4);
    };

    drawText('Consentimiento Informado - Terapia de Pareja', 16, true);
    y -= 10;

    const intro = `Nosotros, ${paciente1.nombreCompleto1 || paciente1.nombre} (Doc: ${paciente1.documentoIdentidad1 || paciente1.documentoIdentidad}) y ${paciente2.nombreCompleto2 || paciente2.nombre} (Doc: ${paciente2.documentoIdentidad2 || paciente2.documentoIdentidad}), declaramos voluntariamente que:`;
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
    drawText(`Nombre: ${paciente1.nombreCompleto1 || paciente1.nombre} | Doc: ${paciente1.tipoDocumento1 || paciente1.tipoDocumento} ${paciente1.documentoIdentidad1 || paciente1.documentoIdentidad}`, 9);
    drawText(`Edad: ${paciente1.edad1 || paciente1.edad} | Fecha Nacimiento: ${paciente1.fechaNacimiento1 || paciente1.fechaNacimiento}`, 9);
    drawText(`Ubicación: ${paciente1.ciudad1 || paciente1.municipio1 || ''}, ${paciente1.departamento1 || ''}, ${paciente1.pais1 || paciente1.pais}`, 9);
    drawText(`Tel: ${paciente1.telefonoContacto1 || paciente1.telefonoContacto} | Email: ${paciente1.email1 || paciente1.email}`, 9);
    drawText(`EPS / Servicio de Salud: ${paciente1.eps1 || paciente1.eps}`, 9, true); 
    y -= 10;

    // --- DATOS PACIENTE 2 ---
    drawText('DATOS PACIENTE 2:', 12, true);
    drawText(`Nombre: ${paciente2.nombreCompleto2 || paciente2.nombre} | Doc: ${paciente2.tipoDocumento2 || paciente2.tipoDocumento} ${paciente2.documentoIdentidad2 || paciente2.documentoIdentidad}`, 9);
    drawText(`Edad: ${paciente2.edad2 || paciente2.edad} | Fecha Nacimiento: ${paciente2.fechaNacimiento2 || paciente2.fechaNacimiento}`, 9);
    drawText(`Ubicación: ${paciente2.ciudad2 || paciente2.municipio2 || ''}, ${paciente2.departamento2 || ''}, ${paciente2.pais2 || paciente2.pais}`, 9);
    drawText(`Tel: ${paciente2.telefonoContacto2 || paciente2.telefonoContacto} | Email: ${paciente2.email2 || paciente2.email}`, 9);
    drawText(`EPS / Servicio de Salud: ${paciente2.eps2 || paciente2.eps}`, 9, true); 
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
    
    page.drawText(paciente1.nombreCompleto1 || paciente1.nombre, { x: margin, y: y - 15, font: font, size: 8 });
    page.drawText(paciente2.nombreCompleto2 || paciente2.nombre, { x: margin + 200, y: y - 15, font: font, size: 8 });
    
    return await pdfDoc.save();
}

// =======================================================
// 2. CONTROLADOR MAESTRO UNIFICADO DE CONSENTIMIENTOS
// =======================================================
export default async function handler(request, response) {
    const { action, id } = request.query;

    try {
        // --- BLOQUE GET (Lectura y Consultas) ---
        if (request.method === 'GET') {
            
            if (action === 'getAll') {
                const individualSnapshot = await db.collection('consents').get();
                const parejaSnapshot = await db.collection('consents_parejas').get();
                let allConsents = [];
                
                individualSnapshot.forEach(doc => {
                    const data = doc.data();
                    allConsents.push({
                        id: doc.id,
                        nombre: data.demograficos?.nombreCompleto || data.demograficos?.nombre || 'Sin nombre',
                        email: data.demograficos?.email || 'Sin email',
                        fecha: data.fecha || new Date().toISOString(),
                        tipo: 'individual'
                    });
                });
                
                parejaSnapshot.forEach(doc => {
                    const data = doc.data();
                    const n1 = data.paciente1?.nombreCompleto1 || data.paciente1?.nombre || 'P1';
                    const n2 = data.paciente2?.nombreCompleto2 || data.paciente2?.nombre || 'P2';
                    const e1 = data.paciente1?.email1 || data.paciente1?.email || '';
                    const e2 = data.paciente2?.email2 || data.paciente2?.email || '';
                    
                    allConsents.push({
                        id: doc.id,
                        nombre: `${n1} y ${n2}`,
                        email: `${e1} / ${e2}`,
                        fecha: data.fecha || new Date().toISOString(),
                        tipo: 'pareja'
                    });
                });
                
                allConsents.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
                return response.status(200).json(allConsents);
            }
            
            if (action === 'getIndividual') {
                if (!id) return response.status(400).json({ message: 'El ID es requerido.' });
                const doc = await db.collection('consents').doc(id).get();
                if (!doc.exists) return response.status(404).json({ message: 'No encontrado.' });
                return response.status(200).json({ id: doc.id, ...doc.data() });
            }

            if (action === 'getPareja') {
                if (!id) return response.status(400).json({ message: 'El ID es requerido.' });
                const doc = await db.collection('consents_parejas').doc(id).get();
                if (!doc.exists) return response.status(404).json({ message: 'No encontrado.' });
                return response.status(200).json({ id: doc.id, ...doc.data() });
            }
            
            return response.status(400).json({ message: 'Acción GET no válida' });
        }

        // --- BLOQUE POST (Guardar Consentimientos, Correos y PDFs) ---
        if (request.method === 'POST') {
            const data = request.body;
            const resendApiKey = process.env.RESEND2_API_KEY;
            const resend = resendApiKey ? new Resend(resendApiKey) : null;

            if (action === 'updateDemographics') {
                const { id, isPareja, datos } = request.body;
                if (!id || !datos) return response.status(400).json({ message: 'Faltan datos.' });
                
                if (isPareja) {
                    await db.collection('consents_parejas').doc(id).set({
                        paciente1: datos.paciente1,
                        paciente2: datos.paciente2
                    }, { merge: true });
                } else {
                    await db.collection('consents').doc(id).set({
                        demograficos: datos.demograficos
                    }, { merge: true });
                }
                return response.status(200).json({ message: 'Datos actualizados exitosamente.' });
            }

            if (action === 'saveIndividual') {
                if (!data.demograficos || !data.firmaDigital) return response.status(400).json({ message: 'Faltan datos críticos.' });
                const dataToSave = { ...data, fecha: new Date().toISOString(), estado: 'Firmado' };
                const docRef = await db.collection('consents').add(dataToSave);
                
                if (resend) {
                    const pdfBuffer = await crearPDFConsentimiento(dataToSave);
                    const attachments = [{ filename: `Consentimiento-${docRef.id}.pdf`, content: Buffer.from(pdfBuffer) }];
                    const nombrePaciente = data.demograficos.nombreCompleto || data.demograficos.nombre;
                    await Promise.all([
                        resend.emails.send({ 
                            from: 'Notificación Consentimiento Informado <caminosdelser@emcotic.com>', 
                            to: data.demograficos.email, 
                            subject: `Copia de tu Consentimiento Informado - Caminos del Ser`, 
                            html: `<p>Estimado/a ${nombrePaciente},</p><p>Recibes una copia del consentimiento informado para la atención psicológica.</p><p>Cualquier inquietud al correo caminosdelser@emcotic.com o al <a href="https://wa.me/573233796547" target="_blank">WhatsApp +573233796547</a>.</p>`, 
                            attachments 
                        }),
                        resend.emails.send({ 
                            from: 'Notificación Consentimiento Informado <caminosdelser@emcotic.com>', 
                            to: 'caminosdelser@emcotic.com', 
                            subject: `Nuevo Consentimiento Informado Firmado: ${nombrePaciente}`, 
                            html: `<p>Has recibido el consentimiento informado firmado del paciente <strong>${nombrePaciente}</strong>.</p>`, 
                            attachments 
                        })
                    ]);
                }
                return response.status(200).json({ message: 'Procesado exitosamente', id: docRef.id });
            }

            if (action === 'savePareja') {
                const dataToSave = { ...data, fecha: new Date().toISOString(), estado: 'Firmado Pareja' };
                const docRef = await db.collection('consents_parejas').add(dataToSave);
                
                if (resend) {
                    const pdfBuffer = await crearPDFParejas(dataToSave);
                    const attachments = [{ filename: `Consentimiento-Pareja-${docRef.id}.pdf`, content: Buffer.from(pdfBuffer) }];
                    const email1 = data.paciente1.email1 || data.paciente1.email;
                    const email2 = data.paciente2.email2 || data.paciente2.email;
                    const nombre1 = data.paciente1.nombreCompleto1 || data.paciente1.nombre;
                    const nombre2 = data.paciente2.nombreCompleto2 || data.paciente2.nombre;

                    await Promise.all([
                        resend.emails.send({ from: 'Notificación Consentimiento <caminosdelser@emcotic.com>', to: email1, subject: `Copia de Consentimiento de Pareja`, html: `<p>Adjunto encontrarás el PDF del consentimiento informado de terapia de pareja.</p>`, attachments }),
                        resend.emails.send({ from: 'Notificación Consentimiento <caminosdelser@emcotic.com>', to: email2, subject: `Copia de Consentimiento de Pareja`, html: `<p>Adjunto encontrarás el PDF del consentimiento informado de terapia de pareja.</p>`, attachments }),
                        resend.emails.send({ from: 'Notificación Consentimiento <caminosdelser@emcotic.com>', to: 'caminosdelser@emcotic.com', subject: `Nuevo Consentimiento Pareja: ${nombre1} y ${nombre2}`, html: `<p>Adjunto encontrarás el PDF firmado digitalmente.</p>`, attachments })
                    ]);
                }
                return response.status(200).json({ message: 'Procesado exitosamente', id: docRef.id });
            }

            return response.status(400).json({ message: 'Acción POST no válida' });
        }

        // --- BLOQUE DELETE (Eliminar Paciente y su Expediente) ---
        if (request.method === 'DELETE' && action === 'delete') {
            if (!id) return response.status(400).json({ message: 'Falta el ID' });
            
            await db.collection('consents').doc(id).delete();
            await db.collection('consents_parejas').doc(id).delete();
            await db.collection('historias_clinicas').doc(id).delete();
            return response.status(200).json({ message: 'Registro eliminado correctamente' });
        }

        return response.status(405).json({ message: 'Método no permitido.' });

    } catch (error) {
        console.error("Error crítico en consentimientos:", error);
        return response.status(500).json({ message: 'Error interno del servidor', detail: error.message });
    }
}
