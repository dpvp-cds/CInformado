import { db } from '../lib/firebaseAdmin.js';

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ message: 'Método no permitido. Solo POST.' });
    }

    try {
        const data = request.body;
        
        if (!data.pacienteId || !data.evoluciones) {
            return response.status(400).json({ message: 'Faltan datos de la evolución.' });
        }

        // Estructura de actualización. Usamos "merge: true" en Firebase 
        // para que solo actualice el historial y los strikes sin borrar la Sesión Cero.
        const updateData = {
            evoluciones: data.evoluciones,
            strikes: data.strikes || 0,
            ultimaEvolucion: new Date().toISOString()
        };

        await db.collection('historias_clinicas').doc(data.pacienteId).set(updateData, { merge: true });

        response.status(200).json({ message: 'Bitácora actualizada correctamente.' });

    } catch (error) {
        console.error("Error al guardar evolución:", error);
        response.status(500).json({ 
            message: 'Error interno del servidor.', 
            detail: error.message 
        });
    }
}
