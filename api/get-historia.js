import { db } from '../lib/firebaseAdmin.js';

export default async function handler(request, response) {
    // 1. Verificación de Método de Seguridad
    if (request.method !== 'GET') {
        return response.status(405).json({ message: 'Método no permitido. Solo se aceptan peticiones GET.' });
    }

    try {
        // 2. Extraer el ID del paciente de los parámetros de la URL (?id=...)
        const { id } = request.query;
        
        if (!id) {
            return response.status(400).json({ message: 'El ID del paciente es requerido para buscar su historia clínica.' });
        }

        // 3. Buscar el documento en la colección 'historias_clinicas'
        const docRef = db.collection('historias_clinicas').doc(id);
        const doc = await docRef.get();

        // 4. Lógica de Respuesta
        if (!doc.exists) {
            // No es un error crítico, simplemente significa que el paciente es nuevo
            // y aún no se le ha hecho la "Sesión Cero".
            return response.status(404).json({ 
                message: 'Historia clínica no encontrada. El paciente es nuevo.',
                isNew: true 
            });
        }
        
        // 5. Si existe, devolvemos los datos estructurados (Contexto Vital, HALCÓN, etc.)
        const historiaData = {
            id: doc.id,
            ...doc.data()
        };
        
        response.status(200).json(historiaData);

    } catch (error) {
        console.error(`Error crítico al obtener la historia clínica ${request.query.id}:`, error);
        response.status(500).json({ 
            message: 'Error interno del servidor al intentar leer la base de datos.',
            detail: error.message 
        });
    }
}
