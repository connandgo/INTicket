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

        <p class="foot-note small muted">
          취소하면 결제도 함께 취소되고 좌석이 다시 풀립니다. 실제 환불 트랜잭션은 발생하지 않는 모의 결제입니다.
        </p>
      </template>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import AppHeader from '@/components/AppHeader.vue'
import PosterArt from '@/components/PosterArt.vue'
import { useEnrollmentStore, STATUS_LABEL, STATUS_STYLE } from '@/store/enrollment.js'
import { bookingApi } from '@/api/booking.js'
import { genreLabel } from '@/domain/genre.js'

const store = useEnrollmentStore()
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
    cancelErr.value =
      err.response?.status === 403
        ? '본인의 예매만 취소할 수 있습니다.'
        : err.response?.data?.message || '예매를 취소하지 못했습니다.'
  } finally {
    busy.value = null
  }
}

onMounted(async () => {
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

.foot-note { margin-top: 16px; }

@media (max-width: 760px) {
  .row { grid-template-columns: 56px 1fr; row-gap: 10px; }
  .rposter { width: 56px; }
  .rside { grid-column: 2; flex-direction: row; align-items: center; justify-content: flex-start; }
}
</style>
