<template>
  <div>
    <AppHeader />

    <main class="wrap page">
      <h1 class="ptitle">
        내 예매
        <span class="cnt">{{ store.items.length }}건</span>
      </h1>

      <div v-if="store.loading && !store.loaded" class="load"><span class="spin"></span>예매 내역을 불러오는 중입니다</div>

      <template v-else>
        <p v-if="store.error" class="alert alert-err action-alert">
          <span>{{ store.error }}</span>
          <button class="btn btn-line btn-sm" @click="store.fetchMine()">다시 시도</button>
        </p>

        <div v-if="!store.items.length" class="blank compact">
          <h3>예매한 공연이 없습니다</h3>
          <p>공연을 둘러보고 마음에 드는 공연을 예매해 보세요.</p>
          <router-link to="/courses" class="btn btn-red btn-sm blank-action">공연 보러 가기</router-link>
        </div>

        <p v-if="hasPending" class="alert alert-info pend">
          결제 처리 중인 예매가 있습니다. 결제가 끝나면 예매 확정으로 바뀝니다.
          <button class="refresh" @click="store.fetchMine()">새로고침</button>
        </p>

        <ul v-if="store.items.length" class="rows">
          <li v-for="e in store.items" :key="e.id" class="row">
            <router-link :to="`/courses/${e.courseId}`" class="rposter">
              <PosterArt :id="e.courseId" :title="title(e)" :genre="genre(e)" />
            </router-link>

            <div class="rmain">
              <span class="bdg bdg-gray">{{ genre(e) }}</span>
              <router-link :to="`/courses/${e.courseId}`" class="rttl">{{ title(e) }}</router-link>
              <p v-if="detail(e)" class="seat num">
                {{ detail(e).grade }}석 · {{ detail(e).quantity }}매
              </p>
              <dl class="meta num">
                <div><dt>예매번호</dt><dd>{{ e.id }}</dd></div>
                <div v-if="e.createdAt"><dt>예매일</dt><dd>{{ fmt(e.createdAt) }}</dd></div>
              </dl>
            </div>

            <div class="rside">
              <span class="bdg" :class="STATUS_STYLE[e.status]">{{ STATUS_LABEL[e.status] }}</span>
              <span v-if="detail(e)" class="rprice num">{{ detail(e).amount.toLocaleString() }}원</span>
              <span v-else-if="e.course?.price" class="rprice num">{{ Number(e.course.price).toLocaleString() }}원</span>

              <!-- 취소는 되돌릴 수 없어서 한 번 더 확인받는다 -->
              <template v-if="e.status !== 'CANCELLED'">
                <button
                  v-if="confirming !== e.id"
                  class="btn btn-line btn-sm"
                  :disabled="busy === e.id"
                  @click="confirming = e.id"
                >예매 취소</button>
                <span v-else class="confirm">
                  <span class="c-q">취소할까요?</span>
                  <button class="btn btn-red btn-sm" :disabled="busy === e.id" @click="doCancel(e)">
                    {{ busy === e.id ? '취소 중' : '네, 취소' }}
                  </button>
                  <button class="btn btn-ghost btn-sm" :disabled="busy === e.id" @click="confirming = null">아니요</button>
                </span>
              </template>
            </div>
          </li>
        </ul>

        <p v-if="cancelErr" class="alert alert-err">{{ cancelErr }}</p>

        <section v-if="wait.loading || wait.error || wait.items.length" class="wsec">
          <h2 class="stitle">취소표 대기</h2>
          <div v-if="wait.loading && !wait.items.length" class="load inline-load"><span class="spin"></span>대기 내역을 불러오는 중입니다</div>
          <p v-else-if="wait.error" class="alert alert-err action-alert">
            <span>{{ wait.error }}</span>
            <button class="btn btn-line btn-sm" @click="wait.fetchMine()">다시 시도</button>
          </p>
          <p v-if="wait.hasWaiting" class="alert alert-info wnote">
            자리가 나면 대기 순서대로 <b>자동으로 예매·결제까지</b> 처리됩니다.
            이 화면을 열어두시면 {{ POLL_SEC }}초마다 확인합니다.
            <button class="refresh" @click="wait.fetchMine()">지금 확인</button>
          </p>

          <ul v-if="wait.items.length" class="wrows">
            <li v-for="w in wait.items" :key="w.id" class="wrow">
              <span class="bdg" :class="WAIT_STYLE[w.status]">{{ WAIT_LABEL[w.status] }}</span>
              <router-link :to="`/courses/${w.courseId}`" class="wttl">{{ courseTitle(w.courseId) }}</router-link>
              <span class="wat num">{{ fmt(w.createdAt) }} 등록</span>
              <span v-if="w.status === 'MATCHED'" class="wdone">자동 예매 완료 — 위 목록에서 확인하세요</span>
            </li>
          </ul>
        </section>

        <p v-if="store.items.length || wait.items.length" class="foot-note small muted">
          취소하면 결제도 함께 취소되고 좌석이 다시 풀립니다. 실제 환불 트랜잭션은 발생하지 않는 모의 결제입니다.
        </p>
      </template>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import AppHeader from '@/components/AppHeader.vue'
