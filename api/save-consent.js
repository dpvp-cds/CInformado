import { db } from '../lib/firebaseAdmin.js'; // Importa la instancia de Firestore ya inicializada
import { Buffer } from 'buffer';

export default async function handler(request, response) {
    // 1. Verificar el método HTTP. Solo se acepta POST.
    if (request.method !== 'POST') {
        return response.status(405).json({ message: 'Método no permitido. Use POST.' });
    }

    try {
        const datosCompletos = request.body;
        
        // 2. Validación básica de datos críticos
        if (!datosCompletos.demograficos || !datosCompletos.firmaDigital) {
            return response.status(400).json({ message: 'Faltan datos de paciente o la firma digital es inválida.' });
        }

        // 3. Obtener el ID de usuario (simulación de un ID seguro)
        // En una aplicación real, este ID vendría de Firebase Auth,
        // pero aquí lo generamos o lo tomamos del documento para cumplir con la ruta de Firestore.
        // Usaremos el número de identificación del paciente como una base para la unicidad,
        // aunque no es un ID de Firebase Auth.
        const identificacion = datosCompletos.demograficos.numeroIdentificacion;
        
        // La estructura en Firestore es: /artifacts/{appId}/users/{userId}/consents/{documentId}
        const appId = 'cinformado'; // Usamos el ID que definiste
        const userId = identificacion; // Usamos el documento como base para el userId

        // 4. Preparar el documento para guardar
        const dataToSave = {
            ...datosCompletos,
            // Aseguramos que la fecha del servidor sea la final para el registro
            fechaRegistro: new Date().toISOString() 
        };

        // 5. Guardar el documento en Firestore
        // La ruta completa será: artifacts/cinformado/users/{identificacion}/consents
        const docRef = db.collection('artifacts').doc(appId)
                         .collection('users').doc(userId)
                         .collection('consents');

        // Firestore asignará un ID único al documento dentro de la subcolección 'consents'
        await docRef.add(dataToSave);
        
        console.log(`Consentimiento guardado para ID: ${userId}`);

        // 6. Respuesta de éxito
        response.status(200).json({ message: 'Consentimiento guardado exitosamente.' });

    } catch (error) {
        console.error("Error al guardar el consentimiento en Firestore:", error);
        response.status(500).json({ message: 'Error interno del servidor al guardar el consentimiento.', error: error.message });
    }
}
