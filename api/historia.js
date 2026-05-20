import { db } from '../lib/firebaseAdmin.js';

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ message: 'Método no permitido. Solo se aceptan peticiones POST.' });
    }

    try {
        const data = request.body;
        
        if (!data.pacienteId || !data.motivoConsulta) {
            return response.status(400).json({ message: 'Faltan datos críticos.' });
        }

        const serverTimestamp = new Date().toISOString();

        const historiaData = {
            pacienteId: data.pacienteId,
            
            // NUEVO: Guardado del valor de la sesión cero y si ya fue pagado
            valorSesionCero: data.valorSesionCero || 0,
            pagadoSesionCero: data.pagadoSesionCero || false,
            
            contextoVital: {
                ocupacion: data.ocupacion || '',
                convivencia: data.convivencia || '',
                hobbies: data.hobbies || '',
                noHobbies: data.noHobbies || '',
                antecedentesMedicos: data.antecedentesMedicos || ''
            },
            
            halcon: {
                motivoConsulta: data.motivoConsulta,
                habilidades: data.habilidades || '',
                aspiracion: data.aspiracion || '',
                creencias: data.creencias || '',
                construccion: data.construccion || '',
                orientacion: data.orientacion || '',
                nutricion: data.nutricion || ''
            },

            cierreSesionCero: data.cierreSesionCero || '',
            acuerdoStrikes: data.acuerdoStrikes || false,
            fechaCreacionSesionCero: serverTimestamp,
            ultimaActualizacion: serverTimestamp
        };

        await db.collection('historias_clinicas').doc(data.pacienteId).set(historiaData, { merge: true });

        response.status(200).json({ message: 'Sesión Cero guardada.', historiaId: data.pacienteId });

    } catch (error) {
        console.error("Error al guardar la historia clínica:", error);
        response.status(500).json({ message: 'Error interno del servidor.', detail: error.message });
    }
}
