import client from './client'

// Módulo 3: Evaluación Docente (Acuerdo 058)
export const periodoActivo = () => client.get('/eval-docente/periodos/activo')
export const obtenerFormulario = (tipo) => client.get(`/eval-docente/formularios/${tipo}`)
export const enviarRespuesta = (respuesta) => client.post('/eval-docente/respuestas', respuesta)
export const resultadosPropios = () => client.get('/eval-docente/resultados/me')
export const resultadosDocente = (docenteId) => client.get(`/eval-docente/resultados/${docenteId}`)
