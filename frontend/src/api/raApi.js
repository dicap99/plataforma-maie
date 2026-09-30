import client, { descargar } from './client'

// Módulo 2: Resultados de Aprendizaje (RF-RA-01 a RF-RA-04)
export const listarResultados = () => client.get('/ra/resultados')
export const listarEstrategias = () => client.get('/ra/estrategias')

// Rúbricas: { niveles, ras: [{ id_ra, codigo, descripcion, suma_pesos, criterios }] }
export const listarRubricas = (ra) => client.get('/ra/rubricas', { params: { ra } })
export const guardarRubrica = (idRa, criterios) => client.put(`/ra/rubricas/${idRa}`, { criterios })

// Planilla de calificación de una oferta y registro por lotes (calificacion: null borra la nota)
export const planilla = (curso) => client.get('/ra/evaluaciones', { params: { curso } })
export const registrarCalificaciones = (idCurso, calificaciones) =>
  client.post('/ra/evaluaciones', { id_curso: idCurso, calificaciones })

// Apertura de la calificación por semestre académico (la controla Coordinación)
export const listarPeriodos = () => client.get('/ra/periodos')
export const cambiarPeriodo = (periodo, abierto) => client.put(`/ra/periodos/${periodo}`, { abierto })

// Reportes: agrupar = ra | curso | catalogo | modulo | cohorte | estudiante, más filtros combinables
export const reporteRA = (params) => client.get('/ra/reportes', { params })
export const exportarRA = (params) => descargar('/ra/reportes/exportar', params)
