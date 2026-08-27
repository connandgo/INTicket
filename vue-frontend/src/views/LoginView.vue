<template>
  <div class="page-wrap">
    <header class="bar">
      <div class="wrap bar-in">
        <router-link to="/" class="logo" aria-label="INTicket 홈">
          <span class="logo-mk">IN</span><span class="logo-tx">티켓</span>
        </router-link>
        <router-link to="/courses" class="home-link">공연 둘러보기</router-link>
      </div>
    </header>

    <main class="auth-shell">
      <aside class="auth-side">
        <p class="side-kicker">INTICKET MEMBERSHIP</p>
        <h1>보고 싶은 무대를<br />놓치지 마세요</h1>
        <p class="side-copy">예매와 취소표 대기, 결제 내역을 하나의 INTicket 계정으로 관리합니다.</p>

        <div class="poster-stack" aria-hidden="true">
          <div v-for="(item, index) in featured" :key="item.id" class="side-poster" :class="`p${index + 1}`">
            <PosterArt :id="item.id" :title="item.title" :genre="item.genre" />
          </div>
        </div>

        <ul class="side-points">
          <li>공연 회차와 좌석 등급별 실시간 잔여 확인</li>
          <li>10분 좌석 선점 후 안전한 모의 결제</li>
          <li>매진 공연 취소표 대기와 자동 매칭</li>
        </ul>
      </aside>

      <section class="box" aria-label="회원 로그인 및 가입">
        <div class="tabs" role="tablist" aria-label="계정 메뉴">
          <button type="button" class="tab" :class="{ on: mode === 'login' }" @click="setMode('login')">로그인</button>
          <button type="button" class="tab" :class="{ on: mode === 'join' }" @click="setMode('join')">회원가입</button>
        </div>

        <section v-if="mode === 'login'" class="pane">
          <div class="pane-head">
            <span class="bdg bdg-gray">INTicket 자체 계정</span>
            <h2>로그인하고 예매를 이어가세요</h2>
            <p>카카오·구글 연동이 아닌 이메일 기반 회원 로그인입니다.</p>
          </div>

          <p v-if="routeError" class="alert alert-err" role="alert">{{ routeError }}</p>

          <template v-if="DEMO">
            <p class="alert alert-info">
              데모 모드에서는 아래 계정을 선택하면 즉시 역할별 화면을 확인할 수 있습니다.
            </p>
            <p v-if="auth.isAuthenticated" class="alert alert-ok">
              현재 <b>{{ auth.user?.name }}</b>({{ auth.user?.role === 'INSTRUCTOR' ? '공연기획사' : '관람객' }}) 계정입니다.
            </p>
            <ul class="accts">
              <li v-for="u in accounts" :key="u.id">
                <button type="button" class="acct" @click="enter(u.email)">
                  <span class="a-av">{{ u.name.charAt(0) }}</span>
                  <span class="a-t">
                    <b>{{ u.name }}</b>
                    <span>{{ u.role === 'INSTRUCTOR' ? '공연기획사' : '관람객' }} · {{ u.email }}</span>
                  </span>
                  <span class="a-go" aria-hidden="true">→</span>
                </button>
              </li>
            </ul>
            <p v-if="err" class="alert alert-err">{{ err }}</p>
          </template>

          <template v-else>
            <button type="button" class="btn btn-red btn-lg btn-wide login-btn" @click="beginLogin">
              이메일로 로그인
            </button>
            <div class="login-note">
              <span class="note-mark">OIDC</span>
              <p><b>안전한 자체 인증</b><br />비밀번호는 프론트엔드가 보관하지 않고 인증 서버에서 확인합니다.</p>
            </div>
          </template>

          <p class="switch-copy">계정이 없으신가요? <button type="button" class="lk" @click="setMode('join')">회원가입</button></p>
        </section>

        <section v-else class="pane">
          <div class="pane-head">
            <span class="bdg bdg-gray">무료 회원가입</span>
            <h2>INTicket 계정을 만드세요</h2>
            <p>관람객과 공연기획사의 이용 메뉴가 역할에 맞게 제공됩니다.</p>
          </div>

          <form class="form" @submit.prevent="join">
            <div class="fld">
              <label class="flabel" for="j-role">가입 유형<span class="req">*</span></label>
              <div class="roles" role="radiogroup" aria-label="가입 유형">
                <button type="button" class="role" role="radio" :aria-checked="form.role === 'STUDENT'" :class="{ on: form.role === 'STUDENT' }" @click="form.role = 'STUDENT'">
                  <b>관람객</b><span>공연을 예매합니다</span>
                </button>
                <button type="button" class="role" role="radio" :aria-checked="form.role === 'INSTRUCTOR'" :class="{ on: form.role === 'INSTRUCTOR' }" @click="form.role = 'INSTRUCTOR'">
                  <b>공연기획사</b><span>공연을 등록합니다</span>
                </button>
              </div>
              <select id="j-role" v-model="form.role" class="sr-only" tabindex="-1" aria-hidden="true">
                <option value="STUDENT">관람객</option>
                <option value="INSTRUCTOR">공연기획사</option>
              </select>
            </div>

            <div class="fld">
              <label class="flabel" for="j-name">이름<span class="req">*</span></label>
              <input id="j-name" v-model.trim="form.name" class="inp" autocomplete="name" placeholder="홍길동" required />
            </div>
            <div class="fld">
              <label class="flabel" for="j-email">이메일<span class="req">*</span></label>
              <input id="j-email" v-model.trim="form.email" type="email" class="inp" autocomplete="email" placeholder="user@example.com" required />
            </div>
            <div class="fld">
              <label class="flabel" for="j-pw">비밀번호<span class="req">*</span></label>
              <input id="j-pw" v-model="form.password" type="password" class="inp" autocomplete="new-password" placeholder="8자 이상" minlength="8" required />
            </div>

            <p v-if="err" class="alert alert-err" role="alert">{{ err }}</p>
            <p v-if="ok" class="alert alert-ok" role="status">{{ ok }}</p>

            <button type="submit" class="btn btn-red btn-lg btn-wide" :disabled="loading">
              <span v-if="loading" class="spin spin-w"></span>{{ loading ? '가입 중' : '회원가입' }}
            </button>
          </form>
          <p class="switch-copy">이미 계정이 있으신가요? <button type="button" class="lk" @click="setMode('login')">로그인</button></p>
        </section>
      </section>
    </main>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PosterArt from '@/components/PosterArt.vue'
