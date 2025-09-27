import { db } from '../lib/firebaseAdmin.js';
import { Resend } from 'resend';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { Buffer } from 'buffer';

// --- CONFIGURACIÓN DE CORREO Y RUTAS ---
const CORREO_TERAPEUTA = 'caminosdelser@emcotic.com';
const WHATSAPP_TERAPEUTA = '+573233796547';
const FROM_EMAIL = 'Consentimiento <noreply@emcotic.com>'; // Remitente verificado en Resend

/**
 * Función que genera el PDF del Consentimiento Informado con la firma.
 * @param {object} datos El objeto de datos completo del formulario.
 * @returns {Promise<Uint8Array>} Los bytes del archivo PDF.
 */
async function crearPDF_Consentimiento(datos) {
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    // Convertir la firma de Base64 a imagen para incrustar
    let signatureImage = null;
    if (datos.firmaDigital) {
        try {
            const base64Data = datos.firmaDigital.split(',')[1];
            signatureImage = await pdfDoc.embedPng(base64Data);
        } catch (e) {
            console.warn("Error al incrustar la firma digital:", e);
        }
    }

    let y = height - 50;
    const margin = 50;
    const lineSpacing = 15;
    const titleSize = 18;
    const bodySize = 10;
    const maxWidth = width - 2 * margin;

    // Función auxiliar para dibujar texto con salto de línea
    const drawWrappedText = (text, x, y, size, maxWidth, page, font, lineHeight) => {
        const words = text.split(' ');
        let line = '';
        let currentY = y;
        
        for (let i = 0; i < words.length; i++) {
            const testLine = line + words[i] + ' ';
            const testWidth = font.widthOfText(testLine, size);
            
            if (testWidth > maxWidth && i > 0) {
                page.drawText(line, { x, y: currentY, size, font });
                currentY -= lineHeight;
                line = words[i] + ' ';
            } else {
                line = testLine;
            }
        }
        page.drawText(line, { x, y: currentY, size, font });
        return currentY - lineHeight; // Retorna la nueva posición Y
    };

    // Título Principal
    page.drawText('Consentimiento Informado para Atención Psicológica', { 
        x: margin, y, font: boldFont, size: titleSize, color: rgb(0, 0.2, 0.4) 
    });
    y -= 30;

    // --- SECCIÓN 1: DATOS DEL PACIENTE ---
    page.drawText('1. Datos del Paciente', { x: margin, y, font: boldFont, size: 12 });
    y -= lineSpacing;

    const nombre = datos.demograficos.nombreCompleto;
    const identificacion = datos.demograficos.numeroIdentificacion;
    const emailPaciente = datos.demograficos.email;
    const edad = datos.demograficos.edad;

    // Texto dinámico para el encabezado del consentimiento (igual que en el frontend)
    let displayText = '';
    if (edad < 18) {
        const acudiente = datos.adultoResponsable;
        displayText = `Yo, ${acudiente.nombre} con C.I. ${acudiente.documento}, actuando como acudiente en calidad de ${acudiente.tipo}, de ${nombre}, menor de edad, con C.I. ${identificacion}, manifiesto mi consentimiento libre, voluntario y consciente para que el (la) menor reciba servicios de psicología por parte de Jorge Arango Castaño, de acuerdo con los siguientes términos:`;
    } else {
        displayText = `Yo, ${nombre}, mayor de edad y con plenas facultades mentales, manifiesto mi consentimiento libre, voluntario y consciente para recibir servicios de psicología por parte de Jorge Arango Castaño, de acuerdo con los siguientes términos:`;
    }

    const patientInfo = [
        `Nombre completo del paciente: ${nombre}`,
        `Identificación: ${identificacion} (${datos.demograficos.tipoIdentificacion})`,
        `Edad: ${edad} años`,
        `Email: ${emailPaciente}`,
        `Fecha de Diligenciamiento: ${datos.demograficos.fechaDiligenciamiento}`,
    ];

    if (edad < 18) {
         patientInfo.push(`Acudiente: ${datos.adultoResponsable.nombre} (Rol: ${datos.adultoResponsable.tipo}, ID: ${datos.adultoResponsable.documento})`);
    }

    patientInfo.forEach(line => {
        page.drawText(line, { x: margin + 10, y, font, size: bodySize });
        y -= lineSpacing;
    });
    y -= lineSpacing;
    
    // --- SECCIÓN 2: TEXTO DE CONSENTIMIENTO ---
    page.drawText('2. Aceptación de Términos', { x: margin, y, font: boldFont, size: 12 });
    y -= lineSpacing;

    const textoConsentimiento = [
        { title: '2.1. Declaración Inicial', text: displayText },
        { title: '2.2. Confidencialidad y Secreto Profesional', adultText: 'Entiendo, acepto y soy consciente del trabajo profesional que realizará el psicólogo designado, y que este guardará una confidencialidad absoluta con el (la) paciente, la cual será inviolable, salvo que su integridad física se vea amenazada, y salvo los requerimientos de ley que así mismo pidan levantar la reserva profesional.', minorText: 'Entiendo, acepto y soy consciente del trabajo profesional que realizará el psicólogo designado, y que este guardará una confidencialidad absoluta con el (la) paciente menor de edad, la cual será inviolable, salvo que su integridad física se vea amenazada, y salvo los requerimientos de ley que así mismo pidan levantar la reserva profesional.' },
        { title: '2.3. Propósito de la Intervención', text: 'El objetivo de este proceso es la exploración y orientación en mi propósito y proyecto de vida, abordando las diversas áreas de mi existencia que puedan estar afectando mi bienestar psicológico y emocional. Se utilizarán técnicas de la psicología humanista-existencial y Programación Neurolingüística (PNL) para facilitar mi autodescubrimiento y crecimiento personal.' },
        { title: '2.4. Naturaleza del Proceso y Tareas', text: 'Soy consciente de que la terapia es un proyecto con un inicio y un fin, y que su éxito depende de mi compromiso y participación activa. Acepto la asignación de tareas inter-sesiones y entiendo que la falta de cumplimiento en repetidas ocasiones podría ser motivo para revisar el proceso, tal como se me ha explicado.' },
        { title: '2.5. Proceso de Evaluación', adultText: 'Autorizo que sean practicadas pruebas psicométricas y demás herramientas diagnósticas que el psicólogo designado así considere necesario, a fin de establecer cabal y puntualmente un diagnóstico asertivo sobre el motivo de consulta.', minorText: 'Autorizo que le sean practicadas pruebas psicométricas y demás herramientas diagnósticas que el psicólogo designado así considere necesario, a fin de establecer cabal y puntualmente un diagnóstico asertivo sobre el motivo de consulta del (la) paciente menor de edad en consulta.' },
        { title: '2.6. Costos económicos asociados al proceso terapéutico', adultText: 'Me comprometo a cubrir todos los gastos económicos en que se incurra con motivo de la atención que recibiré, habiendo recibido la información de forma clara y oportuna y habiendo tenido la oportunidad de aceptar o rechazar dichas atenciones psicológicas y los costos asociados.', minorText: 'Me comprometo como acudiente del (la) paciente menor de edad, a cubrir todos los gastos económicos en que se incurra con motivo de la atención que recibirá, habiendo recibido la información de forma clara y oportuna y habiendo tenido la oportunidad de aceptar o rechazar dichas atenciones psicológicas y los costos asociados.' },
        { title: '2.7. Tratamiento de Datos', text: 'Autorizo el tratamiento de mis datos personales y sensibles (incluida mi información de salud mental) de acuerdo con la Ley 1581 de 2012 y el Decreto 1377 de 2013, así como con la Política de Protección de Datos de Jorge Arango Castaño - Caminos del Ser. Estos datos serán utilizados exclusivamente para fines terapéuticos, de seguimiento y estadísticos anonimizados. Entiendo que puedo ejercer mis derechos de acceso, corrección, supresión y revocación de mi autorización en cualquier momento.' },
    ];
    
    const lineHeight = lineSpacing;

    textoConsentimiento.forEach(item => {
        // Manejo de salto de página si es necesario
        if (y < margin + 100) { 
            page = pdfDoc.addPage(); 
            y = height - margin; 
        }

        page.drawText(item.title, { x: margin + 5, y, font: boldFont, size: bodySize });
        y -= lineHeight;

        const textContent = (edad < 18 && item.minorText) ? item.minorText : item.adultText || item.text;
        y = drawWrappedText(textContent, margin + 10, y, bodySize - 1, maxWidth - 10, page, font, lineHeight - 2);
    });

    // --- SECCIÓN 3: FIRMA ---
    if (y < margin + 150) { 
        page = pdfDoc.addPage(); 
        y = height - margin; 
    }
    y -= 20;
    page.drawText('3. Firma Digital y Aceptación', { x: margin, y, font: boldFont, size: 12 });
    y -= lineSpacing;
    page.drawText('Al firmar digitalmente, el paciente y/o acudiente confirman la aceptación de los términos.', { x: margin + 10, y, font, size: bodySize });
    y -= lineSpacing;

    if (signatureImage) {
        const sigWidth = 300; 
        const sigHeight = 150;
        const sigX = margin + 10;
        const sigY = y - sigHeight - 10; 
        
        page.drawImage(signatureImage, {
            x: sigX, y: sigY,
            width: sigWidth,
            height: sigHeight,
        });
        
        // Línea de firma
        page.drawLine({
            start: { x: sigX, y: sigY - 5 },
            end: { x: sigX + sigWidth, y: sigY - 5 },
            thickness: 1,
            color: rgb(0.2, 0.2, 0.2),
        });
        
        y = sigY - 20;
    } else {
        page.drawText('No se encontró la firma digital.', { x: margin + 10, y, font, size: bodySize });
        y -= lineSpacing;
    }
    
    page.drawText('Firmado y Aceptado digitalmente el ' + datos.demograficos.fechaDiligenciamiento, { x: margin, y, font: boldFont, size: bodySize });
    y -= lineSpacing;
    
    return await pdfDoc.save();
}

