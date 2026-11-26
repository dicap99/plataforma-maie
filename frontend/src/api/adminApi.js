import client, { descargar } from './client'

// Módulo 1: Procesos Administrativos
const rutaLlave = (recurso, fila) => recurso.llave.map((k) => encodeURIComponent(fila[k])).join('/')

export const listarRecursos = () => client.get('/admin/recursos')
export const listar = (recursoId) => client.get(`/admin/${recursoId}`)
export const crear = (recurso, datos) => client.post(`/admin/${recurso.id}`, datos)
export const actualizar = (recurso, fila, datos) => client.put(`/admin/${recurso.id}/${rutaLlave(recurso, fila)}`, datos)
export const eliminar = (recurso, fila) => client.delete(`/admin/${recurso.id}/${rutaLlave(recurso, fila)}`)

export const estadisticas = () => client.get('/admin/reportes/estadisticas')
export const resumenPresupuesto = () => client.get('/admin/presupuesto/resumen')

// El docente solo consulta su perfil; Coordinación registra sus cursos: { id_cohorte, periodo, id_clase }.
export const perfilDocentePropio = () => client.get('/admin/docentes/me/perfil')
export const agregarCursoDocente = (datos, idDocente) => client.post(`/admin/docentes/${idDocente}/cursos`, datos)
export const quitarCursoDocente = (idCurso, idDocente) => client.delete(`/admin/docentes/${idDocente}/cursos/${idCurso}`)
export const perfilDocente = (idDocente) => client.get(`/admin/docentes/${idDocente}/perfil`)

// opciones: { simular, recurso } — recurso solo aplica a CSV
export const importarArchivo = (archivo, opciones = {}) => {
  const form = new FormData()
  form.append('archivo', archivo)
  return client.post('/admin/importaciones', form, { params: opciones })
}

// conDatos=true exporta los datos actuales en el formato de la plantilla
export const descargarPlantilla = (conDatos = false) =>
  descargar('/admin/plantillas', conDatos ? { datos: true } : undefined)
export const exportarRecurso = (recursoId) => descargar(`/admin/exportar/${recursoId}`)

// Matrícula financiera por estudiante (posgrado y pregrado)
export const listarMatriculasFinancieras = (params) => client.get('/admin/matriculas-financieras', { params })
export const guardarMatriculaFinanciera = (datos) => client.put('/admin/matriculas-financieras', datos)
export const eliminarMatriculaFinanciera = (id) => client.delete(`/admin/matriculas-financieras/${id}`)
export const exportarMatriculasFinancieras = (params) => descargar('/admin/matriculas-financieras/exportar', params)

// Hojas académicas con el reflejo de Gestión académica (cada fila con su origen: gestion | registro)
export const reflejoAcademico = () => client.get('/admin/academico/reflejo')
// Hojas financieras con su reflejo («Contrataciones» calculada con los «Contratos OPS»), solo Coordinación.
export const reflejoFinanciero = () => client.get('/admin/finanzas/reflejo')
// Estudiantes registrados que participaron en un producto de investigación (Investigación y movilidad).
export const estudiantesDeProducto = (idProducto) => client.get(`/admin/productos/${idProducto}/estudiantes`)
export const vincularEstudiantes = (idProducto, estudiantes) => client.put(`/admin/productos/${idProducto}/estudiantes`, { estudiantes })
