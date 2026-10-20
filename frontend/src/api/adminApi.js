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

export const perfilDocentePropio = () => client.get('/admin/docentes/me/perfil')
export const actualizarPerfilDocentePropio = (datos) => client.put('/admin/docentes/me/perfil', datos)
// Cursos en los que participa el docente: { id_cohorte, periodo, id_clase }. Sin idDocente = el propio.
export const agregarCursoDocente = (datos, idDocente) => client.post(`/admin/docentes/${idDocente ?? 'me'}/cursos`, datos)
export const quitarCursoDocente = (idCurso, idDocente) => client.delete(`/admin/docentes/${idDocente ?? 'me'}/cursos/${idCurso}`)
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

// Hojas académicas con el reflejo de Gestión académica (cada fila con su origen: gestion | registro)
export const reflejoAcademico = () => client.get('/admin/academico/reflejo')
