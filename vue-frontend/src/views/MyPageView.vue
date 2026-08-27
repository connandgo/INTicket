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

      <!-- 공연기획사: 회차별 판매 현황 -->
      <section v-if="isPlanner && myCourses.length" class="sec">
        <h2 class="stitle">판매 현황</h2>
        <div v-for="c in myCourses" :key="'s' + c.id" class="salesblk">
          <p class="sc-t">{{ c.title }}</p>
          <ul class="sc-rows">
            <li v-for="r in salesOf(c.id)" :key="r.id" class="sc-row">
              <span class="sc-when num">{{ r.date.replaceAll('-', '.') }} ({{ r.weekday }}) {{ r.time }}</span>
              <span class="sc-bar"><i :style="{ width: r.rate + '%' }"></i></span>
              <span class="sc-n num">{{ r.sold }} / {{ r.capacity }}</span>
              <span class="sc-p num" :class="{ hot: r.rate >= 80 }">{{ r.rate }}%</span>
            </li>
          </ul>
        </div>
      </section>

      <!-- 관람객: 내 예매 -->
      <section v-if="!isPlanner" class="sec">
        <h2 class="stitle">
          내 예매
          <router-link to="/enrollments" class="more">전체 보기 ›</router-link>
        </h2>

        <div v-if="enroll.loading" class="load"><span class="spin"></span>불러오는 중입니다</div>

        <div v-else-if="enroll.error" class="blank">
          <h3>예매 내역을 불러오지 못했습니다</h3>
          <p>{{ enroll.error }}</p>
        </div>

        <div v-else-if="!enroll.items.length" class="blank">
          <h3>아직 예매한 공연이 없습니다</h3>
          <p>마음에 드는 공연을 골라 예매해 보세요.</p>
          <router-link to="/courses" class="btn btn-red btn-sm" style="margin-top:14px">공연 보러 가기</router-link>
        </div>

        <ul v-else class="mine">
          <li v-for="e in recentBookings" :key="e.id" class="mrow">
            <router-link :to="`/courses/${e.courseId}`" class="mposter">
              <PosterArt :id="e.courseId" :title="bookTitle(e)" :genre="bookGenre(e)" />
            </router-link>
            <div class="mmain">
              <span class="bdg bdg-gray">{{ bookGenre(e) }}</span>
              <router-link :to="`/courses/${e.courseId}`" class="mttl">{{ bookTitle(e) }}</router-link>
              <span class="mat num">예매번호 {{ e.id }}</span>
            </div>
            <span class="bdg" :class="STATUS_STYLE[e.status]">{{ STATUS_LABEL[e.status] }}</span>
          </li>
        </ul>

        <p v-if="enroll.items.length > 3" class="small muted more-note">
          최근 {{ recentBookings.length }}건만 보여드립니다. 나머지는
          <router-link to="/enrollments" class="lk">내 예매</router-link>에서 확인하세요.
        </p>
      </section>

    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import AppHeader from '@/components/AppHeader.vue'
import PosterArt from '@/components/PosterArt.vue'
import { useAuthStore } from '@/store/auth.js'
import { useCourseStore } from '@/store/course.js'
import { genreLabel } from '@/domain/genre.js'
import { performanceApi } from '@/api/performance.js'
import { useEnrollmentStore, STATUS_LABEL, STATUS_STYLE } from '@/store/enrollment.js'

const auth = useAuthStore()
const course = useCourseStore()
const enroll = useEnrollmentStore()

const recentBookings = computed(() => enroll.items.slice(0, 3))
function bookTitle(e) {
  return e.course?.title || `공연 #${e.courseId}`
}
function bookGenre(e) {
  return genreLabel(e.course?.category)
}

const isPlanner = computed(() => auth.user?.role === 'INSTRUCTOR')

// UI-007 — 기획사 공연 관리는 신규 API 없이 목록을 받아 client filter 한다(명세서 9).
const myCourses = computed(() =>
  course.courses.filter((c) => String(c.instructorId) === String(auth.user?.id))
)

// 회차별 판매율. performance-service가 생기면 api/performance.js 안만 바뀐다.
const sales = ref({})
function salesOf(courseId) {
  return sales.value[courseId] || []
}
async function loadSales(list) {
  const out = {}
  for (const c of list) {
    try { out[c.id] = await performanceApi.sales(c) } catch { out[c.id] = [] }
  }
  sales.value = out
}

onMounted(async () => {
  if (isPlanner.value) {
    await course.fetchCourses()
    await loadSales(myCourses.value)
  } else {
    enroll.fetchMine()
  }
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
.stitle { display: flex; align-items: baseline; justify-content: space-between; }
.more { font-size: 12.5px; font-weight: 500; color: var(--t3); }
.more:hover { color: var(--red); }

.mine { border-top: 1px solid var(--line); }
.mrow {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 4px;
  border-bottom: 1px solid var(--line);
}
.mposter { width: 52px; border-radius: var(--r); overflow: hidden; flex-shrink: 0; }
.mmain { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; margin-right: auto; min-width: 0; }
.mttl { font-size: 14.5px; font-weight: 700; letter-spacing: -0.04em; }
.mttl:hover { color: var(--red); text-decoration: underline; text-underline-offset: 3px; }
.mat { font-size: 11.5px; color: var(--t3); }
.more-note { margin-top: 10px; }

.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(196px, 1fr)); gap: 28px 20px; }

.salesblk { margin-bottom: 24px; }
.sc-t { font-size: 14px; font-weight: 700; letter-spacing: -0.04em; margin-bottom: 8px; }
.sc-rows { border-top: 1px solid var(--line); }
.sc-row {
  display: grid;
  grid-template-columns: 190px 1fr 90px 48px;
  gap: 14px;
  align-items: center;
  padding: 10px 4px;
  border-bottom: 1px solid var(--line);
}
.sc-when { font-size: 13px; color: var(--t2); }
.sc-bar { height: 7px; background: var(--bg-dim); border-radius: 4px; overflow: hidden; }
.sc-bar i { display: block; height: 100%; background: var(--navy); }
.sc-n { font-size: 12px; color: var(--t3); text-align: right; }
.sc-p { font-size: 13px; font-weight: 700; text-align: right; }
.sc-p.hot { color: var(--red); }

.tbl { width: 100%; border-collapse: collapse; border-top: 2px solid var(--navy); }
.tbl th, .tbl td { padding: 12px 10px; border-bottom: 1px solid var(--line); font-size: 13.5px; text-align: left; }
.tbl th { background: var(--bg-soft); font-weight: 600; color: var(--t2); font-size: 12.5px; }
.tbl .r { text-align: right; }
.lk { font-weight: 600; }
.lk:hover { color: var(--red); text-decoration: underline; text-underline-offset: 3px; }

@media (max-width: 760px) {
  .grid { grid-template-columns: repeat(2, 1fr); gap: 22px 12px; }
  .tbl { display: block; overflow-x: auto; white-space: nowrap; }
  .sc-row { grid-template-columns: 1fr 60px 44px; row-gap: 4px; }
  .sc-when { grid-column: 1 / -1; }
}
</style>
