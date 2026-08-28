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

  // 이메일·비밀번호로 로그인한다. 백엔드가 없을 때 쓰는 경로다.
  async function demoLoginWithPassword(email, password) {
    const found = readDemoDb().users.find((u) => u.email === email)
    if (!found || (found.password || '') !== password) {
      throw new Error('이메일 또는 비밀번호가 올바르지 않습니다.')
    }
    setToken(`demo.${found.id}.${Date.now()}`)
    setUser(found)
    return found
  }

  function demoUsers() {
    return DEMO ? readDemoDb().users : []
  }

  // 진짜 로그아웃. 인증 서버 세션까지 끊는다.
  //
  // 인증 서버의 /connect/logout 이 세션을 확실히 끊어 주는지 확인할 수 없었고,
  // 세션 쿠키(JSESSIONID)는 HttpOnly 라 브라우저 JS 로도 못 지운다.
  //
  // 다행히 그 쿠키는 Domain 없이 host(localhost)에 심겨서 포트가 달라도
  // 우리 dev 서버로 함께 전송된다. 그래서 dev 서버가 만료 헤더를 내려주는
  // /kill-session 을 불러 브라우저가 쿠키를 지우게 한다(vite.config.js 참고).
  //
  // 그다음 표준 OIDC 로그아웃도 함께 호출해 서버 쪽 세션도 정리한다.
  async function fullLogout() {
    const hint = idToken.value
    clearSession()

    // 1) 브라우저가 들고 있는 인증 서버 세션 쿠키를 지운다 (확실한 쪽)
    try {
      await fetch('/kill-session', { credentials: 'include', cache: 'no-store' })
    } catch (e) {
      console.warn('[auth] 세션 쿠키 삭제 실패:', e)
    }

    // 2) 서버 쪽 세션도 정리한다. 실패해도 1) 만으로 재로그인 시 폼이 뜬다.
    if (hint) {
      const params = new URLSearchParams({
        id_token_hint: hint,
        post_logout_redirect_uri: POST_LOGOUT_URI
      })
      try {
        await fetch(`/connect/logout?${params.toString()}`, {
          credentials: 'include',
          redirect: 'manual'
        })
      } catch (e) {
        console.warn('[auth] OIDC 로그아웃 호출 실패:', e)
      }
    }

    window.location.href = '/'
  }

  // OAuth2 Authorization Code Flow
  function redirectToLogin() {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: import.meta.env.VITE_CLIENT_ID,
      redirect_uri: import.meta.env.VITE_REDIRECT_URI,
      // API_SPEC.md 기준. 등록되지 않은 scope를 보내면 invalid_scope 로 막힌다.
      scope: 'openid',
      // 세션이 남아 있어도 로그인 화면을 다시 보여 달라는 표준 OIDC 파라미터 두 개.
      //
      // prompt=login : 재인증을 요청한다. 서버가 무시할 수 있다.
      // max_age=0    : 마지막 인증 이후 0초를 넘겼으면 다시 인증하라는 뜻.
      //                항상 초과이므로 사실상 '매번 로그인 폼을 띄워라'가 된다.
      //
      // 인증 서버 세션을 끊는 데 의존하지 않으려고 붙였다. 로그아웃이 세션을
      // 못 끊어도 이 파라미터 때문에 아이디·비밀번호를 다시 묻는다.
      prompt: 'login',
      max_age: '0'
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
    demoLoginWithPassword,
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