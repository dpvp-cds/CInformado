import { db } from '../lib/firebaseAdmin.js';
import { Resend } from 'resend';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { Buffer } from 'buffer';

// Helper function to create the DSME report PDF
async function crearPDF_DSME(datos) {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    let y = height - 50;

    // Title
    page.drawText('Reporte Preliminar - Escala DSME', { x: 50, y, font: boldFont, size: 22, color: rgb(0, 0.2, 0.4) });
    y -= 40;

    // Demographics
    page.drawText(`Nombre: ${datos.demograficos.nombre}`, { x: 50, y, font, size: 12 });
    y -= 20;
    page.drawText(`Email: ${datos.demograficos.email}`, { x: 50, y, font, size: 12 });
    y -= 20;
    page.drawText(`Empresa: ${datos.empresa.nombre}`, { x: 50, y, font, size: 12 });
    y -= 30;

    // Pillar Results
    page.drawText('Resultados de los Pilares:', { x: 50, y, font: boldFont, size: 16 });
    y -= 25;

    const pilarScores = datos.pilarScores; 
    const ismeScore = datos.ismeScore;
    const pilarNames = ["", "1. Resiliencia", "2. Vínculo Identitario", "3. Sostenibilidad", "4. Capital Social", "5. Psicología Financiera"];
    
    if (pilarScores) {
        for (const pilar in pilarScores) {
            page.drawText(`${pilarNames[pilar]}: ${pilarScores[pilar]} / 35`, { x: 70, y, font, size: 12 });
            y -= 20;
        }
    }
    y -= 10;
    
    // Global Score (ISME)
    page.drawText('Resultado Global (ISME):', { x: 50, y, font: boldFont, size: 16 });
    y -= 25;
    if (ismeScore !== undefined) {
        page.drawText(`${ismeScore.toFixed(2)} / 100`, { x: 70, y, font: boldFont, size: 14, color: rgb(0, 0.2, 0.4) });
    }

    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
}

// Main serverless function handler
export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ message: 'Método no permitido' });
    }

    try {
        const datosCompletos = request.body;
        console.log("Servidor: Recibiendo datos para reporte DSME...");

        // 1. Save data to Firestore
        const dataToSave = { ...datosCompletos, fecha: new Date().toISOString() };
        // We use the 'reports' collection name defined in our security rules
        const docRef = await db.collection('reports').add(dataToSave);
        console.log("Servidor: Datos guardados en Firestore con ID:", docRef.id);

        // 2. Create the PDF
        const pdfBuffer = await crearPDF_DSME(datosCompletos);
        console.log("Servidor: PDF creado exitosamente.");

        // 3. Send email using Resend
        const resendApiKey = process.env.RESEND2_API_KEY;
        if (!resendApiKey) {
            throw new Error("La variable de entorno RESEND2_API_KEY no está definida.");
        }
        const resend = new Resend(resendApiKey);
        
        const { data, error } = await resend.emails.send({
          from: 'Reporte DSME <noreply@emcotic.com>',
          to: 'dpvp.cds@emcotic.com',
          subject: `Nuevo Reporte DSME - ${datosCompletos.demograficos.nombre}`,
          html: `<h1>Nuevo Reporte de la Escala DSME</h1><p>Se ha completado un nuevo diagnóstico.</p><p><strong>Nombre:</strong> ${datosCompletos.demograficos.nombre}</p><p><strong>Email:</strong> ${datosCompletos.demograficos.email}</p><p>El reporte completo se encuentra adjunto en formato PDF.</p>`,
          attachments: [
            {
              filename: `Reporte-DSME-${docRef.id}.pdf`,
              content: Buffer.from(pdfBuffer),
            },
          ],
        });

        if (error) {
            console.error("Servidor: Error de Resend:", error);
            throw new Error(error.message);
        }

        console.log("Servidor: Correo enviado. ID de envío:", data.id);
        response.status(200).json({ message: 'Reporte guardado y correo enviado', id: docRef.id });

    } catch (error) {
        console.error("Servidor: Error catastrófico en la función:", error);
        response.status(500).json({ message: 'Error interno del servidor', error: error.message });
    }
}


