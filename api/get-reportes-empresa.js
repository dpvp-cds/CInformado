import { db } from '../lib/firebaseAdmin.js';

export default async function handler(request, response) {
    // 1. Verificamos que la solicitud sea para OBTENER datos (GET).
    if (request.method !== 'GET') {
        return response.status(405).json({ message: 'Método no permitido' });
    }

    // NOTA DE SEGURIDAD: En un futuro, aquí se debería verificar que solo un consultor autenticado pueda hacer esta petición.

    try {
        // 2. Usamos nuestra conexión 'db' para pedir la colección 'reports' y la ordenamos por fecha.
        const snapshot = await db.collection('reports').orderBy('fecha', 'desc').get();
        
        // 3. Si no hay ningún reporte, devolvemos una lista vacía.
        if (snapshot.empty) {
            return response.status(200).json([]);
        }
        
        // 4. Transformamos los datos de Firebase a un formato limpio que el portal-empresa.html pueda entender.
        const reportes = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                nombre: data.demograficos.nombre, // Extraemos el nombre del participante
                empresa: data.empresa.nombre,     // Extraemos el nombre de la empresa
                fecha: data.fecha // La fecha ya está en formato ISO string
            };
        });
        
        // 5. Enviamos la lista de reportes de vuelta al portal con una respuesta exitosa.
        response.status(200).json(reportes);

    } catch (error) {
        console.error("Error al obtener los reportes de empresa:", error);
        response.status(500).json({ message: 'Error interno del servidor al obtener reportes.' });
    }
}
