<template>
  <div>
    <AppHeader />

    <!-- 상단 배너 -->
    <section class="hero">
      <div class="wrap hero-in">
        <div class="hero-txt">
          <p class="kicker">공연 예매</p>
          <h1 class="hh">
            보고 싶은 무대,<br />
            지금 바로 예매하세요
          </h1>
          <p class="hp">뮤지컬 · 연극 · 콘서트 · 클래식 공연을 한 곳에서 찾고 예매합니다.</p>
          <div class="hbtn">
            <router-link to="/courses" class="btn btn-red btn-lg">공연 보러 가기</router-link>
            <router-link v-if="auth.isAuthenticated" to="/enrollments" class="btn btn-line btn-lg">내 예매 확인</router-link>
          </div>
        </div>

        <ul class="hero-tiles" aria-hidden="true">
          <li v-for="(g, i) in GENRES" :key="g.code" :class="'tile t' + i">
            <span>{{ g.label }}</span>
          </li>
        </ul>
      </div>
    </section>

    <!-- 장르 바로가기 -->
    <section class="wrap qk">
      <router-link
        v-for="g in GENRES"
        :key="g.code"
        to="/courses"
        class="qk-i"
        @click="pick(g.code)"
      >
        <span class="qk-l">{{ g.label }}</span>
        <span class="qk-a">›</span>
      </router-link>
    </section>

    <!-- 인기 공연 -->
    <section class="wrap rank">
      <h2 class="stitle">인기 공연</h2>

      <div v-if="store.loading" class="load"><span class="spin"></span>공연을 불러오는 중입니다</div>

      <div v-else-if="store.error" class="blank">
        <h3>공연을 불러오지 못했습니다</h3>
        <p>{{ store.error }}</p>
      </div>

      <div v-else-if="!top.length" class="blank">
        <h3>등록된 공연이 없습니다</h3>
        <p>공연기획사 계정으로 첫 공연을 등록해 보세요.</p>
      </div>

      <ul v-else class="grid">
        <li v-for="(c, i) in top" :key="c.id"><CourseCard :course="c" :rank="i + 1" /></li>
      </ul>
    </section>

    <footer class="ft">
      <div class="wrap ft-in">
        <p class="ft-n">INTicket</p>
        <p class="small muted">좌석은 등급 단위로 예매되며, 같은 등급 안에서는 현장 배정됩니다</p>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import AppHeader from '@/components/AppHeader.vue'
import CourseCard from '@/components/CourseCard.vue'
import { useAuthStore } from '@/store/auth.js'
import { useCourseStore } from '@/store/course.js'
import { GENRES } from '@/domain/genre.js'

const auth = useAuthStore()
const store = useCourseStore()

const top = computed(() => store.ranked.slice(0, 5))

function pick(code) {
  store.setGenre(code)
}

// 로그인 없이도 인기 공연은 보여 준다. 예매 단계에서만 로그인을 요구한다.
onMounted(() => store.fetchCourses())
</script>

<style scoped>
.hero { background: var(--navy); color: #fff; }
.hero-in { display: grid; grid-template-columns: 1fr 320px; gap: 40px; align-items: center; padding-top: 54px; padding-bottom: 54px; }
.kicker { font-size: 12.5px; font-weight: 700; letter-spacing: .12em; color: #FF8494; margin-bottom: 12px; }
.hh { font-size: 36px; font-weight: 800; line-height: 1.28; letter-spacing: -0.05em; }
.hp { margin: 14px 0 26px; font-size: 15px; color: rgba(255,255,255,.68); }
.hbtn { display: flex; flex-wrap: wrap; gap: 9px; }
.hbtn .btn-line { background: transparent; color: #fff; border-color: rgba(255,255,255,.35); }
.hbtn .btn-line:hover { background: rgba(255,255,255,.1); border-color: rgba(255,255,255,.6); }

/* 장식용 포스터 타일 */
.hero-tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.tile {
  aspect-ratio: 3 / 4;
  border-radius: var(--r);
  display: grid;
  place-items: end start;
  padding: 10px;
  font-size: 12.5px;
  font-weight: 700;
  color: rgba(255,255,255,.85);
}
.t0 { background: linear-gradient(160deg,#7A1F2B,#B33A49); }
.t1 { background: linear-gradient(160deg,#123B33,#276B5C); }
.t2 { background: linear-gradient(160deg,#3A2352,#61407F); }
.t3 { background: linear-gradient(160deg,#14324F,#2A5C86); }

.qk { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 34px auto 46px; }
.qk-i {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 18px;
  border: 1px solid var(--line);
  border-radius: var(--r-lg);
  transition: border-color .15s var(--ease), background .15s var(--ease);
}
.qk-i:hover { border-color: var(--red); background: var(--red-wash); }
.qk-l { font-size: 15px; font-weight: 700; letter-spacing: -0.04em; }
.qk-a { color: var(--t4); font-size: 17px; }

.rank { padding-bottom: 70px; }
.grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 20px; }

.ft { border-top: 1px solid var(--line); background: var(--bg-soft); }
.ft-in { padding: 26px 20px; }
.ft-n { font-size: 14px; font-weight: 800; letter-spacing: -0.04em; color: var(--navy); margin-bottom: 4px; }

@media (max-width: 900px) {
  .hero-in { grid-template-columns: 1fr; padding-top: 38px; padding-bottom: 38px; }
  .hero-tiles { display: none; }
  .hh { font-size: 27px; }
  .qk { grid-template-columns: repeat(2, 1fr); }
  .grid { grid-template-columns: repeat(2, 1fr); }
}
</style>
