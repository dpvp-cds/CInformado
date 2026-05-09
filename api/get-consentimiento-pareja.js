import { db } from '../lib/firebaseAdmin.js';

export default async function handler(request, response) {
    if (request.method !== 'GET') {
        return response.status(405).json({ message: 'Método no permitido. Solo peticiones GET.' });
    }

    try {
        const { id } = request.query;
        
        if (!id) {
            return response.status(400).json({ message: 'El ID del expediente es requerido.' });
        }

        // Buscamos en la colección donde guardamos los consentimientos de parejas
        const docRef = db.collection('consents_parejas').doc(id);
        const doc = await docRef.get();

        if (!doc.exists) {
            return response.status(404).json({ message: 'Consentimiento de pareja no encontrado.' });
        }
        
        // Devolvemos los datos encontrados
        response.status(200).json({ id: doc.id, ...doc.data() });

    } catch (error) {
        console.error(`Error al obtener consentimiento de pareja ${request.query.id}:`, error);
        response.status(500).json({ 
            message: 'Error interno del servidor.',
            detail: error.message 
        });
    }
}
