import { db } from '../lib/firebaseAdmin.js';

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ message: 'Método no permitido. Solo peticiones POST.' });
    }

    try {
        const { pacienteId, perfilEjecutivo, propositoVida } = request.body;
        
        if (!pacienteId) {
            return response.status(400).json({ message: 'Falta el ID del paciente.' });
        }

        // Usamos merge: true para actualizar únicamente el perfil ejecutivo
        // sin borrar ni alterar la Sesión Cero, Plan de Trabajo o Evoluciones.
        const updateData = {
            perfilEjecutivo: perfilEjecutivo || '',
            propositoVida: propositoVida || '',
            ultimaActualizacionPerfil: new Date().toISOString()
        };

        await db.collection('historias_clinicas').doc(pacienteId).set(updateData, { merge: true });

        response.status(200).json({ message: 'Perfil ejecutivo y propósito guardados correctamente.' });

    } catch (error) {
        console.error("Error al guardar el perfil:", error);
        response.status(500).json({ message: 'Error interno del servidor.', detail: error.message });
    }
}
