import { db } from '../lib/firebaseAdmin.js';

export default async function handler(request, response) {
    // 1. Verificación de Método de Seguridad
    if (request.method !== 'POST') {
        return response.status(405).json({ message: 'Método no permitido. Solo se aceptan peticiones POST.' });
    }

    try {
        const data = request.body;
        
        // 2. Validación de Datos Críticos (Backend Check)
        if (!data.pacienteId || !data.motivoConsulta) {
            return response.status(400).json({ message: 'Faltan datos críticos: pacienteId y motivoConsulta son obligatorios.' });
        }

        // 3. Generación del Sello de Tiempo (Timestamp) en el Servidor
        const serverTimestamp = new Date().toISOString();

        // 4. Estructuración Limpia de los Datos
        const historiaData = {
            pacienteId: data.pacienteId,
            
            // Bloque 1: Contexto Vital
            contextoVital: {
                ocupacion: data.ocupacion || '',
                convivencia: data.convivencia || '',
                hobbies: data.hobbies || '',
                noHobbies: data.noHobbies || '',
                antecedentesMedicos: data.antecedentesMedicos || ''
            },
            
            // Bloque 2: Método HALCÓN (Sesión Cero)
            halcon: {
                motivoConsulta: data.motivoConsulta,
                habilidades: data.habilidades || '',
                aspiracion: data.aspiracion || '',
                creencias: data.creencias || '',
                construccion: data.construccion || '',
                orientacion: data.orientacion || '',
                nutricion: data.nutricion || ''
            },

            // NUEVO: Cierre de Sesión Cero
            cierreSesionCero: data.cierreSesionCero || '',
            
            // Bloque 3: Acuerdos y Seguimiento
            acuerdoStrikes: data.acuerdoStrikes || false,
            
            // Metadatos de Auditoría
            fechaCreacionSesionCero: serverTimestamp,
            ultimaActualizacion: serverTimestamp
        };

        // 5. Guardado en la Base de Datos
        await db.collection('historias_clinicas').doc(data.pacienteId).set(historiaData, { merge: true });

        // 6. Respuesta de Éxito
        response.status(200).json({ 
            message: 'Sesión Cero guardada y sellada correctamente.',
            historiaId: data.pacienteId,
            timestamp: serverTimestamp
        });

    } catch (error) {
        console.error("Error crítico al guardar la historia clínica:", error);
        response.status(500).json({ 
            message: 'Error interno del servidor al intentar guardar la historia.', 
            detail: error.message 
        });
    }
}
