import axios from 'axios'

export const TOKEN_KEY = 'maie_token'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const client = axios.create({ baseURL: `${API_URL}/api/v1` })

// Adjunta el JWT guardado en localStorage a cada petición.
client.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Devuelve directamente el DTO { status, data } y normaliza los errores a { message }.
client.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) localStorage.removeItem(TOKEN_KEY)
    return Promise.reject(error.response?.data?.error ?? { message: error.message })
  },
)

export default client
