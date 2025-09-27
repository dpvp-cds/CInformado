import { db } from '../lib/firebaseAdmin.js';

export default async function handler(request, response) {
    // 1. Verificamos que sea una solicitud para OBTENER datos.
    if (request.method !== 'GET') {
        return response.status(405).json({ message: 'Método no permitido.' });
    }

    // NOTA DE SEGURIDAD: En un futuro, aquí se podría verificar que solo un consultor autenticado pueda hacer esta petición.
    // Por ahora, la seguridad está en la página del portal.

    try {
        // 2. Pedimos la colección 'consents' y la ordenamos por fecha descendente.
        const snapshot = await db.collection('consents').orderBy('fecha', 'desc').get();
        
        // 3. Si no hay documentos, devolvemos una lista vacía.
        if (snapshot.empty) {
            return response.status(200).json([]);
        }
        
        // 4. Transformamos los datos a un formato limpio que el portal pueda entender.
        const consentimientos = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                nombre: data.demograficos.nombre,
                email: data.demograficos.email,
                fecha: data.fecha
            };
        });
        
        // 5. Enviamos la lista de consentimientos de vuelta al portal.
        response.status(200).json(consentimientos);

    } catch (error) {
        console.error("Error al obtener los consentimientos:", error);
        response.status(500).json({ message: 'Error interno del servidor al obtener los documentos.' });
    }
}
