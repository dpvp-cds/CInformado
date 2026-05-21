import { db } from '../lib/firebaseAdmin.js';
import { Resend } from 'resend';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { Buffer } from 'buffer';

// =======================================================
// GENERADORES DE PDF (INDIVIDUAL Y PAREJA)
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
    const modalidad = datos.consentimiento?.modalidad || 'presencial';
    
    const textos = {
        intro: esMenor ? `Yo, ${demograficos.nombreAcudiente}, con documento ${demograficos.documentoAcudiente}, como ${demograficos.tipoAcudiente} de ${demograficos.nombre} (doc ${demograficos.documentoIdentidad}), declaro que:` : `Yo, ${demograficos.nombre}, con documento ${demograficos.documentoIdentidad}, declaro que:`,
        confidencialidad: 'Entiendo, acepto y soy consciente del trabajo profesional que realizará el psicólogo designado, y que este guardará una confidencialidad absoluta con el (la) paciente, la cual será inviolable, salvo que su integridad física se vea amenazada, y salvo los requerimientos de ley que así mismo pidan levantar la reserva profesional.',
        proposito: 'El propósito es realizar una evaluación y/o intervención psicológica, la cual se llevará a cabo utilizando técnicas y enfoques validados por la psicología como ciencia.',
        naturaleza: 'Se me ha informado que el proceso puede incluir entrevistas, pruebas psicométricas y tareas inter-sesión, y que mi participación activa es fundamental para el éxito del mismo.',
        evaluacion: esMenor ? 'Autorizo que le sean practicadas pruebas psicométricas y demás herramientas diagnósticas que el psicólogo designado así considere necesario, a fin de establecer cabal y puntualmente un diagnóstico asertivo sobre el motivo de consulta del (la) paciente menor de edad en consulta.' : 'Autorizo que sean practicadas pruebas psicométricas y demás herramientas diagnósticas que el psicólogo designado así considere necesario, a fin de establecer cabal y puntualmente un diagnóstico asertivo sobre el motivo de consulta.',
        costos: esMenor ? 'Me comprometo como acudiente del (la) paciente menor de edad, a cubrir todos los gastos económicos en que se incurra con motivo de la atención que recibirá, habiendo recibido la información de forma clara y oportuna y habiendo tenido la oportunidad de aceptar o rechazar dichas atenciones psicológicas y los costos asociados.' : 'Me comprometo a cubrir todos los gastos económicos en que se incurra con motivo de la atención que recibiré, habiendo recibido la información de forma clara y oportuna y habiendo tenido la oportunidad de aceptar o rechazar dichas atenciones psicológicas y los costos asociados.',
        datos: 'Autorizo el tratamiento de mis datos personales de acuerdo con la Ley 1581 de 2012 y la política de tratamiento de datos de "Caminos del Ser", la cual he podido consultar.',
        declaracion: esMenor ? `Declaro y doy fe de que yo, ${demograficos.nombreAcudiente}, actuando como acudiente, he leído y comprendido este documento durante una sesión ${modalidad} con el Psicólogo Jorge Arango Castaño, donde se me ha garantizado un espacio para hacer preguntas, las cuales han sido respondidas a mi entera satisfacción.` : `Declaro y doy fe de que yo, ${demograficos.nombre}, he leído y comprendido este documento durante una sesión ${modalidad} con el Psicólogo Jorge Arango Castaño, donde se me ha garantizado un espacio para hacer preguntas, las cuales han sido respondidas a mi entera satisfacción.`
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

    y -= 5;
    page.drawText('2.7 Declaración y Modalidad de la Sesión:', { x: margin, y, font: boldFont, size: 10 });
    y -= titleLineHeight;
    drawWrappedText(textos.declaracion, { font, size: 10, lineHeight });

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
    drawDetail('EPS / Serv. de Salud', demograficos.eps);
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
    
    return await pdfDoc.save();
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
    const maxWidth = width - 2 * margin;

    const drawText = (text, size, isBold = false) => {
        page.drawText(text, { x: margin, y, font: isBold ? boldFont : font, size });
        y -= (size + 4);
    };

    const drawWrappedText = (text, size, isBold = false) => {
        const words = text.split(' ');
        let line = '';
        for (const word of words) {
            const testLine = line + word + ' ';
            const testWidth = (isBold ? boldFont : font).widthOfTextAtSize(testLine, size);
            if (testWidth > maxWidth && line !== '') {
                page.drawText(line, { x: margin, y, font: isBold ? boldFont : font, size });
                y -= (size + 4);
                line = word + ' ';
            } else {
                line = testLine;
            }
        }
        page.drawText(line, { x: margin, y, font: isBold ? boldFont : font, size });
        y -= (size + 4);
    };

    drawText('Consentimiento Informado - Terapia de Pareja', 16, true);
    y -= 10;

    const intro = `Nosotros, ${paciente1.nombre} (Doc: ${paciente1.documentoIdentidad}) y ${paciente2.nombre} (Doc: ${paciente2.documentoIdentidad}), declaramos voluntariamente que:`;
    drawWrappedText(intro, 10); y -= 10;
    
    drawText('3.1 Confidencialidad y Secreto Compartido:', 10, true);
    drawWrappedText('Entendemos y aceptamos que la terapia de pareja implica un "paciente conjunto". Se guardará estricta confidencialidad bajo una política de "no secretos".', 10); y -= 5;

    drawText('3.2 Propósito de la Intervención:', 10, true);
    drawWrappedText('Mejorar la dinámica relacional utilizando técnicas validadas.', 10); y -= 5;

    drawText('3.3 Tratamiento de Datos y Costos:', 10, true);
    drawWrappedText('Autorizamos el tratamiento de datos y nos comprometemos solidariamente a los costos.', 10); y -= 10;

    drawText('3.4 Declaración y Modalidad de la Sesión:', 10, true);
    const modalidad = datos.consentimiento?.modalidad || 'presencial';
    const decPareja = `Declaramos y damos fe de que nosotros, ${paciente1.nombre} y ${paciente2.nombre}, hemos leído y comprendido este documento durante una sesión ${modalidad} con el Psicólogo Jorge Arango Castaño, donde se nos ha garantizado un espacio para hacer preguntas, las cuales han sido respondidas a nuestra entera satisfacción.`;
    drawWrappedText(decPareja, 10); y -= 20;

    // --- DATOS PACIENTE 1 ---
    drawText('DATOS PACIENTE 1:', 12, true);
    drawText(`Nombre: ${paciente1.nombre} | Doc: ${paciente1.tipoDocumento} ${paciente1.documentoIdentidad}`, 9);
    drawText(`Edad: ${paciente1.edad} | Fecha Nacimiento: ${paciente1.fechaNacimiento}`, 9);
    drawText(`Ubicación: ${paciente1.ciudad || ''}, ${paciente1.departamento || ''}, ${paciente1.pais}`, 9);
    drawText(`Tel: ${paciente1.telefonoContacto} | Email: ${paciente1.email}`, 9);
    drawText(`EPS / Servicio de Salud: ${paciente1.eps}`, 9, true);
    y -= 10;

    // --- DATOS PACIENTE 2 ---
    drawText('DATOS PACIENTE 2:', 12, true);
    drawText(`Nombre: ${paciente2.nombre} | Doc: ${paciente2.tipoDocumento} ${paciente2.documentoIdentidad}`, 9);
    drawText(`Edad: ${paciente2.edad} | Fecha Nacimiento: ${paciente2.fechaNacimiento}`, 9);
    drawText(`Ubicación: ${paciente2.ciudad || ''}, ${paciente2.departamento || ''}, ${paciente2.pais}`, 9);
    drawText(`Tel: ${paciente2.telefonoContacto} | Email: ${paciente2.email}`, 9);
    drawText(`EPS / Servicio de Salud: ${paciente2.eps}`, 9, true);
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

// =======================================================
// CONTROLADOR MAESTRO DE CONSENTIMIENTOS
// =======================================================
export default async function handler(request, response) {
    const action = request.query.action;

    try {
        // --- BLOQUE GET (Lectura) ---
        if (request.method === 'GET') {
            
            if (action === 'getAll') {
                const results = [];
                
                const snapshotIndividuales = await db.collection('consents').orderBy('fecha', 'desc').get();
                snapshotIndividuales.forEach(doc => {
                    const data = doc.data();
                    results.push({
                        id: doc.id,
                        nombre: data.demograficos?.nombreCompleto || data.demograficos?.nombre || 'Sin Nombre',
                        email: data.demograficos?.email || 'Sin Email',
                        tipo: 'individual',
                        fecha: data.fecha
                    });
                });

                const snapshotParejas = await db.collection('consents_parejas').orderBy('fecha', 'desc').get();
                snapshotParejas.forEach(doc => {
                    const data = doc.data();
                    const n1 = data.paciente1?.nombreCompleto1 || data.paciente1?.nombre || 'P1';
                    const n2 = data.paciente2?.nombreCompleto2 || data.paciente2?.nombre || 'P2';
                    results.push({
                        id: doc.id,
                        nombre: `${n1} y ${n2}`,
                        email: data.paciente1?.email1 || data.paciente1?.email || 'Sin Email',
                        tipo: 'pareja',
                        fecha: data.fecha
                    });
                });

                results.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
                return response.status(200).json(results);
            }
            
            if (action === 'getIndividual') {
                const doc = await db.collection('consents').doc(request.query.id).get();
                if (!doc.exists) return response.status(404).json({ message: 'No encontrado' });
                return response.status(200).json({ id: doc.id, ...doc.data() });
            }
            
            if (action === 'getPareja') {
                const doc = await db.collection('consents_parejas').doc(request.query.id).get();
                if (!doc.exists) return response.status(404).json({ message: 'No encontrado' });
                return response.status(200).json({ id: doc.id, ...doc.data() });
            }
        }

        // --- BLOQUE POST (Guardar Consentimientos, Correos, PDFs y Habeas Data) ---
        if (request.method === 'POST') {
            const data = request.body;
            const resendApiKey = process.env.RESEND2_API_KEY;
            const resend = resendApiKey ? new Resend(resendApiKey) : null;

            // 1. Actualización de Habeas Data
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

            // 2. Guardar Individual
            if (action === 'saveIndividual') {
                if (!data.demograficos || !data.firmaDigital) return response.status(400).json({ message: 'Faltan datos críticos.' });
                
                const dataToSave = { ...data, fecha: new Date().toISOString(), estado: 'Firmado' };
                const docRef = await db.collection('consents').add(dataToSave);
                
                if (resend) {
                    const pdfBuffer = await crearPDFConsentimiento(dataToSave);
                    const mailToPaciente = {
                        from: 'Notificación Consentimiento Informado <caminosdelser@emcotic.com>',
                        to: dataToSave.demograficos.email,
                        subject: `Copia de tu Consentimiento Informado - Caminos del Ser`,
                        html: `<p>Estimado/a ${dataToSave.demograficos.nombre},</p><p>Recibes una copia del consentimiento informado para la atención psicológica con el Psicólogo Jorge Arango Castaño.</p><p>Adjunto, encontrarás el PDF con tu firma.</p>`,
                        attachments: [{ filename: `Consentimiento-${docRef.id}.pdf`, content: Buffer.from(pdfBuffer) }]
                    };
                    const mailToTerapeuta = {
                        from: 'Notificación Consentimiento Informado <caminosdelser@emcotic.com>',
                        to: ['caminosdelser@emcotic.com', 'jarango5@cuc.edu.co'],
                        subject: `Nuevo Consentimiento Firmado: ${dataToSave.demograficos.nombre}`,
                        html: `<p>Has recibido el consentimiento firmado de <strong>${dataToSave.demograficos.nombre}</strong>.</p>`,
                        attachments: [{ filename: `Consentimiento-${docRef.id}.pdf`, content: Buffer.from(pdfBuffer) }]
                    };
                    await Promise.all([ resend.emails.send(mailToPaciente), resend.emails.send(mailToTerapeuta) ]);
                }
                return response.status(200).json({ message: 'Procesado exitosamente', id: docRef.id });
            }

            // 3. Guardar Pareja
            if (action === 'savePareja') {
                if (!data.paciente1 || !data.firmas) return response.status(400).json({ message: 'Faltan datos críticos.' });
                
                const dataToSave = { ...data, fecha: new Date().toISOString(), estado: 'Firmado Pareja' };
                const docRef = await db.collection('consents_parejas').add(dataToSave);
                
                if (resend) {
                    const pdfBuffer = await crearPDFParejas(dataToSave);
                    const attachments = [{ filename: `Consentimiento-Pareja-${docRef.id}.pdf`, content: Buffer.from(pdfBuffer) }];
                    const correos = [
                        { to: dataToSave.paciente1.email, subject: 'Copia de Consentimiento de Pareja' },
                        { to: dataToSave.paciente2.email, subject: 'Copia de Consentimiento de Pareja' },
                        { to: ['caminosdelser@emcotic.com', 'jarango5@cuc.edu.co'], subject: `Nuevo Consentimiento Pareja: ${dataToSave.paciente1.nombre} y ${dataToSave.paciente2.nombre}` }
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
                return response.status(200).json({ message: 'Procesado exitosamente', id: docRef.id });
            }
        }

        // --- BLOQUE DELETE (Borrar) ---
        if (request.method === 'DELETE' && action === 'delete') {
            const { id } = request.query;
            if (!id) return response.status(400).json({ message: 'Falta el ID del expediente.' });

            await db.collection('consents').doc(id).delete();
            await db.collection('consents_parejas').doc(id).delete();
            await db.collection('historias_clinicas').doc(id).delete();

            return response.status(200).json({ message: 'Expediente eliminado completamente.' });
        }

        return response.status(405).json({ message: 'Método o acción no soportada.' });

    } catch (error) {
        console.error("Error en el controlador maestro de consentimientos:", error);
        return response.status(500).json({ message: 'Error interno del servidor.', detail: error.message });
    }
}
