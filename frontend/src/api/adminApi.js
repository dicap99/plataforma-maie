import client from './client'

// Módulo 1: Procesos Administrativos
export const listarCohortes = () => client.get('/admin/cohortes')
export const listarCursos = () => client.get('/admin/cursos')
export const resumenPresupuesto = () => client.get('/admin/presupuesto/resumen')
export const estadisticas = () => client.get('/admin/reportes/estadisticas')
export const perfilDocentePropio = () => client.get('/admin/docentes/me/perfil')

export const importarArchivo = (tipo, archivo) => {
  const form = new FormData()
  form.append('archivo', archivo)
  return client.post('/admin/importaciones', form, { params: { tipo } })
}

export const descargarPlantilla = (tipo) =>
  client.get(`/admin/plantillas/${tipo}`, { responseType: 'blob' })
