import { db } from '../lib/firebaseAdmin.js';

export default async function handler(request, response) {
    // 1. Verificamos que la solicitud sea para OBTENER datos (GET).
    if (request.method !== 'GET') {
        return response.status(405).json({ message: 'Método no permitido' });
    }

    // NOTA DE SEGURIDAD: Aquí también se podría verificar la autenticación del consultor.

    try {
        // 2. Extraemos el ID del reporte que nos pide el navegador desde la URL.
        const { id } = request.query;
        if (!id) {
            return response.status(400).json({ message: 'El ID del reporte es requerido.' });
        }

        // 3. Buscamos el documento exacto con ese ID en nuestra colección 'reports'.
        const docRef = db.collection('reports').doc(id);
        const doc = await docRef.get();

        // 4. Si el documento no existe en la base de datos, devolvemos un error.
        if (!doc.exists) {
            return response.status(404).json({ message: 'Reporte no encontrado.' });
        }
        
        // 5. Si lo encontramos, preparamos los datos para enviarlos de vuelta.
        const responseData = {
            id: doc.id,
            ...doc.data()
        };

        // 6. Enviamos el reporte completo a la página reporte-empresa.html.
        response.status(200).json(responseData);

    } catch (error) {
        console.error(`Error al obtener el reporte individual ${id}:`, error);
        response.status(500).json({ message: 'Error interno del servidor.' });
    }
}
