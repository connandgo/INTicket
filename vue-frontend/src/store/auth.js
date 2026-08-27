import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/api/auth.js'
import { DEMO } from '@/config/features.js'
import { read as readDemoDb } from '@/mock/db.js'

const AUTH_SERVER_URL = import.meta.env.VITE_AUTH_SERVER_URL || 'http://localhost:8080'
// 인증 서버에 등록된 값과 정확히 일치해야 한다(끝의 / 포함).
const POST_LOGOUT_URI = import.meta.env.VITE_POST_LOGOUT_URI || 'http://localhost:3000/'

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref(sessionStorage.getItem('access_token') || null)
  // OIDC 로그아웃(/connect/logout)에 id_token_hint 로 넣어야 세션이 끊긴다.
  const idToken = ref(sessionStorage.getItem('id_token') || null)
  const user = ref(JSON.parse(sessionStorage.getItem('user') || 'null'))

  const isAuthenticated = computed(() => !!accessToken.value)
  const isInstructor = computed(() => user.value?.role === 'INSTRUCTOR')

  function setToken(token) {
    accessToken.value = token
    sessionStorage.setItem('access_token', token)
  }

  function setIdToken(token) {
    idToken.value = token || null
    if (token) sessionStorage.setItem('id_token', token)
    else sessionStorage.removeItem('id_token')
  }

  function setUser(userData) {
    user.value = userData
    sessionStorage.setItem('user', JSON.stringify(userData))
  }

  async function fetchUser() {
    try {
      const res = await authApi.getMe()
      console.log('[AuthStore] /me response =', res.data)

      const userData = res?.data?.data ?? res?.data

      if (!userData || typeof userData !== 'object') {
        throw new Error('사용자 정보 형식이 올바르지 않습니다.')
      }

      setUser(userData)
    } catch (error) {
      console.error('[AuthStore] 사용자 정보 조회 실패:', error)
      logout(false)
    }
  }

  // 이 앱 안의 세션만 지운다. 인증 서버 세션은 그대로 남는다.
  function clearSession() {
    accessToken.value = null
    user.value = null
    idToken.value = null
    sessionStorage.removeItem('access_token')
    sessionStorage.removeItem('user')
    sessionStorage.removeItem('id_token')
  }

  function logout(redirect = true) {
    clearSession()
    if (redirect) window.location.href = '/login'
  }

  // 데모 모드 로그인 — auth-server 없이 계정만 골라 들어간다.
  // 비밀번호를 받지 않는다. 실제 인증이 아니라는 뜻이고, DEMO 일 때만 쓰인다.
  function demoLogin(email) {
    const found = readDemoDb().users.find((u) => u.email === email)
    if (!found) throw new Error('데모 계정을 찾을 수 없습니다.')
    setToken(`demo.${found.id}.${Date.now()}`)
    setUser(found)
    return found
  }

  function demoUsers() {
    return DEMO ? readDemoDb().users : []
  }

  // 진짜 로그아웃. 인증 서버 세션까지 끊는다.
  //
  // Spring Security 의 /logout 은 CSRF 때문에 GET 으로는 세션이 안 끊긴다.
  // 그래서 표준 OIDC RP-Initiated Logout(/connect/logout)을 쓴다.
  // 이 인증 서버에는 post_logout_redirect_uri 로 http://localhost:3000/ 이
  // 등록되어 있어서, 세션을 끊은 뒤 우리 앱 홈으로 되돌려 보내 준다.
  function fullLogout() {
    const hint = idToken.value
    clearSession()

    if (!hint) {
      // id_token 이 없으면(예전 세션 등) 되돌아올 방법이 없다.
      // 세션이라도 끊고 인증 서버 로그아웃 화면에 맡긴다.
      window.location.href = `${AUTH_SERVER_URL}/logout`
      return
    }

    const params = new URLSearchParams({
      id_token_hint: hint,
      post_logout_redirect_uri: POST_LOGOUT_URI
    })
    window.location.href = `${AUTH_SERVER_URL}/connect/logout?${params.toString()}`
  }

  // OAuth2 Authorization Code Flow
  function redirectToLogin() {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: import.meta.env.VITE_CLIENT_ID,
      redirect_uri: import.meta.env.VITE_REDIRECT_URI,
      // API_SPEC.md 기준. 등록되지 않은 scope를 보내면 invalid_scope 로 막힌다.
      scope: 'openid',
      // 세션이 남아 있어도 로그인 화면을 다시 보여 달라는 표준 OIDC 파라미터.
      // 인증 서버가 무시할 수도 있어서, 확실한 건 fullLogout() 쪽이다.
      prompt: 'login'
    })

    window.location.href = `${AUTH_SERVER_URL}/oauth2/authorize?${params.toString()}`
  }

  async function handleCallback(code) {
    const res = await authApi.exchangeCode(code)
    console.log('[AuthStore] token response =', res.data)

    const token = res?.data?.access_token

    if (!token) {
      throw new Error('액세스 토큰을 받지 못했습니다.')
    }

    setToken(token)
    // scope=openid 라 id_token 도 함께 온다. 로그아웃할 때 필요하다.
    setIdToken(res?.data?.id_token)
    await fetchUser()
  }

  return {
    demoLogin,
    demoUsers,
    clearSession,
    fullLogout,
    idToken,
    setIdToken,
    accessToken,
    user,
    isAuthenticated,
    isInstructor,
    setToken,
    setUser,
    fetchUser,
    logout,
    redirectToLogin,
    handleCallback
  }
})