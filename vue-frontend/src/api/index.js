import axios from 'axios'
import { useAuthStore } from '@/store/auth.js'
import { DEMO } from '@/config/features.js'
import mockAdapter from '@/mock/adapter.js'

const api = axios.create({
  baseURL: '',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
  // 데모 모드에서는 네트워크로 나가지 않고 브라우저 안에서 응답을 만든다.
  ...(DEMO ? { adapter: mockAdapter } : {})
})

api.interceptors.request.use((config) => {
  const auth = useAuthStore()
  if (auth.accessToken) {
    config.headers.Authorization = `Bearer ${auth.accessToken}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      console.error('[API] 401 Unauthorized')
      console.error('[API] response data =', err.response?.data)
      console.error('[API] request url =', err.config?.url)
      // 디버깅 중에는 자동 로그아웃/리다이렉트 잠시 비활성화
      // const auth = useAuthStore()
      // auth.logout()
      // window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api