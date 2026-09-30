import client from './client'

export const listarUsuarios = (rol) => client.get('/usuarios', { params: { rol } })
export const crearUsuario = (datos) => client.post('/usuarios', datos)
export const actualizarUsuario = (id, datos) => client.put(`/usuarios/${id}`, datos)
export const eliminarUsuario = (id) => client.delete(`/usuarios/${id}`)
