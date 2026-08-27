<template>
  <header class="hd">
    <!-- 상단 유틸 -->
    <div class="util">
      <div class="wrap util-in">
        <!-- 데모 모드일 때만. 진짜 서버에 붙은 화면과 헷갈리지 않게 항상 띄운다. -->
        <span v-if="DEMO" class="demo">
          <b>데모 모드</b>
          <button class="dbtn" @click="switchAccount">계정 전환</button>
          <button class="dbtn" @click="resetDemo">데이터 초기화</button>
          <button class="dbtn" @click="setDemo(false)">끄기</button>
        </span>

        <template v-if="auth.isAuthenticated">
          <span class="hi"><b>{{ auth.user?.name || '회원' }}</b>님 · {{ roleLabel }}</span>
          <router-link to="/enrollments" class="ul">내 예매</router-link>
          <router-link to="/mypage" class="ul">마이페이지</router-link>
          <button class="ul" @click="signOut">로그아웃</button>
        </template>
        <template v-else>
          <router-link to="/login" class="ul">로그인</router-link>
          <router-link to="/login" class="ul">회원가입</router-link>
        </template>
      </div>
    </div>

    <!-- 메인 -->
    <div class="main">
      <div class="wrap main-in">
        <router-link to="/" class="logo">
          <span class="logo-mk">IN</span>
          <span class="logo-tx">티켓</span>
        </router-link>

        <nav class="nav">
          <router-link to="/courses" class="nv" :class="{ on: isCourses }">공연</router-link>
          <router-link v-if="auth.isAuthenticated" to="/enrollments" class="nv" :class="{ on: $route.path === '/enrollments' }">예매확인</router-link>
          <router-link v-if="isPlanner" to="/courses/new" class="nv" :class="{ on: $route.path === '/courses/new' }">공연등록</router-link>
        </nav>

        <router-link v-if="!auth.isAuthenticated" to="/login" class="btn btn-red btn-sm cta">로그인하고 예매</router-link>
      </div>
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/store/auth.js'
import { DEMO, setDemo } from '@/config/features.js'
import { reset as resetDemoDb } from '@/mock/db.js'

const auth = useAuthStore()

// 데모에서 관람객 ↔ 공연기획사를 오갈 수 있게 한다.
function switchAccount() {
  auth.logout(false)
  router.push('/login')
}

function resetDemo() {
  resetDemoDb()
  sessionStorage.clear()
  location.href = '/'
}
const route = useRoute()
const router = useRouter()

// STUDENT/INSTRUCTOR 값은 그대로 두고 화면 표시만 바꾼다(명세서 4.1)
const isPlanner = computed(() => auth.user?.role === 'INSTRUCTOR')
const roleLabel = computed(() => (isPlanner.value ? '공연기획사' : '관람객'))
const isCourses = computed(() => route.path === '/courses' || route.path.startsWith('/courses/') && route.path !== '/courses/new')

function signOut() {
  // 데모는 인증 서버를 안 쓰므로 앱 세션만 지우면 된다.
  if (DEMO) {
    auth.logout(false)
    router.push('/')
    return
  }
  // 실서버에서는 인증 서버 세션까지 끊어야 다음 로그인에서 아이디·비번을 다시 묻는다.
  auth.fullLogout()
}
</script>

<style scoped>
.hd { border-bottom: 1px solid var(--line); background: #fff; position: sticky; top: 0; z-index: 40; }

.util { background: var(--bg-soft); border-bottom: 1px solid var(--line); }
.util-in { height: 32px; display: flex; align-items: center; justify-content: flex-end; gap: 14px; }
.demo {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 2px 8px;
  background: var(--warn-wash);
  border: 1px solid #F0DDBB;
  border-radius: 2px;
  font-size: 11px;
  color: var(--warn);
  margin-right: auto;
}
.demo b { font-weight: 700; }
.dbtn { font-size: 11px; color: var(--warn); text-decoration: underline; text-underline-offset: 2px; }
.dbtn:hover { color: var(--red-dark); }

.hi { font-size: 12px; color: var(--t3); }
.demo ~ .hi { margin-right: auto; }
:where(.util-in) > .hi:first-child { margin-right: auto; }
.hi b { color: var(--t1); font-weight: 600; }
.ul { font-size: 12px; color: var(--t2); }
.ul:hover { color: var(--red); text-decoration: underline; text-underline-offset: 2px; }

.main-in { height: 58px; display: flex; align-items: center; gap: 34px; }
.logo { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.logo-mk {
  display: grid; place-items: center;
  width: 30px; height: 30px;
  background: var(--red); color: #fff;
  font-family: var(--num);
  font-size: 13px; font-weight: 700;
  border-radius: var(--r);
}
.logo-tx { font-size: 19px; font-weight: 800; letter-spacing: -0.05em; color: var(--navy); }

.nav { display: flex; gap: 26px; }
.nv {
  font-size: 15.5px;
  font-weight: 600;
  letter-spacing: -0.04em;
  color: var(--t2);
  padding: 4px 0;
  border-bottom: 2px solid transparent;
}
.nv:hover { color: var(--t1); }
.nv.on { color: var(--red); border-bottom-color: var(--red); }

.cta { margin-left: auto; }

@media (max-width: 760px) {
  .main-in { height: 52px; gap: 18px; }
  .nav { gap: 16px; }
  .nv { font-size: 14px; }
  .hi { display: none; }
  .cta { display: none; }
}
</style>
