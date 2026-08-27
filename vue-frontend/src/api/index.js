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

// Gateway 정책에 따라 비로그인 상태의 401은 정상 응답일 수 있다.
// 토큰을 들고 있는데 401이 났을 때만 만료로 보고 세션을 정리한다.
// 화면 이동은 각 화면이 판단한다 — 여기서 강제 이동시키면 공개 화면까지 튕긴다.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const auth = useAuthStore()
      if (auth.accessToken) {
        console.warn('[API] 401 — 토큰이 만료된 것으로 보고 세션을 정리합니다:', err.config?.url)
        auth.logout(false)
      }
    }
    return Promise.reject(err)
  }
)

export default api
