import client, { descargar } from './client'

// Módulo 3: Evaluación Docente (Acuerdo 058 de 2022)

// Instrumentos y matriz de quién evalúa a quién
export const formulario = (tipo) => client.get(`/eval-docente/formularios/${tipo}`)
export const categorizacion = () => client.get('/eval-docente/categorizacion')

// Formularios que le corresponden al usuario en los semestres habilitados
export const pendientes = () => client.get('/eval-docente/pendientes')
// { periodo, tipo, id_docente, id_cohorte?, respuestas: { id_pregunta: valor }, comentario? }
export const enviarRespuesta = (respuesta) => client.post('/eval-docente/respuestas', respuesta)
// EC o AE guardada (el EE es anónimo y no se puede consultar)
export const respuestaPropia = (params) => client.get('/eval-docente/respuestas/propia', { params })

// Habilitación por semestre (Coordinación)
export const listarPeriodos = () => client.get('/eval-docente/periodos')
export const guardarPeriodo = (periodo, datos) => client.put(`/eval-docente/periodos/${periodo}`, datos)
export const publicarPeriodo = (periodo, publicado) => client.post(`/eval-docente/periodos/${periodo}/publicacion`, { publicado })

// Resultados: poblacion = todas | posgrado | pregrado
export const resultados = (params) => client.get('/eval-docente/resultados', { params })
export const exportarResultados = (params) => descargar('/eval-docente/resultados/exportar', params)
export const informePdf = (params) => descargar('/eval-docente/resultados/informe.pdf', params)
export const resultadosDocente = (idDocente) => client.get(`/eval-docente/resultados/docentes/${idDocente}`)
export const informeDocentePdf = (idDocente) => descargar(`/eval-docente/resultados/docentes/${idDocente}/informe.pdf`)
export const resultadosPropios = () => client.get('/eval-docente/resultados/me')
export const informePropioPdf = () => descargar('/eval-docente/resultados/me/informe.pdf')

// Estudiantes de pregrado por oferta
export const listarPregrado = (periodo) => client.get('/eval-docente/pregrado', { params: { periodo } })
export const plantillaPregrado = (periodo) => descargar('/eval-docente/pregrado/plantilla', { periodo })
export const importarPregrado = (archivo, simular) => {
  const form = new FormData()
  form.append('archivo', archivo)
  return client.post('/eval-docente/pregrado/importar', form, { params: { simular } })
}
export const estadoPregrado = (idCurso, idEstudiante, estado) => client.put(`/eval-docente/pregrado/${idCurso}/${idEstudiante}`, { estado })
export const quitarPregrado = (idCurso, idEstudiante) => client.delete(`/eval-docente/pregrado/${idCurso}/${idEstudiante}`)
