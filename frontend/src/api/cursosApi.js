import client from './client'

// Catálogo del plan de estudios y ofertas de curso por promoción (RF-ADM-01, RF-RA-02)
export const catalogo = () => client.get('/admin/cursos/catalogo')
export const listarOfertas = (params) => client.get('/admin/cursos', { params })
export const obtenerOferta = (id) => client.get(`/admin/cursos/${id}`)
export const crearOferta = (datos) => client.post('/admin/cursos', datos)
export const actualizarOferta = (id, datos) => client.put(`/admin/cursos/${id}`, datos)
export const eliminarOferta = (id) => client.delete(`/admin/cursos/${id}`)
export const inscribir = (id, estudiantes) => client.put(`/admin/cursos/${id}/estudiantes`, { estudiantes })
export const matricularCohorte = (id) => client.post(`/admin/cursos/${id}/estudiantes/cohorte`)

// Estudiantes de cada promoción
export const estudiantesCohorte = (id) => client.get(`/admin/cohortes/${id}/estudiantes`)
export const guardarEstudiantesCohorte = (id, estudiantes) => client.put(`/admin/cohortes/${id}/estudiantes`, { estudiantes })