import { useAuthStore } from '@/store/auth.js'
import { authApi } from '@/api/auth.js'
import { DEMO } from '@/config/features.js'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const featured = [
  { id: 1, title: '오페라의 유령', genre: '뮤지컬' },
  { id: 4, title: 'FIRST LIGHT', genre: '콘서트' },
  { id: 7, title: '피아노 협주곡', genre: '클래식' }
]

const safeRedirect = computed(() => {
  const path = route.query.redirect
  return typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') ? path : '/courses'
})
const routeError = computed(() => typeof route.query.error === 'string' ? route.query.error : '')

const mode = ref(route.query.mode === 'join' ? 'join' : 'login')
const loading = ref(false)
const err = ref('')
const ok = ref('')
const form = ref({ name: '', email: '', password: '', role: 'STUDENT' })
const accounts = ref(auth.demoUsers())

function setMode(next) {
  mode.value = next
  err.value = ''
  ok.value = ''
  const query = { ...route.query, mode: next === 'join' ? 'join' : undefined, error: undefined }
  router.replace({ name: 'Login', query })
}

function beginLogin() {
  auth.redirectToLogin(safeRedirect.value)
}

function enter(email) {
  err.value = ''
  try {
    auth.demoLogin(email)
    router.push(safeRedirect.value)
  } catch (e) {
    err.value = e.message || '로그인하지 못했습니다.'
  }
}