// Main serverless function handler
export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ message: 'Método no permitido' });
    }

    try {
        const datosCompletos = request.body;
        console.log("Servidor: Recibiendo datos para consentimiento informado...");

        // 1. Validación de datos críticos
        if (!datosCompletos.demograficos || !datosCompletos.firmaDigital || !datosCompletos.demograficos.email) {
            return response.status(400).json({ message: 'Faltan datos críticos (demográficos, email o firma).' });
        }

        const emailPaciente = datosCompletos.demograficos.email;
        const nombrePaciente = datosCompletos.demograficos.nombreCompleto;
        const identificacion = datosCompletos.demograficos.numeroIdentificacion;
        
        // --- 2. CONFIGURACIÓN DE FIRESTORE ---
        const appId = 'cinformado';
        const userId = identificacion;

        const docRef = db.collection('artifacts').doc(appId)
                         .collection('users').doc(userId)
                         .collection('consents');

        const dataToSave = {
            ...datosCompletos,
            fechaRegistro: new Date().toISOString()
        };

        // Guardar el documento en Firestore
        const savedDocRef = await docRef.add(dataToSave);
        console.log(`Servidor: Consentimiento guardado en Firestore con ID: ${savedDocRef.id}`);


        // --- 3. GENERACIÓN DEL PDF ---
        const pdfBuffer = await crearPDF_Consentimiento(datosCompletos);
        console.log("Servidor: PDF creado exitosamente.");


        // --- 4. ENVÍO DE CORREOS (RESEND) ---
        const resendApiKey = process.env.RESEND2_API_KEY;
        if (!resendApiKey) {
            console.error("CRITICAL: La variable de entorno RESEND2_API_KEY no está definida.");
            // No detenemos la función, pero avisamos. El consentimiento ya está guardado.
        }
        const resend = new Resend(resendApiKey);

        const attachment = {
            filename: `Consentimiento-Arango-${identificacion}.pdf`,
            content: Buffer.from(pdfBuffer),
        };

        // 4.1. CORREO AL PACIENTE
        const subjectPaciente = `Copia de Consentimiento Informado - Jorge Arango Castaño`;
        const bodyPaciente = `Estimado ${nombrePaciente},<br><br>
            Recibes una copia del consentimiento informado para la atención psicológica con el Psicólogo Jorge Arango Castaño. Cualquier inquietud puedes hacerla al correo <a href="mailto:${CORREO_TERAPEUTA}">${CORREO_TERAPEUTA}</a> o al WhatsApp <a href="https://wa.me/${WHATSAPP_TERAPEUTA.replace('+', '')}">+${WHATSAPP_TERAPEUTA.replace('+', '')}</a>.<br><br>
            Adjunto, el PDF con la información de tu consentimiento.
        `;
        
        // Se añade un manejo básico de errores para el envío de Resend
        try {
            await resend.emails.send({
              from: FROM_EMAIL,
              to: emailPaciente,
              subject: subjectPaciente,
              html: bodyPaciente,
              attachments: [attachment],
            });
            console.log(`Servidor: Correo enviado al paciente: ${emailPaciente}`);
        } catch (error) {
             console.error(`Error al enviar correo al paciente ${emailPaciente}:`, error);
        }

        // 4.2. CORREO AL TERAPEUTA
        const subjectTerapeuta = `NUEVO CONSENTIMIENTO FIRMADO - ${nombrePaciente}`;
        const bodyTerapeuta = `Has recibido el consentimiento informado firmado del paciente ${nombrePaciente} (${identificacion}).<br><br>
        El documento ha sido guardado en Firestore y se adjunta para tu revisión inmediata.`;

        try {
            await resend.emails.send({
                from: FROM_EMAIL,
                to: CORREO_TERAPEUTA,
                subject: subjectTerapeuta,
                html: bodyTerapeuta,
                attachments: [attachment],
            });
            console.log("Servidor: Correo de notificación enviado al terapeuta.");
        } catch (error) {
             console.error(`Error al enviar correo al terapeuta ${CORREO_TERAPEUTA}:`, error);
        }


        // 5. Respuesta de éxito final
        response.status(200).json({ message: 'Consentimiento guardado y correos enviados.' });

    } catch (error) {
        console.error("Servidor: Error catastrófico en la función save-consent:", error);
        response.status(500).json({ message: 'Error interno del servidor', error: error.message });
    }
}
