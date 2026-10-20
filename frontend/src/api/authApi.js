import client from './client'

export const login = (email, password) => client.post('/auth/login', { email, password })
export const me = () => client.get('/auth/me')
export const cambiarPassword = (actual, nueva) => client.put('/auth/password', { actual, nueva })
export const actualizarCuenta = (datos) => client.put('/auth/me', datos)
