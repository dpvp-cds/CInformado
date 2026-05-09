import { db } from '../lib/firebaseAdmin.js';

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ message: 'Método no permitido. Solo POST.' });
    }

    try {
        const data = request.body;
        
        if (!data.pacienteId || !data.planTrabajo) {
            return response.status(400).json({ message: 'Faltan datos del plan de trabajo.' });
        }

        // Estructura de actualización. Usamos "merge: true" para añadir 
        // el plan de trabajo a la historia clínica existente sin borrar la Sesión Cero ni la Bitácora.
        const updateData = {
            planTrabajo: data.planTrabajo,
            ultimaActualizacionPlan: new Date().toISOString()
        };

        await db.collection('historias_clinicas').doc(data.pacienteId).set(updateData, { merge: true });

        response.status(200).json({ message: 'Plan de trabajo actualizado correctamente.' });

    } catch (error) {
        console.error("Error al guardar el plan de trabajo:", error);
        response.status(500).json({ 
            message: 'Error interno del servidor al guardar el plan.', 
            detail: error.message 
        });
    }
}
