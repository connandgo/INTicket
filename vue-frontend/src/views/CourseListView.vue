<template>
  <div>
    <AppHeader />

    <main class="wrap page">
      <h1 class="ptitle">
        공연
        <span class="cnt">{{ list.length }}건</span>
      </h1>

      <!-- 장르 -->
      <div class="tabs">
        <button
          v-for="t in GENRE_TABS"
          :key="t.code"
          class="tab"
          :class="{ on: store.genre === t.code }"
          @click="store.setGenre(t.code)"
        >{{ t.label }}</button>
      </div>

      <div class="search">
        <input
          v-model.trim="q"
          class="inp"
          type="search"
          placeholder="공연명을 입력하세요"
          aria-label="공연 검색"
        />
        <button v-if="q" class="clear" type="button" @click="q = ''" aria-label="검색어 지우기">✕</button>
      </div>

      <div class="bar">
        <div class="sorts">
          <button class="sort" :class="{ on: sort === 'pop' }" @click="sort = 'pop'">인기순</button>
          <span class="sep">|</span>
          <button class="sort" :class="{ on: sort === 'new' }" @click="sort = 'new'">최신순</button>
          <span class="sep">|</span>
          <button class="sort" :class="{ on: sort === 'low' }" @click="sort = 'low'">낮은 가격순</button>
        </div>
        <router-link v-if="isPlanner" to="/courses/new" class="btn btn-line btn-sm">공연 등록</router-link>
      </div>

      <p v-if="store.isShowcase" class="preview small">
        지금은 <b>둘러보기</b>입니다. 로그인하시면 실시간 잔여 좌석과 예매가 가능합니다.
        <router-link to="/login" class="p-lk">로그인</router-link>
      </p>

      <div v-if="store.loading" class="load"><span class="spin"></span>공연을 불러오는 중입니다</div>

      <div v-else-if="store.error" class="blank">
        <h3>공연 목록을 불러오지 못했습니다</h3>
        <p>{{ store.error }}</p>
        <button class="btn btn-line btn-sm" style="margin-top:14px" @click="store.fetchCourses()">다시 시도</button>
      </div>

      <div v-else-if="!list.length" class="blank">
        <h3>{{ q ? '검색 결과가 없습니다' : '등록된 공연이 없습니다' }}</h3>
        <p v-if="q">'{{ q }}'와 일치하는 공연이 없습니다.</p>
        <p v-else>{{ store.genre === 'ALL' ? '아직 등록된 공연이 없습니다.' : '이 장르에 등록된 공연이 없습니다.' }}</p>
      </div>

      <ul v-else class="grid">
        <li v-for="(c, i) in list" :key="c.id" class="up" :style="{ animationDelay: i * 35 + 'ms' }">
          <CourseCard :course="c" :rank="sort === 'pop' && i < 3 ? i + 1 : 0" />
        </li>
      </ul>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import AppHeader from '@/components/AppHeader.vue'
import CourseCard from '@/components/CourseCard.vue'
import { useCourseStore } from '@/store/course.js'
import { useAuthStore } from '@/store/auth.js'
import { GENRE_TABS } from '@/domain/genre.js'

const store = useCourseStore()
const auth = useAuthStore()
const sort = ref('pop')

const isPlanner = computed(() => auth.user?.role === 'INSTRUCTOR')

const q = ref('')

const list = computed(() => {
  const kw = q.value.trim().toLowerCase()
  let arr = [...store.visible]
  // 공연명 부분 일치. 결과가 없으면 빈 목록을 그대로 보여 준다.
  if (kw) arr = arr.filter((c) => (c.title || '').toLowerCase().includes(kw))
  if (sort.value === 'pop') return arr.sort((a, b) => (b.enrollmentCount || 0) - (a.enrollmentCount || 0))
  if (sort.value === 'low') return arr.sort((a, b) => Number(a.price) - Number(b.price))
  return arr.sort((a, b) => Number(b.id) - Number(a.id))
})

onMounted(() => store.fetchCourses())
</script>

<style scoped>
.search { position: relative; margin-bottom: 16px; max-width: 420px; }
.search .inp { padding-right: 34px; }
.clear {
  position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
  width: 20px; height: 20px; border-radius: 50%;
  display: grid; place-items: center;
  background: var(--bg-dim); color: var(--t2); font-size: 11px;
}
.clear:hover { background: var(--line-dark); }

.bar { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-bottom: 18px; }
.sorts { display: flex; align-items: center; gap: 9px; }
.sort { font-size: 13px; color: var(--t3); }
.sort:hover { color: var(--t1); }
.sort.on { color: var(--t1); font-weight: 700; }
.sep { color: var(--line-dark); font-size: 11px; }

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(196px, 1fr));
  gap: 30px 20px;
}

@media (max-width: 760px) {
  .grid { grid-template-columns: repeat(2, 1fr); gap: 22px 12px; }
}
</style>
