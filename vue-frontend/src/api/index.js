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

// 공연 조회에도 인증이 필요하므로(API_SPEC 2절), 비로그인 상태의 401은 정상이다.
// 토큰을 들고 있는데 401이 났을 때만 만료로 보고 세션을 정리한다.
// 화면 이동은 각 화면이 판단한다 — 여기서 강제 이동시키면 공개 화면까지 튕긴다.
// 서버에 닿지 못하면 내장 데이터로 갈아탄다.
//
// 프론트만 따로 받아서 실행하는 경우(백엔드 미기동)가 여기 해당한다.
// 그대로 두면 공연 목록이 비어 화면을 아무것도 볼 수 없다.
// 한 번만 전환하고 새로고침한다. 데모 모드는 네트워크로 나가지 않으므로
// 여기로 다시 들어와 무한 새로고침이 되는 일은 없다.
const AUTO_KEY = 'inticket.demo.auto'

// 서버에 닿지 못했다는 신호.
// 응답이 아예 없거나(네트워크 차단), 프록시가 상류에 연결하지 못했을 때다.
// 백엔드를 끄고 프론트만 실행하면 개발 서버가 502 를 돌려준다.
function unreachable(err) {
  if (!err.response) return true
  return [502, 503, 504].includes(err.response.status)
}

function fallbackToBuiltIn(err) {
  if (!unreachable(err)) return false
  if (DEMO) return false
  try {
    if (sessionStorage.getItem(AUTO_KEY)) return false
    // 실제 로그인 세션 중이라면 일시적인 장애일 수 있다. 화면을 바꾸지 않는다.
    if (sessionStorage.getItem('access_token')) return false
    sessionStorage.setItem(AUTO_KEY, '1')
    sessionStorage.setItem('inticket.demo', '1')
  } catch {
    return false
  }
  console.warn('[API] 서버에 닿지 못해 내장 데이터로 전환합니다:', err.config?.url)
  location.reload()
  return true
}

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (fallbackToBuiltIn(err)) return new Promise(() => {})
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