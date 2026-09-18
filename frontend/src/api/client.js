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

// Devuelve directamente el DTO { status, data } (o la respuesta completa en descargas binarias)
// y normaliza los errores a { message, details, status }.
client.interceptors.response.use(
  (response) => (response.config.responseType === 'blob' ? response : response.data),
  async (error) => {
    const status = error.response?.status
    if (status === 401 && localStorage.getItem(TOKEN_KEY)) {
      localStorage.removeItem(TOKEN_KEY)
      window.dispatchEvent(new Event('maie:sesion-expirada'))
    }
    let cuerpo = error.response?.data
    if (cuerpo instanceof Blob) cuerpo = JSON.parse(await cuerpo.text())
    return Promise.reject({ ...(cuerpo?.error ?? { message: error.message }), status })
  },
)

// Descarga un archivo binario respetando el nombre enviado por el servidor.
export const descargar = async (url, params) => {
  const res = await client.get(url, { params, responseType: 'blob' })
  const nombre = res.headers['content-disposition']?.match(/filename="([^"]+)"/)?.[1] ?? 'descarga'
  const enlace = document.createElement('a')
  enlace.href = URL.createObjectURL(res.data)
  enlace.download = nombre
  enlace.click()
  URL.revokeObjectURL(enlace.href)
}

export default client
