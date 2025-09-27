import { db } from '../lib/firebaseAdmin.js';

export default async function handler(request, response) {
    if (request.method !== 'GET') {
        return response.status(405).json({ message: 'Método no permitido.' });
    }

    try {
        // 1. Extraer el ID del documento de la URL.
        const { id } = request.query;
        if (!id) {
            return response.status(400).json({ message: 'El ID del consentimiento es requerido.' });
        }

        // 2. Apuntar al documento exacto y obtener sus datos.
        const docRef = db.collection('consents').doc(id);
        const doc = await docRef.get();

        // 3. Verificar si el documento existe.
        if (!doc.exists) {
            return response.status(404).json({ message: 'Consentimiento no encontrado.' });
        }
        
        // 4. Si existe, enviar todos los datos del documento de vuelta.
        const responseData = {
            id: doc.id,
            ...doc.data()
        };
        response.status(200).json(responseData);

    } catch (error) {
        console.error(`Error al obtener el consentimiento individual ${request.query.id}:`, error);
        response.status(500).json({ message: 'Error interno del servidor.' });
    }
}
