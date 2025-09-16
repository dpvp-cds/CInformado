import { db } from '../lib/firebaseAdmin.js';

export default async function handler(request, response) {
    // 1. Verificamos que el método de la solicitud sea DELETE.
    if (request.method !== 'DELETE') {
        return response.status(405).json({ message: 'Método no permitido' });
    }

    // NOTA DE SEGURIDAD: En un futuro, aquí se debería verificar
    // que solo un consultor autenticado pueda hacer esta petición.

    try {
        // 2. Extraemos el ID del reporte de la URL.
        const { id } = request.query;
        if (!id) {
            return response.status(400).json({ message: 'El ID del reporte es requerido.' });
        }

        // 3. Damos la orden a Firestore de borrar el documento con ese ID de la colección 'reports'.
        await db.collection('reports').doc(id).delete();
        
        console.log(`Reporte con ID: ${id} eliminado exitosamente de la base de datos.`);
        
        // 4. Enviamos una respuesta de éxito de vuelta al portal para confirmar el borrado.
        response.status(200).json({ message: 'Reporte eliminado con éxito.' });

    } catch (error) {
        console.error(`Error al eliminar el reporte ${id}:`, error);
        response.status(500).json({ message: 'Error interno del servidor al eliminar el reporte.' });
    }
}
