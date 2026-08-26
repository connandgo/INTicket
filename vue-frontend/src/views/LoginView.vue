<template>
  <div class="page-wrap">
    <header class="bar">
      <div class="wrap bar-in">
        <router-link to="/" class="logo">
          <span class="logo-mk">IN</span><span class="logo-tx">티켓</span>
        </router-link>
        <router-link to="/" class="small muted">홈으로</router-link>
      </div>
    </header>

    <main class="box">
      <div class="tabs">
        <button class="tab" :class="{ on: mode === 'login' }" @click="mode = 'login'">로그인</button>
        <button class="tab" :class="{ on: mode === 'join' }" @click="mode = 'join'">회원가입</button>
      </div>

      <!-- 로그인 -->
      <section v-if="mode === 'login'" class="pane">
        <p class="lead">INTicket 계정으로 로그인하면 공연을 예매할 수 있습니다.</p>
        <button class="btn btn-red btn-lg btn-wide" @click="auth.redirectToLogin()">로그인</button>
        <p class="fhint center">계정이 없으신가요? <button class="lk" @click="mode = 'join'">회원가입</button></p>
      </section>

      <!-- 회원가입 -->
      <section v-else class="pane">
        <form class="form" @submit.prevent="join">
          <div class="fld">
            <label class="flabel" for="j-role">가입 유형<span class="req">*</span></label>
            <!-- 내부 값은 STUDENT/INSTRUCTOR 그대로. 화면 이름만 공연 도메인으로(명세서 4.1) -->
            <div class="roles">
              <button type="button" class="role" :class="{ on: form.role === 'STUDENT' }" @click="form.role = 'STUDENT'">
                <b>관람객</b><span>공연을 예매합니다</span>
              </button>
              <button type="button" class="role" :class="{ on: form.role === 'INSTRUCTOR' }" @click="form.role = 'INSTRUCTOR'">
                <b>공연기획사</b><span>공연을 등록합니다</span>
              </button>
            </div>
            <select id="j-role" v-model="form.role" class="sel sr-only" tabindex="-1" aria-hidden="true">
              <option value="STUDENT">관람객</option>
              <option value="INSTRUCTOR">공연기획사</option>
            </select>
          </div>

          <div class="fld">
            <label class="flabel" for="j-name">이름<span class="req">*</span></label>
            <input id="j-name" v-model.trim="form.name" class="inp" placeholder="홍길동" required />
          </div>
          <div class="fld">
            <label class="flabel" for="j-email">이메일<span class="req">*</span></label>
            <input id="j-email" v-model.trim="form.email" type="email" class="inp" placeholder="user@example.com" required />
          </div>
          <div class="fld">
            <label class="flabel" for="j-pw">비밀번호<span class="req">*</span></label>
            <input id="j-pw" v-model="form.password" type="password" class="inp" placeholder="8자 이상" minlength="8" required />
          </div>

          <p v-if="err" class="alert alert-err">{{ err }}</p>
          <p v-if="ok" class="alert alert-ok">{{ ok }}</p>

          <button type="submit" class="btn btn-red btn-lg btn-wide" :disabled="loading">
            <span v-if="loading" class="spin spin-w"></span>{{ loading ? '가입 중' : '회원가입' }}
          </button>
        </form>
        <p class="fhint center">이미 계정이 있으신가요? <button class="lk" @click="mode = 'login'">로그인</button></p>
      </section>
    </main>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useAuthStore } from '@/store/auth.js'
import { authApi } from '@/api/auth.js'

const auth = useAuthStore()

const mode = ref('login')
const loading = ref(false)
const err = ref('')
const ok = ref('')
const form = ref({ name: '', email: '', password: '', role: 'STUDENT' })

async function join() {
  err.value = ''
  ok.value = ''
  loading.value = true
  try {
    await authApi.register(form.value)
    ok.value = '가입이 완료되었습니다. 로그인해 주세요.'
    form.value = { name: '', email: '', password: '', role: form.value.role }
    setTimeout(() => { mode.value = 'login'; ok.value = '' }, 1600)
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
.bar-in { height: 58px; display: flex; align-items: center; justify-content: space-between; }
.logo { display: flex; align-items: center; gap: 6px; }
.logo-mk {
  display: grid; place-items: center; width: 30px; height: 30px;
  background: var(--red); color: #fff; font-family: var(--num);
  font-size: 13px; font-weight: 700; border-radius: var(--r);
}
.logo-tx { font-size: 19px; font-weight: 800; letter-spacing: -0.05em; color: var(--navy); }

.box {
  max-width: 440px;
  margin: 46px auto 90px;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: var(--r-lg);
  overflow: hidden;
}
.tabs { margin-bottom: 0; overflow: visible; }
.tab { flex: 1; text-align: center; padding: 14px 0; }

.pane { padding: 28px 26px 30px; display: flex; flex-direction: column; gap: 16px; }
.lead { font-size: 13.5px; color: var(--t2); line-height: 1.7; }
.form { display: flex; flex-direction: column; gap: 16px; }

.roles { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.role {
  display: flex; flex-direction: column; gap: 2px;
  padding: 12px 13px;
  border: 1px solid var(--line-dark);
  border-radius: var(--r);
  text-align: left;
  transition: border-color .15s var(--ease), background .15s var(--ease);
}
.role b { font-size: 14px; font-weight: 700; }
.role span { font-size: 11.5px; color: var(--t3); }
.role:hover { border-color: var(--t3); }
.role.on { border-color: var(--red); background: var(--red-wash); }
.role.on b { color: var(--red-dark); }

.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }

.center { text-align: center; }
.lk { color: var(--red); font-weight: 600; text-decoration: underline; text-underline-offset: 2px; font-size: 12px; }
.spin-w { border-color: rgba(255,255,255,.4); border-top-color: #fff; width: 15px; height: 15px; }
</style>
