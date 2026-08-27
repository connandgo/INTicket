<template>
  <div v-if="offer" class="overlay" role="presentation" @click.self="dismiss">
    <section class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="ai-offer-title">
      <div class="accent"></div>
      <header class="head">
        <span class="bdg bdg-ai-solid">AI 취소표 매칭</span>
        <button type="button" class="close" aria-label="알림 닫기" @click="dismiss">×</button>
      </header>

      <h2 id="ai-offer-title">원하던 취소표가 나왔습니다</h2>
      <p class="course">{{ course?.title || `공연 #${offer.courseId}` }}</p>

      <dl class="summary">
        <div><dt>배정 좌석</dt><dd>{{ seatsLabel(offer.seats) }}</dd></div>
        <div><dt>결제 가능 시간</dt><dd class="left num">{{ leftText }}</dd></div>
      </dl>

      <p class="guide">지금 결제하시겠어요? 결제를 선택하면 배정 좌석을 그대로 선점하고 결제 단계로 이동합니다.</p>
      <p v-if="error" class="alert alert-err">{{ error }}</p>

      <div class="actions">
        <button type="button" class="btn btn-line" :disabled="busy" @click="dismiss">이번에는 안 함</button>
        <button type="button" class="btn btn-red" :disabled="busy || expired" @click="goPayment">
          <span v-if="busy" class="spin spin-w"></span>
          {{ expired ? '제안 만료' : busy ? '결제 준비 중' : '결제하기' }}
        </button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/store/auth.js'
import { courseApi } from '@/api/course.js'
import { performanceApi } from '@/api/performance.js'
import { seatWishApi, seatsLabel } from '@/api/seatWish.js'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const offer = ref(null)
const course = ref(null)
const busy = ref(false)
const error = ref('')
const now = ref(Date.now())
const dismissed = new Set()
let poller = null
let ticker = null

const canPoll = computed(() => auth.isAuthenticated && auth.user?.role !== 'INSTRUCTOR')
const remainingSeconds = computed(() => Math.max(0, Math.ceil(Number(offer.value?.expiresAt || 0) - now.value / 1000)))
const expired = computed(() => remainingSeconds.value === 0)
const leftText = computed(() => {
  const sec = remainingSeconds.value
  if (!sec) return '만료됨'
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`
})

function unwrap(res) {
  const data = res?.data
  return data && typeof data === 'object' && 'data' in data ? data.data : data
}

async function poll() {
  if (
    !canPoll.value || offer.value || route.name === 'SeatWish' ||
    document.querySelector('[aria-labelledby="match-result-title"]')
  ) return
  try {
    const offers = await seatWishApi.myOffers()
    const next = offers.find((item) =>
      (!item.status || item.status === 'PENDING') && !dismissed.has(item.offerId)
    )
    if (!next) return
    offer.value = next
    error.value = ''
    course.value = unwrap(await courseApi.getById(next.courseId))
  } catch {
    // 추천 서비스가 준비 중이어도 다른 페이지 사용을 방해하지 않는다.
  }
}

function dismiss() {
  if (offer.value?.offerId) dismissed.add(offer.value.offerId)
  offer.value = null
  course.value = null
  error.value = ''
}

async function goPayment() {
  if (!offer.value || !course.value || expired.value) return
  busy.value = true
  error.value = ''
  try {
    const rounds = await performanceApi.rounds(course.value)
    const round = rounds?.[0]
    if (!round) throw new Error('결제할 회차를 찾을 수 없습니다.')

    await seatWishApi.acceptOffer(offer.value.offerId)
    const target = {
      path: `/courses/${offer.value.courseId}/booking`,
      query: { round: round.id, seats: (offer.value.seats || []).join(',') }
    }
    offer.value = null
    course.value = null
    await router.push(target)
  } catch (e) {
    console.error('[ai-offer] 결제 이동 실패:', e)
    error.value = e.response?.data?.detail || e.response?.data?.message || e.message || '결제 화면을 준비하지 못했습니다.'
  } finally {
    busy.value = false
  }
}

function restartPolling() {
  if (poller) clearInterval(poller)
  poller = null
  if (!canPoll.value) {
    offer.value = null
    return
  }
  poll()
  poller = setInterval(poll, 3500)
}

watch(canPoll, restartPolling)
watch(() => route.fullPath, () => { if (!offer.value) poll() })

onMounted(() => {
  restartPolling()
  ticker = setInterval(() => { now.value = Date.now() }, 1000)
  window.addEventListener('ai-offer:refresh', poll)
})

onBeforeUnmount(() => {
  if (poller) clearInterval(poller)
  if (ticker) clearInterval(ticker)
  window.removeEventListener('ai-offer:refresh', poll)
})
</script>

<style scoped>
.overlay {
  position: fixed; inset: 0; z-index: 120;
  display: grid; place-items: center; padding: 20px;
  background: rgba(14,17,22,.58); backdrop-filter: blur(2px);
}
.dialog {
  position: relative; width: min(460px, 100%); overflow: hidden;
  padding: 24px; background: #fff; border-radius: var(--r-lg);
  box-shadow: 0 20px 70px rgba(14,17,22,.3);
}
.accent { position: absolute; inset: 0 0 auto; height: 4px; background: var(--ai); }
.head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.close { width: 32px; height: 32px; font-size: 24px; line-height: 1; color: var(--t3); }
.close:hover { color: var(--t1); background: var(--bg-soft); }
h2 { font-size: 22px; font-weight: 800; letter-spacing: -.045em; }
.course { margin-top: 5px; color: var(--t2); font-weight: 600; }
.summary { margin-top: 18px; border-top: 1px solid var(--navy); }
.summary div { display: grid; grid-template-columns: 110px 1fr; border-bottom: 1px solid var(--line); }
.summary dt { padding: 11px 12px; background: var(--bg-soft); color: var(--t2); font-size: 12.5px; font-weight: 600; }
.summary dd { padding: 11px 12px; font-size: 13.5px; font-weight: 700; overflow-wrap: anywhere; }
.left { color: var(--red-dark); }
.guide { margin-top: 14px; color: var(--t2); font-size: 13px; line-height: 1.65; }
.alert { margin-top: 12px; }
.actions { display: grid; grid-template-columns: 1fr 1.25fr; gap: 8px; margin-top: 20px; }
.spin-w { width: 14px; height: 14px; border-color: rgba(255,255,255,.4); border-top-color: #fff; }
@media (max-width: 520px) {
  .overlay { padding: 10px; }
  .dialog { padding: 20px 16px; }
  h2 { font-size: 19px; }
  .summary div { grid-template-columns: 92px 1fr; }
  .actions { grid-template-columns: 1fr; }
}
</style>
