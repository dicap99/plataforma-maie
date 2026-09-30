import client from './client'

// Catálogo del plan de estudios, clases y ofertas por semestre y promoción (RF-ADM-01, RF-RA-02)
export const catalogo = () => client.get('/admin/cursos/catalogo')
// Clases con identificador único (p. ej. «Robótica»), ligadas a un curso del plan
export const listarClases = (params) => client.get('/admin/clases', { params })
export const crearClase = (datos) => client.post('/admin/clases', datos)
export const actualizarClase = (id, datos) => client.put(`/admin/clases/${id}`, datos)
export const eliminarClase = (id) => client.delete(`/admin/clases/${id}`)

export const listarOfertas = (params) => client.get('/admin/cursos', { params })
export const obtenerOferta = (id) => client.get(`/admin/cursos/${id}`)
export const crearOferta = (datos) => client.post('/admin/cursos', datos)
export const actualizarOferta = (id, datos) => client.put(`/admin/cursos/${id}`, datos)
export const eliminarOferta = (id) => client.delete(`/admin/cursos/${id}`)
export const asignarDocentes = (id, docentes) => client.put(`/admin/cursos/${id}/docentes`, { docentes })
export const inscribir = (id, estudiantes) => client.put(`/admin/cursos/${id}/estudiantes`, { estudiantes })
export const matricularCohorte = (id) => client.post(`/admin/cursos/${id}/estudiantes/cohorte`)

// Estudiantes de cada promoción
export const estudiantesCohorte = (id) => client.get(`/admin/cohortes/${id}/estudiantes`)
export const guardarEstudiantesCohorte = (id, estudiantes) => client.put(`/admin/cohortes/${id}/estudiantes`, { estudiantes })
