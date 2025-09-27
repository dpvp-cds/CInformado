import { db } from '../lib/firebaseAdmin.js';

export default async function handler(request, response) {
    // 1. Verificar que el método sea DELETE.
    if (request.method !== 'DELETE') {
        return response.status(405).json({ message: 'Método no permitido.' });
    }

    try {
        // 2. Extraer el ID del documento de la URL.
        const { id } = request.query;
        if (!id) {
            return response.status(400).json({ message: 'El ID del consentimiento es requerido.' });
        }

        // 3. Apuntar al documento específico en la colección 'consents' y eliminarlo.
        await db.collection('consents').doc(id).delete();

        console.log(`Servidor: Consentimiento con ID: ${id} eliminado exitosamente.`);
        
        // 4. Enviar una respuesta de éxito.
        response.status(200).json({ message: 'Consentimiento eliminado exitosamente.' });

    } catch (error) {
        console.error(`Error al eliminar el consentimiento ${request.query.id}:`, error);
        response.status(500).json({ message: 'Error interno del servidor al eliminar el documento.' });
    }
}
