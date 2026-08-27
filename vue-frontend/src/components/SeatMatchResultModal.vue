<template>
  <div v-if="open" class="overlay" @click.self="close" @keydown.esc="close">
    <section class="dialog" role="dialog" aria-modal="true" aria-labelledby="match-result-title">
      <header class="head">
        <div>
          <span class="bdg bdg-ai-solid">AI 취소표 매칭</span>
          <h2 id="match-result-title">취소표 매칭 결과</h2>
          <p v-if="round" class="when num">
            {{ course?.title }} · {{ round.date.replaceAll('-', '.') }} ({{ round.weekday }}) {{ round.time }}
          </p>
        </div>
        <button type="button" class="close" aria-label="닫기" @click="close">×</button>
      </header>

      <template v-if="offer">
        <div class="result-copy success">
          <span class="mark">✓</span>
          <div>
            <b>{{ offer.seatsText || seatsLabel(offer.seats) }}</b>
            <!-- AI 선정 이유는 표시하지 않는다(지침). 배정된 좌석만 알린다. -->
            <p>10분 내 결제 시 예매가 확정됩니다.</p>
          </div>
        </div>

        <div class="seat-result">
          <SeatMap
            v-if="round"
            :round="round"
            :selected-seats="offer.seats"
            :read-only="true"
            :focus-grade="offer.seats?.[0]?.split('-')?.[0] || ''"
          />
        </div>

        <p class="limit">매칭된 좌석은 10분 동안 유지됩니다.</p>
        <p v-if="paymentError" class="alert alert-err payment-error">{{ paymentError }}</p>
        <div class="actions">
          <button type="button" class="btn btn-line" @click="close">닫기</button>
          <button type="button" class="btn btn-red" :disabled="paying" @click="goBooking">
            <span v-if="paying" class="spin spin-w"></span>
            {{ paying ? '결제 화면 준비 중' : '이 좌석으로 예매하기' }}
          </button>
        </div>
      </template>

      <template v-else>
        <div class="result-copy empty">
          <span class="mark">!</span>
          <div>
            <b>조건에 맞는 취소표가 없습니다.</b>
            <p>{{ reason || '다른 좌석이 발생하면 다시 매칭해 주세요.' }}</p>
          </div>
        </div>
        <div class="actions">
          <button type="button" class="btn btn-navy" @click="close">확인</button>
        </div>
      </template>
    </section>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import SeatMap from '@/components/SeatMap.vue'
import { seatWishApi, seatsLabel } from '@/api/seatWish.js'

const props = defineProps({
  open: { type: Boolean, default: false },
  course: { type: Object, default: null },
  round: { type: Object, default: null },
  offer: { type: Object, default: null },
  reason: { type: String, default: '' }
})
const emit = defineEmits(['close'])
const router = useRouter()
const paying = ref(false)
const paymentError = ref('')

watch(() => props.open, (open) => {
  if (open) paymentError.value = ''
})

function close() {
  emit('close')
}

async function goBooking() {
  if (!props.offer || !props.course || !props.round) return
  paying.value = true
  paymentError.value = ''
  try {
    const result = await seatWishApi.acceptOffer(props.offer.offerId)
    if (result && result.success === false) {
      paymentError.value = result.message || '제안을 수락하지 못했습니다.'
      return
    }
    close()
    await router.push({
      path: `/courses/${props.course.id}/booking`,
      query: { round: props.round.id, seats: (props.offer.seats || []).join(',') }
    })
  } catch (error) {
    console.error('[match-result] 제안 수락 실패:', error)
    paymentError.value = error.response?.data?.detail || error.response?.data?.message || '결제 화면을 준비하지 못했습니다.'
  } finally {
    paying.value = false
  }
}
</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 101;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(14, 17, 22, .62);
  backdrop-filter: blur(2px);
}
.dialog {
  width: min(760px, 100%);
  max-height: calc(100vh - 40px);
  overflow-y: auto;
  padding: 24px;
  background: #fff;
  border-radius: var(--r-lg);
  box-shadow: 0 18px 60px rgba(14, 17, 22, .28);
}
.head { display: flex; justify-content: space-between; gap: 18px; margin-bottom: 18px; }
.head h2 { margin-top: 8px; font-size: 22px; font-weight: 800; letter-spacing: -.045em; }
.when { margin-top: 4px; font-size: 12.5px; color: var(--t3); }
.close { width: 34px; height: 34px; font-size: 25px; color: var(--t3); flex-shrink: 0; }
.close:hover { color: var(--t1); background: var(--bg-soft); }
.result-copy { display: flex; align-items: flex-start; gap: 12px; padding: 13px 15px; border: 1px solid; }
.result-copy.success { background: var(--ok-wash); border-color: #C9E7D7; }
.result-copy.empty { background: var(--warn-wash); border-color: #F0DDBB; }
.mark { width: 26px; height: 26px; display: grid; place-items: center; border-radius: 50%; color: #fff; flex-shrink: 0; }
.success .mark { background: var(--ok); }
.empty .mark { background: var(--warn); }
.result-copy b { font-size: 15px; }
.success b { color: var(--ok); }
.empty b { color: var(--warn); }
.result-copy p { margin-top: 3px; font-size: 12.5px; color: var(--t2); }
.seat-result { margin-top: 16px; padding: 14px; border: 1px solid var(--line); background: var(--bg-soft); }
.limit { margin-top: 10px; text-align: right; font-size: 11.5px; color: var(--t3); }
.payment-error { margin-top: 12px; }
.actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; }
.spin-w { width: 14px; height: 14px; border-color: rgba(255,255,255,.4); border-top-color: #fff; }
@media (max-width: 640px) {
  .overlay { padding: 8px; }
  .dialog { max-height: calc(100vh - 16px); padding: 18px 14px; }
  .head h2 { font-size: 19px; }
  .actions { flex-direction: column-reverse; }
  .actions .btn { width: 100%; }
}
</style>
