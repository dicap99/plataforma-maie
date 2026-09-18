import client from './client'

export const listarUsuarios = () => client.get('/usuarios')
export const crearUsuario = (datos) => client.post('/usuarios', datos)
export const actualizarUsuario = (id, datos) => client.put(`/usuarios/${id}`, datos)
export const eliminarUsuario = (id) => client.delete(`/usuarios/${id}`)
