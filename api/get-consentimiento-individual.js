import { db } from '../lib/firebaseAdmin.js';

export default async function handler(request, response) {
    // Punto de Control 1: Verificamos que la función se inició.
    console.log('[DEBUG] Iniciando get-consentimiento-individual...');

    if (request.method !== 'GET') {
        return response.status(405).json({ message: 'Método no permitido.' });
    }

    try {
        const { id } = request.query;
        
        // Punto de Control 2: Verificamos el ID recibido.
        console.log(`[DEBUG] ID de consentimiento recibido: ${id}`);

        if (!id) {
            console.error('[DEBUG] Error: No se proporcionó ID.');
            return response.status(400).json({ message: 'El ID del consentimiento es requerido.' });
        }

        const docRef = db.collection('consents').doc(id);
        
        // Punto de Control 3: Justo antes de consultar Firebase.
        console.log(`[DEBUG] Consultando Firebase para el documento: ${id}`);
        
        const doc = await docRef.get();
        
        // Punto de Control 4: Después de recibir respuesta de Firebase.
        console.log(`[DEBUG] Respuesta de Firebase recibida. ¿Documento existe?: ${doc.exists}`);

        if (!doc.exists) {
            return response.status(404).json({ message: 'Consentimiento no encontrado.' });
        }
        
        const responseData = {
            id: doc.id,
            ...doc.data()
        };

        // Punto de Control 5: A punto de enviar la respuesta exitosa.
        console.log(`[DEBUG] Documento encontrado. Enviando datos al cliente.`);
        response.status(200).json(responseData);

    } catch (error) {
        // Punto de Control 6: Si ocurre un error en cualquier parte del 'try'.
        console.error(`[DEBUG] Error catastrófico en el servidor:`, error);
        response.status(500).json({ message: 'Error interno del servidor.', detail: error.message });
    }
}
