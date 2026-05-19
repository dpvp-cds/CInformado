import { db } from '../lib/firebaseAdmin.js';

export default async function handler(request, response) {
    // Detectamos la acción mediante el parámetro ?action= en la URL
    const { action, id } = request.query;

    try {
        // --- ADVERTENCIA DE SEGURIDAD ---
        if (request.method === 'GET') {
            // Reemplaza por completo a: get-historia.js
            if (!id) return response.status(400).json({ message: 'Falta el ID del paciente.' });
            
            const doc = await db.collection('historias_clinicas').doc(id).get();
            if (!doc.exists) {
                return response.status(200).json({ isNew: true });
            }
            return response.status(200).json(doc.data());
        }

        if (request.method === 'POST') {
            const data = request.body;

            switch (action) {
                case 'saveHistoria':
                    // Reemplaza por completo a: save-historia.js
                    if (!data.pacienteId) return response.status(400).json({ message: 'Falta ID.' });
                    const historiaData = {
                        fechaSesionCero: data.fechaSesionCero,
                        contextoVital: {
                            ocupacion: data.ocupacion,
                            convivencia: data.convivencia,
                            hobbies: data.hobbies,
                            noHobbies: data.noHobbies,
                            antecedentesMedicos: data.antecedentesMedicos
                        },
                        halcon: {
                            motivoConsulta: data.motivoConsulta,
                            habilidades: data.habilidades,
                            aspiracion: data.aspiracion,
                            creencias: data.creencias,
                            construccion: data.construccion,
                            orientacion: data.orientacion,
                            nutricion: data.nutricion
                        },
                        cierreSesionCero: data.cierreSesionCero,
                        acuerdoStrikes: data.acuerdoStrikes,
                        ultimaActualizacion: new Date().toISOString()
                    };
                    await db.collection('historias_clinicas').doc(data.pacienteId).set(historiaData, { merge: true });
                    return response.status(200).json({ message: 'Sesión Cero guardada.' });

                case 'savePlan':
                    // Reemplaza por completo a: save-plan.js
                    if (!data.pacienteId) return response.status(400).json({ message: 'Falta ID.' });
                    await db.collection('historias_clinicas').doc(data.pacienteId).set({
                        planTrabajo: data.planTrabajo,
                        ultimaActualizacionPlan: new Date().toISOString()
                    }, { merge: true });
                    return response.status(200).json({ message: 'Plan de trabajo guardado.' });

                case 'saveEvolucion':
                    // Reemplaza por completo a: save-evolucion.js
                    if (!data.pacienteId) return response.status(400).json({ message: 'Falta ID.' });
                    await db.collection('historias_clinicas').doc(data.pacienteId).set({
                        evoluciones: data.evoluciones,
                        strikes: data.strikes,
                        ultimaActualizacionEvo: new Date().toISOString()
                    }, { merge: true });
                    return response.status(200).json({ message: 'Bitácora guardada.' });

                case 'savePerfil':
                    // Reemplaza por completo a: save-perfil.js (Nuestra última actualización)
                    if (!data.pacienteId) return response.status(400).json({ message: 'Falta ID.' });
                    await db.collection('historias_clinicas').doc(data.pacienteId).set({
                        perfilEjecutivo: data.perfilEjecutivo || '',
                        propositoVida: data.propositoVida || '',
                        ultimaActualizacionPerfil: new Date().toISOString()
                    }, { merge: true });
                    return response.status(200).json({ message: 'Perfil y propósito guardados.' });

                default:
                    return response.status(400).json({ message: 'Acción POST no reconocida.' });
            }
        }

        return response.status(405).json({ message: 'Método no soportado.' });

    } catch (error) {
        console.error("Error en controlador de historia:", error);
        return response.status(500).json({ message: 'Error interno del servidor.', detail: error.message });
    }
}
