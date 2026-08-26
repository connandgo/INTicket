<template>
  <div>
    <AppHeader />

    <main class="wrap page">
      <h1 class="ptitle">마이페이지</h1>

      <!-- 계정 -->
      <section class="acct">
        <div class="av">{{ (auth.user?.name || '?').charAt(0) }}</div>
        <div class="acct-t">
          <p class="nm">{{ auth.user?.name || '회원' }}</p>
          <p class="small muted">{{ auth.user?.email || '' }}</p>
        </div>
        <span class="bdg bdg-solid">{{ isPlanner ? '공연기획사' : '관람객' }}</span>
      </section>

      <!-- 공연기획사: 내가 등록한 공연 -->
      <section v-if="isPlanner" class="sec">
        <h2 class="stitle">등록한 공연</h2>

        <div v-if="course.loading" class="load"><span class="spin"></span>불러오는 중입니다</div>
        <div v-else-if="!myCourses.length" class="blank">
          <h3>등록한 공연이 없습니다</h3>
          <p>첫 공연을 등록하면 바로 예매를 받을 수 있습니다.</p>
          <router-link to="/courses/new" class="btn btn-red btn-sm" style="margin-top:14px">공연 등록하기</router-link>
        </div>

        <table v-else class="tbl">
          <thead>
            <tr>
              <th>공연명</th><th>장르</th><th class="r">티켓 가격</th><th class="r">누적 예매</th><th class="r">상태</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in myCourses" :key="c.id">
              <td><router-link :to="`/courses/${c.id}`" class="lk">{{ c.title }}</router-link></td>
              <td>{{ genreLabel(c.category) }}</td>
              <td class="r num">{{ Number(c.price).toLocaleString() }}원</td>
              <td class="r num">{{ (c.enrollmentCount || 0).toLocaleString() }}건</td>
              <td class="r">
                <span class="bdg" :class="c.status === 'ACTIVE' ? 'bdg-ok' : 'bdg-gray'">
                  {{ c.status === 'ACTIVE' ? '예매 가능' : '예매 중지' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- 관람객: 추천 공연 -->
      <section v-else class="sec">
        <h2 class="stitle">추천 공연</h2>

        <div v-if="rec.loading" class="load"><span class="spin"></span>추천을 불러오는 중입니다</div>

        <div v-else-if="rec.error" class="blank">
          <h3>추천을 불러오지 못했습니다</h3>
          <p>{{ rec.error }}</p>
          <button class="btn btn-line btn-sm" style="margin-top:14px" @click="loadRec">다시 시도</button>
        </div>

        <div v-else-if="!rec.items.length" class="blank">
          <h3>추천할 공연이 아직 없습니다</h3>
          <p>공연을 한 편 예매하시면 취향에 맞는 공연을 골라 드립니다.</p>
          <router-link to="/courses" class="btn btn-red btn-sm" style="margin-top:14px">공연 보러 가기</router-link>
        </div>

        <template v-else>
          <p class="recmsg">{{ rec.message }}</p>
          <ul class="grid">
            <li v-for="c in rec.items" :key="c.id"><CourseCard :course="c" /></li>
          </ul>
        </template>
      </section>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive } from 'vue'
import AppHeader from '@/components/AppHeader.vue'
import CourseCard from '@/components/CourseCard.vue'
import { useAuthStore } from '@/store/auth.js'
import { useCourseStore } from '@/store/course.js'
import { recommendApi } from '@/api/enrollment.js'
import { genreLabel } from '@/domain/genre.js'

const auth = useAuthStore()
const course = useCourseStore()

const isPlanner = computed(() => auth.user?.role === 'INSTRUCTOR')

// UI-007 — 기획사 공연 관리는 신규 API 없이 목록을 받아 client filter 한다(명세서 9).
const myCourses = computed(() =>
  course.courses.filter((c) => String(c.instructorId) === String(auth.user?.id))
)

const rec = reactive({ items: [], message: '', loading: false, error: null })

async function loadRec() {
  const uid = auth.user?.id
  if (!uid) {
    rec.error = '사용자 정보를 확인할 수 없습니다.'
    return
  }
  rec.loading = true
  rec.error = null
  try {
    const res = await recommendApi.forUser(uid)
    const d = res?.data?.data ?? res?.data ?? {}
    rec.items = Array.isArray(d.recommendedCourses) ? d.recommendedCourses : []
    rec.message = d.message || ''
  } catch (e) {
    console.error('[mypage] 추천 조회 실패:', e)
    rec.error = e.response?.data?.message || '추천 서비스에 연결하지 못했습니다.'
    rec.items = []
  } finally {
    rec.loading = false
  }
}

onMounted(() => {
  if (isPlanner.value) course.fetchCourses()
  else loadRec()
})
</script>

<style scoped>
.acct {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 20px;
  border: 1px solid var(--line);
  border-radius: var(--r-lg);
  background: var(--bg-soft);
  margin-bottom: 40px;
}
.av {
  width: 46px; height: 46px;
  display: grid; place-items: center;
  border-radius: 50%;
  background: var(--navy);
  color: #fff;
  font-size: 18px; font-weight: 700;
}
.acct-t { margin-right: auto; }
.nm { font-size: 16px; font-weight: 700; letter-spacing: -0.04em; }

.sec { margin-bottom: 44px; }
.recmsg { font-size: 13.5px; color: var(--t2); margin-bottom: 16px; }

.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(196px, 1fr)); gap: 28px 20px; }

.tbl { width: 100%; border-collapse: collapse; border-top: 2px solid var(--navy); }
.tbl th, .tbl td { padding: 12px 10px; border-bottom: 1px solid var(--line); font-size: 13.5px; text-align: left; }
.tbl th { background: var(--bg-soft); font-weight: 600; color: var(--t2); font-size: 12.5px; }
.tbl .r { text-align: right; }
.lk { font-weight: 600; }
.lk:hover { color: var(--red); text-decoration: underline; text-underline-offset: 3px; }

@media (max-width: 760px) {
  .grid { grid-template-columns: repeat(2, 1fr); gap: 22px 12px; }
  .tbl { display: block; overflow-x: auto; white-space: nowrap; }
}
</style>
