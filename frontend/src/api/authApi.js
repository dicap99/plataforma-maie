import client from './client'

// Se ingresa con la identificación y la contraseña.
export const login = (identificacion, password) => client.post('/auth/login', { identificacion, password })
export const me = () => client.get('/auth/me')
export const cambiarPassword = (actual, nueva) => client.put('/auth/password', { actual, nueva })
