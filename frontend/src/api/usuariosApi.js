import client from './client'

export const listarUsuarios = (rol) => client.get('/usuarios', { params: { rol } })
export const crearUsuario = (datos) => client.post('/usuarios', datos)
export const actualizarUsuario = (id, datos) => client.put(`/usuarios/${id}`, datos)
export const eliminarUsuario = (id) => client.delete(`/usuarios/${id}`)
export const camposFormacion = () => client.get('/usuarios/campos-formacion')
// Beneficios por semestre de los estudiantes (pestaña «Beneficios» de Gestión académica).
export const beneficiosDePromocion = (idCohorte) => client.get('/usuarios/beneficios', { params: { id_cohorte: idCohorte } })
export const reemplazarBeneficios = (id, idCohorte, beneficios) =>
  client.put(`/usuarios/${id}/beneficios`, { id_cohorte: Number(idCohorte), beneficios })
// Ficha de detalle según el rol (materias, beneficios, producción; perfil y materias del docente).
export const ficha = (id) => client.get(`/usuarios/${id}/ficha`)
