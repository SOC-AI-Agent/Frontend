import axios from 'axios'
import useAuthStore from '../stores/authStore'
import { endpoints } from './endpoints'

const client = axios.create({
  baseURL: '',
  timeout: 150000, // 2.5 min (Ollama CPU can be slow)
})

// Attach JWT token
client.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auto-refresh on 401
client.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const { refreshToken, setTokens, logout } = useAuthStore.getState()
      if (refreshToken) {
        try {
          const res = await axios.post(endpoints.auth.refresh, { refresh_token: refreshToken })
          setTokens(res.data.access_token, res.data.refresh_token)
          original.headers.Authorization = `Bearer ${res.data.access_token}`
          return client(original)
        } catch {
          logout()
        }
      } else {
        logout()
      }
    }
    return Promise.reject(error)
  }
)

export default client
