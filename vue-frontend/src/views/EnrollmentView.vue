<template>
  <div>
    <AppHeader />

    <main class="wrap page">
      <h1 class="ptitle">
        내 예매
        <span class="cnt">{{ store.items.length }}건</span>
      </h1>

      <div v-if="store.loading" class="load"><span class="spin"></span>예매 내역을 불러오는 중입니다</div>

      <div v-else-if="store.error" class="blank">
        <h3>예매 내역을 불러오지 못했습니다</h3>
        <p>{{ store.error }}</p>
        <button class="btn btn-line btn-sm" style="margin-top:14px" @click="store.fetchMine()">다시 시도</button>
      </div>

      <div v-else-if="!store.items.length" class="blank">
        <h3>예매한 공연이 없습니다</h3>
        <p>공연을 둘러보고 마음에 드는 공연을 예매해 보세요.</p>
        <router-link to="/courses" class="btn btn-red btn-sm" style="margin-top:14px">공연 보러 가기</router-link>
      </div>

      <template v-else>
        <p v-if="hasPending" class="alert alert-info pend">
          결제 처리 중인 예매가 있습니다. 결제가 끝나면 예매 확정으로 바뀝니다.
          <button class="refresh" @click="store.fetchMine()">새로고침</button>
        </p>

        <ul class="rows">
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

        <!-- AI가 보낸 좌석 제안 -->
        <section v-if="offers.length" class="osec">
          <h2 class="stitle">배정된 좌석</h2>
          <p class="onote small">
            취소표가 나와 조건에 맞는 좌석을 찾았습니다. 수락하시면 바로 예매됩니다.
          </p>

          <ul class="orows">
            <li v-for="o in offers" :key="o.offerId" class="orow">
              <div class="o-main">
                <p class="o-seats num">{{ o.seatsText || o.seats.join(', ') }}</p>
                <p class="o-msg">{{ o.message }}</p>
                <p v-if="o.reason" class="o-why">{{ o.reason }}</p>
              </div>
              <div class="o-act">
                <span class="o-left num">{{ leftText(o.expiresAt) }}</span>
                <button class="btn btn-red btn-sm" :disabled="accepting === o.offerId"
                        @click="accept(o)">
                  {{ accepting === o.offerId ? '처리 중' : '수락하고 예매' }}
                </button>
              </div>
            </li>
          </ul>
          <p v-if="offerErr" class="alert alert-err">{{ offerErr }}</p>
        </section>

        <!-- 취소표 대기 (Sprint2) -->
        <section v-if="wait.items.length" class="wsec">
          <h2 class="stitle">취소표 대기</h2>
          <p v-if="wait.hasWaiting" class="alert alert-info wnote">
            자리가 나면 대기 순서대로 <b>자동으로 예매·결제까지</b> 처리됩니다.
            이 화면을 열어두시면 {{ POLL_SEC }}초마다 확인합니다.
            <button class="refresh" @click="wait.fetchMine()">지금 확인</button>
          </p>

          <ul class="wrows">
            <li v-for="w in wait.items" :key="w.id" class="wrow">
              <span class="bdg" :class="WAIT_STYLE[w.status]">{{ WAIT_LABEL[w.status] }}</span>
              <router-link :to="`/courses/${w.courseId}`" class="wttl">{{ courseTitle(w.courseId) }}</router-link>
              <span class="wat num">{{ fmt(w.createdAt) }} 등록</span>
              <span v-if="w.status === 'MATCHED'" class="wdone">자동 예매 완료 — 위 목록에서 확인하세요</span>
            </li>
          </ul>
        </section>

        <p class="foot-note small muted">
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
import { seatWishApi } from '@/api/seatWish.js'
import { bookingApi } from '@/api/booking.js'
import { genreLabel } from '@/domain/genre.js'

const store = useEnrollmentStore()
const wait = useWaitlistStore()
const courses = useCourseStore()
const POLL_SEC = 15

/* AI 좌석 제안 — 취소가 발생하면 서버가 조건에 맞는 대기자에게 발행한다.
   푸시가 없으므로 대기 폴링과 같은 주기로 함께 확인한다. */
const offers = ref([])
const accepting = ref(null)
const offerErr = ref('')

async function loadOffers() {
  try {
    offers.value = (await seatWishApi.myOffers()).filter((o) => o.status === 'PENDING' || !o.status)
  } catch {
    offers.value = []   // 비로그인·미배포 등은 조용히 넘어간다
  }
}

function leftText(expiresAt) {
  if (!expiresAt) return ''
  const sec = Math.max(0, Math.round(expiresAt - Date.now() / 1000))
  const m = Math.floor(sec / 60)
  return sec === 0 ? '만료됨' : `${m}분 ${sec % 60}초 남음`
}

async function accept(o) {
  accepting.value = o.offerId
  offerErr.value = ''
  try {
    const r = await seatWishApi.acceptOffer(o.offerId)
    if (r && r.success === false) {
      offerErr.value = r.message || '제안을 수락하지 못했습니다.'
    }
    await loadOffers()
    await store.fetchMine()
  } catch (e) {
    console.error('[offer] 수락 실패:', e)
    offerErr.value = e.response?.data?.detail || '제안을 수락하지 못했습니다.'
  } finally {
    accepting.value = null
  }
}

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
      cancelErr.value =
        '이 서버에는 아직 예매 취소 기능이 배포되지 않았습니다. ' +
        '백엔드 컨테이너를 최신 소스로 다시 빌드해야 동작합니다.'
    } else {
      cancelErr.value = err.response?.data?.message || '예매를 취소하지 못했습니다.'
    }
  } finally {
    busy.value = null
  }
}

onBeforeUnmount(() => wait.stopPolling())

onMounted(async () => {
  await wait.fetchMine()
  await loadOffers()
  // 대기 목록에 공연명을 붙이려면 공연 목록이 필요하다.
  if (wait.items.length && !courses.courses.length) courses.fetchCourses()
  // 서버가 매칭을 먼저 알려주지 않으므로 대기 중일 때만 주기적으로 다시 읽는다.
  wait.startPolling(() => { store.fetchMine(); loadOffers() }, POLL_SEC * 1000)

  await store.fetchMine()
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
// 회차·등급·매수는 백엔드가 아직 모르는 값이라 예매 시점에 브라우저에 붙여 둔 것을 읽는다.
function detail(e) {
  return bookingApi.detailOf(e.id)
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

.osec { margin-top: 40px; }
.onote { color: var(--t2); margin-bottom: 12px; }
.orows { border-top: 2px solid var(--ai); }
.orow {
  display: flex; align-items: flex-start; gap: 16px;
  padding: 14px 6px; border-bottom: 1px solid var(--line);
  background: var(--ai-wash);
}
.o-main { flex: 1; min-width: 0; }
.o-seats { font-size: 16px; font-weight: 800; letter-spacing: -0.02em; }
.o-msg { font-size: 13.5px; color: var(--t1); margin-top: 5px; line-height: 1.6; }
.o-why { font-size: 12px; color: var(--t3); margin-top: 4px; line-height: 1.55; }
.o-act { display: flex; flex-direction: column; align-items: flex-end; gap: 7px; flex-shrink: 0; }
.o-left { font-size: 11.5px; color: var(--red); font-weight: 700; }

.wsec { margin-top: 40px; }
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
}
</style>
