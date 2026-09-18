import client from './client'

// Módulo 2: Resultados de Aprendizaje
export const listarResultados = () => client.get('/ra/resultados')
export const listarEstrategias = () => client.get('/ra/estrategias')
export const listarRubricas = (ra) => client.get('/ra/rubricas', { params: { ra } })
export const listarEvaluaciones = (curso) => client.get('/ra/evaluaciones', { params: { curso } })
export const registrarEvaluaciones = (lote) => client.post('/ra/evaluaciones', lote)

// nivel: estudiante | curso | modulo | cohorte | programa
export const reporteRA = (params) => client.get('/ra/reportes', { params })