async function join() {
  err.value = ''
  ok.value = ''
  loading.value = true
  try {
    await authApi.register(form.value)
    ok.value = '가입이 완료되었습니다. 로그인해 주세요.'
    const joined = form.value.email
    form.value = { name: '', email: '', password: '', role: form.value.role }
    setTimeout(() => {
      accounts.value = auth.demoUsers()
      setMode('login')
      if (DEMO) enter(joined)
    }, 800)
  } catch (e) {
    console.error('[login] 회원가입 실패:', e)
    err.value = e.response?.data?.message || '회원가입에 실패했습니다.'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.page-wrap { min-height: 100vh; background: var(--bg-soft); }
.bar { background: #fff; border-bottom: 1px solid var(--line); }
.bar-in { height: 64px; display: flex; align-items: center; justify-content: space-between; }
.logo { display: flex; align-items: center; gap: 7px; }
.logo-mk { display: grid; place-items: center; width: 32px; height: 32px; background: var(--red); color: #fff; font-family: var(--num); font-size: 13px; font-weight: 700; border-radius: var(--r); }
.logo-tx { font-size: 20px; font-weight: 800; letter-spacing: -0.05em; color: var(--navy); }
.home-link { font-size: 13px; color: var(--t2); }
.home-link:hover { color: var(--red); text-decoration: underline; text-underline-offset: 3px; }

.auth-shell { width: min(980px, calc(100% - 40px)); min-height: 610px; margin: 42px auto 70px; display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(400px, .95fr); overflow: hidden; background: #fff; border: 1px solid var(--line); border-radius: var(--r-lg); box-shadow: var(--shadow-up); }
.auth-side { position: relative; padding: 42px 40px; overflow: hidden; background: var(--navy); color: #fff; }
.side-kicker { color: #FF93A1; font-family: var(--num); font-size: 11px; font-weight: 700; letter-spacing: .16em; }
.auth-side h1 { margin-top: 13px; font-size: 30px; line-height: 1.3; letter-spacing: -.05em; }
.side-copy { width: 78%; margin-top: 13px; color: rgba(255,255,255,.65); font-size: 13.5px; line-height: 1.75; }
.poster-stack { position: relative; height: 260px; margin: 28px 0 22px; }
.side-poster { position: absolute; width: 142px; border-radius: var(--r); overflow: hidden; box-shadow: 0 14px 30px rgba(0,0,0,.3); }
.side-poster.p1 { left: 0; top: 20px; transform: rotate(-7deg); }
.side-poster.p2 { left: 50%; top: 0; z-index: 2; transform: translateX(-50%); }
.side-poster.p3 { right: 0; top: 20px; transform: rotate(7deg); }
.side-points { display: grid; gap: 7px; color: rgba(255,255,255,.72); font-size: 12px; }
.side-points li { position: relative; padding-left: 13px; }
.side-points li::before { content: ''; position: absolute; left: 0; top: 9px; width: 4px; height: 4px; border-radius: 50%; background: #FF93A1; }

.box { min-width: 0; background: #fff; }
.tabs { margin-bottom: 0; overflow: visible; }
.tab { flex: 1; text-align: center; padding: 16px 0; }
.pane { padding: 32px 30px 36px; display: flex; flex-direction: column; gap: 17px; }
.pane-head { padding-bottom: 18px; border-bottom: 1px solid var(--line); }
.pane-head h2 { margin-top: 10px; font-size: 21px; line-height: 1.35; letter-spacing: -.045em; }
.pane-head p { margin-top: 5px; color: var(--t3); font-size: 12.5px; }
.form { display: flex; flex-direction: column; gap: 15px; }

.roles { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.role { display: flex; flex-direction: column; gap: 2px; padding: 12px 13px; border: 1px solid var(--line-dark); border-radius: var(--r); text-align: left; transition: border-color .15s var(--ease), background .15s var(--ease); }
.role b { font-size: 14px; font-weight: 700; }
.role span { font-size: 11.5px; color: var(--t3); }
.role:hover { border-color: var(--t3); }
.role.on { border-color: var(--red); background: var(--red-wash); }
.role.on b { color: var(--red-dark); }

.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
.login-btn { margin-top: 2px; }
.login-note { display: flex; align-items: center; gap: 11px; padding: 12px 13px; background: var(--bg-soft); border: 1px solid var(--line); }
.note-mark { flex-shrink: 0; padding: 4px 6px; background: var(--navy); color: #fff; border-radius: 2px; font: 700 9px var(--num); letter-spacing: .08em; }
.login-note p { color: var(--t3); font-size: 11.5px; line-height: 1.55; }
.login-note b { color: var(--t2); font-weight: 700; }

.accts { display: flex; flex-direction: column; gap: 8px; }
.acct { width: 100%; display: flex; align-items: center; gap: 12px; padding: 13px 14px; border: 1px solid var(--line-dark); border-radius: var(--r); text-align: left; transition: border-color .15s var(--ease), background .15s var(--ease); }
.acct:hover { border-color: var(--red); background: var(--red-wash); }
.a-av { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; background: var(--navy); color: #fff; font-size: 14px; font-weight: 700; flex-shrink: 0; }
.a-t { display: flex; flex-direction: column; min-width: 0; }
.a-t b { font-size: 14px; font-weight: 700; }
.a-t span { overflow: hidden; color: var(--t3); font-size: 11.5px; text-overflow: ellipsis; white-space: nowrap; }
.a-go { margin-left: auto; color: var(--t4); font-size: 16px; }
.switch-copy { text-align: center; color: var(--t3); font-size: 12.5px; }
.lk { color: var(--red); font-weight: 600; text-decoration: underline; text-underline-offset: 2px; font-size: inherit; }
.spin-w { border-color: rgba(255,255,255,.4); border-top-color: #fff; width: 15px; height: 15px; }

@media (max-width: 800px) {
  .auth-shell { grid-template-columns: 1fr; width: min(520px, calc(100% - 28px)); margin-top: 24px; }
  .auth-side { padding: 28px 28px 24px; }
  .auth-side h1 { font-size: 24px; }
  .side-copy { width: 100%; }
  .poster-stack, .side-points { display: none; }
  .pane { padding: 26px 22px 30px; }
}
</style>