import PosterArt from '@/components/PosterArt.vue'
import { useEnrollmentStore, STATUS_LABEL, STATUS_STYLE } from '@/store/enrollment.js'
import { useWaitlistStore, WAIT_LABEL, WAIT_STYLE } from '@/store/waitlist.js'
import { useCourseStore } from '@/store/course.js'
import { isNotDeployed } from '@/domain/soldout.js'
import { bookingApi } from '@/api/booking.js'
import { genreLabel } from '@/domain/genre.js'

const store = useEnrollmentStore()
const wait = useWaitlistStore()
const courses = useCourseStore()
const POLL_SEC = 15

// 대기 응답에는 courseId 만 온다. 공연명은 목록에서 찾아 붙인다.
function courseTitle(id) {
  return courses.courses.find((c) => c.id === Number(id))?.title || `공연 #${id}`
}
const hasPending = computed(() => store.items.some((e) => e.status === 'PENDING'))

const confirming = ref(null)   // 취소 확인을 기다리는 예매 id
const busy = ref(null)
const cancelErr = ref('')

async function doCancel(e) {
  busy.value = e.id
  cancelErr.value = ''
  try {
    await store.cancel(e)
    confirming.value = null
  } catch (err) {
    console.error('[enrollment] 취소 실패:', err)
    if (err.response?.status === 403) {
      cancelErr.value = '본인의 예매만 취소할 수 있습니다.'
    } else if (isNotDeployed(err)) {
      cancelErr.value = '예매 취소 요청을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.'
    } else {
      cancelErr.value = err.response?.data?.message || '예매를 취소하지 못했습니다.'
    }
  } finally {
    busy.value = null
  }
}

onBeforeUnmount(() => wait.stopPolling())

onMounted(async () => {
  await Promise.all([wait.fetchMine(), store.fetchMine()])
  // 대기 목록에 공연명을 붙이려면 공연 목록이 필요하다.
  if (wait.items.length && !courses.courses.length) await courses.fetchCourses()
  // 서버가 매칭을 먼저 알려주지 않으므로 대기 중일 때만 주기적으로 다시 읽는다.
  wait.startPolling(() => store.fetchMine(), POLL_SEC * 1000)

  // 모의 결제가 곧바로 끝나므로 PENDING이 남아 있으면 잠깐 뒤 한 번 더 읽는다.
  if (store.items.some((e) => e.status === 'PENDING')) {
    setTimeout(() => store.fetchMine(), 1500)
  }
})

// EnrollmentResponse.course(CourseSummary)는 비어 있을 수 있다. 없으면 ID로 버틴다.
function title(e) {
  return e.course?.title || `공연 #${e.courseId}`
}
function genre(e) {
  return genreLabel(e.course?.category)
}
// 실서버 응답에 booking이 포함된다. 데모 데이터만 브라우저 저장값을 보조로 쓴다.
function detail(e) {
  return e.booking || bookingApi.detailOf(e.id)
}

function fmt(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
</script>

<style scoped>
.pend { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.action-alert { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
.action-alert .btn { flex-shrink: 0; }
.blank.compact { padding: 34px 20px; }
.blank-action { margin-top: 14px; }
.refresh { margin-left: auto; font-size: 12.5px; font-weight: 600; text-decoration: underline; text-underline-offset: 2px; }

.rows { border-top: 2px solid var(--navy); }
.row {
  display: grid;
  grid-template-columns: 72px 1fr auto;
  gap: 18px;
  align-items: center;
  padding: 16px 6px;
  border-bottom: 1px solid var(--line);
}
.rposter { width: 72px; border-radius: var(--r); overflow: hidden; }
.rmain { display: flex; flex-direction: column; align-items: flex-start; gap: 5px; min-width: 0; }
.rttl { font-size: 16px; font-weight: 700; letter-spacing: -0.04em; }
.rttl:hover { color: var(--red); text-decoration: underline; text-underline-offset: 3px; }
.seat { font-size: 12.5px; font-weight: 600; color: var(--navy); }
.meta { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 2px; }
.meta > div { display: flex; gap: 6px; font-size: 12px; }
.meta dt { color: var(--t4); }
.meta dd { color: var(--t2); }

.rside { display: flex; flex-direction: column; align-items: flex-end; gap: 7px; }
.confirm { display: inline-flex; align-items: center; gap: 6px; }
.c-q { font-size: 12px; color: var(--t2); }
.rprice { font-size: 14px; font-weight: 700; }

.wsec { margin-top: 40px; }
.inline-load { min-height: 96px; }
.wnote { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.wnote b { font-weight: 700; }
.wrows { border-top: 2px solid var(--navy); }
.wrow {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 12px 4px;
  border-bottom: 1px solid var(--line);
}
.wttl { font-size: 14px; font-weight: 700; }
.wttl:hover { color: var(--red); text-decoration: underline; text-underline-offset: 3px; }
.wat { font-size: 12px; color: var(--t3); }
.wdone { font-size: 12px; color: var(--ok); font-weight: 600; margin-left: auto; }

.foot-note { margin-top: 16px; }

@media (max-width: 760px) {
  .row { grid-template-columns: 56px 1fr; row-gap: 10px; }
  .rposter { width: 56px; }
  .rside { grid-column: 2; flex-direction: row; align-items: center; justify-content: flex-start; }
  .confirm { flex-wrap: wrap; }
  .action-alert, .wnote { align-items: flex-start; flex-direction: column; }
  .action-alert .btn, .refresh { margin-left: 0; }
}
</style>
