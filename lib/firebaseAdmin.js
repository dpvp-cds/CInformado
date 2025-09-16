import admin from 'firebase-admin';
import { Buffer } from 'buffer';

// Esta función asegura que la inicialización de Firebase ocurra solo una vez.
function initializeFirebaseAdmin() {
    // Si ya hay una app de Firebase inicializada, la retornamos para no crear duplicados.
    if (admin.apps.length) {
        return admin.app();
    }

    // Leemos la variable de entorno que contiene la llave en Base64.
    const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
    if (!serviceAccountBase64) {
        console.error("CRITICAL: La variable de entorno FIREBASE_SERVICE_ACCOUNT_BASE64 no está definida en Vercel.");
        throw new Error('La configuración del servidor de Firebase no está completa.');
    }
    
    try {
        // Decodificamos la clave desde Base64 para que Firebase pueda leerla.
        const serviceAccountJson = Buffer.from(serviceAccountBase64, 'base64').toString('utf-8');
        const serviceAccount = JSON.parse(serviceAccountJson);

        // Inicializamos la app con las credenciales.
        return admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } catch (error) {
        console.error("Error al decodificar FIREBASE_SERVICE_ACCOUNT_BASE64:", error);
        throw new Error('La llave de la cuenta de servicio de Firebase está malformada.');
    }
}

// Inicializamos la app y exportamos la instancia de Firestore.
initializeFirebaseAdmin();
const db = admin.firestore();

export { db };
