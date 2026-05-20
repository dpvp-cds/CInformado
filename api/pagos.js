import { db } from '../lib/firebaseAdmin.js';

export default async function handler(request, response) {
    // Solo permitimos peticiones de lectura (GET)
    if (request.method !== 'GET') {
        return response.status(405).json({ message: 'Método no permitido. Solo GET.' });
    }

    try {
        const patientsMap = {};
        
        // Ejecutamos las 3 lecturas a la base de datos al mismo tiempo para mayor velocidad
        const [indivSnap, parejaSnap, histSnap] = await Promise.all([
            db.collection('consents').get(),
            db.collection('consents_parejas').get(),
            db.collection('historias_clinicas').get()
        ]);

        // 1. Mapear nombres de pacientes individuales
        indivSnap.forEach(doc => {
            const data = doc.data();
            patientsMap[doc.id] = data.demograficos?.nombreCompleto || data.demograficos?.nombre || 'Paciente Sin Nombre';
        });

        // 2. Mapear nombres de pacientes de pareja
        parejaSnap.forEach(doc => {
            const data = doc.data();
            const n1 = data.paciente1?.nombreCompleto1 || data.paciente1?.nombre || 'Paciente 1';
            const n2 = data.paciente2?.nombreCompleto2 || data.paciente2?.nombre || 'Paciente 2';
            patientsMap[doc.id] = `${n1.split(' ')[0]} y ${n2.split(' ')[0]}`; // Usamos solo el primer nombre para que no quede tan largo
        });

        const pagosTotales = [];

        // 3. Extraer los pagos de las Historias Clínicas
        histSnap.forEach(doc => {
            const data = doc.data();
            const pacienteId = doc.id;
            const nombre = patientsMap[pacienteId] || 'Paciente sin registro demográfico';
            const pagosPaciente = [];

            // A. Revisar pago de la Sesión Cero (SOLO SI ESTÁ PAGADO)
            if (data.fechaSesionCero && data.valorSesionCero && Number(data.valorSesionCero) > 0 && data.pagadoSesionCero === true) {
                pagosPaciente.push({
                    fecha: data.fechaSesionCero,
                    valor: Number(data.valorSesionCero),
                    tipo: 'Sesión Cero'
                });
            }

            // B. Revisar pagos de la Bitácora de Evolución (SOLO SI ESTÁ PAGADO)
            if (data.evoluciones && Array.isArray(data.evoluciones)) {
                data.evoluciones.forEach(evo => {
                    if (evo.fecha && evo.valor && Number(evo.valor) > 0 && evo.pagado === true) {
                        pagosPaciente.push({
                            fecha: evo.fecha,
                            valor: Number(evo.valor),
                            tipo: 'Evolución'
                        });
                    }
                });
            }

            // Si este paciente tiene al menos 1 pago registrado, lo agregamos a la lista maestra
            if (pagosPaciente.length > 0) {
                pagosTotales.push({ pacienteId, nombre, pagos: pagosPaciente });
            }
        });

        // Enviar la lista maestra al Dashboard (portal-pagos.html)
        return response.status(200).json(pagosTotales);

    } catch (error) {
        console.error("Error en el controlador de pagos:", error);
        return response.status(500).json({ message: 'Error interno del servidor.', detail: error.message });
    }
}
