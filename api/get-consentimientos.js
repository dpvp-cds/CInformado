import { db } from '../lib/firebaseAdmin.js';

export default async function handler(request, response) {
    if (request.method !== 'GET') {
        return response.status(405).json({ message: 'Método no permitido.' });
    }

    try {
        const snapshot = await db.collection('consents').orderBy('fecha', 'desc').get();
        
        if (snapshot.empty) {
            return response.status(200).json([]);
        }
        
        // --- INICIO DE LA MEJORA ---
        // Ahora el servidor determina el formato de visualización.
        const consentimientos = snapshot.docs.map(doc => {
            const data = doc.data();
            const esPareja = data.demograficos?.tipoTerapia === 'Pareja';

            if (esPareja) {
                // Si es pareja, construimos un nombre descriptivo.
                return {
                    id: doc.id,
                    nombre: `Pareja: ${data.demograficos.nombreCompleto1} y ${data.demograficos.nombreCompleto2}`,
                    email: data.demograficos.email1, // Usamos el email del primer miembro para la lista.
                    fecha: data.fecha,
                    tipo: 'Pareja' // Añadimos un tipo para que el frontend pueda reaccionar.
                };
            } else {
                // Si es individual, mantenemos el formato original.
                return {
                    id: doc.id,
                    nombre: data.demograficos.nombre,
                    email: data.demograficos.email,
                    fecha: data.fecha,
                    tipo: 'Individual'
                };
            }
        });
        // --- FIN DE LA MEJORA ---
        
        response.status(200).json(consentimientos);

    } catch (error) {
        console.error("Error al obtener los consentimientos:", error);
        response.status(500).json({ message: 'Error interno del servidor al obtener los documentos.' });
    }
}
