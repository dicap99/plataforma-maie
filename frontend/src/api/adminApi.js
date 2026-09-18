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

// opciones: { simular, recurso } — recurso solo aplica a CSV
export const importarArchivo = (archivo, opciones = {}) => {
  const form = new FormData()
  form.append('archivo', archivo)
  return client.post('/admin/importaciones', form, { params: opciones })
}

// conDatos=true exporta los datos actuales en el formato de la plantilla
export const descargarPlantilla = (conDatos = false) =>
  descargar('/admin/plantillas', conDatos ? { datos: true } : undefined)
