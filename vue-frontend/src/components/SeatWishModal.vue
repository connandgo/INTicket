<template>
  <div v-if="open" class="overlay" @click.self="close" @keydown.esc="close">
    <section class="dialog" role="dialog" aria-modal="true" aria-labelledby="wish-title">
      <header class="head">
        <div>
          <span class="bdg bdg-ai-solid">AI 취소표 매칭</span>
          <h2 id="wish-title">원하는 취소표 조건을 알려주세요</h2>
          <p v-if="round" class="when num">
            {{ course?.title }} · {{ round.date.replaceAll('-', '.') }} ({{ round.weekday }}) {{ round.time }}
          </p>
        </div>
        <button type="button" class="close" aria-label="닫기" @click="close">×</button>
      </header>

      <template v-if="stage === 'input'">
        <p class="intro">문장으로 희망 조건을 입력하면 AI가 등급·가격·매수를 분석해 대기 목록에 등록합니다.</p>
        <textarea
          v-model="text"
          class="txt wish"
          maxlength="300"
          autofocus
          placeholder="예) 3명이서 붙어 앉고 싶어요. 앞쪽이면 좋겠고 1매 15만원 이하로요."
        ></textarea>

        <div class="examples">
          <button v-for="example in EXAMPLES" :key="example" type="button" @click="text = example">
            {{ example }}
          </button>
        </div>

        <p v-if="error" class="alert alert-err">{{ error }}</p>
        <div class="actions">
          <button type="button" class="btn btn-line" @click="close">취소</button>
          <button type="button" class="btn btn-ai" :disabled="loading || !text.trim()" @click="registerWish">
            <span v-if="loading" class="spin spin-w"></span>
            {{ loading ? '희망사항 등록 중' : '취소표 희망사항 등록' }}
          </button>
        </div>
      </template>

      <template v-else>
        <div class="result-copy">
          <span class="ok">✓</span>
          <div>
            <b>취소표 희망사항이 등록되었습니다.</b>
            <p>취소표가 발생하면 입력하신 조건을 기준으로 좌석을 매칭합니다.</p>
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
import { seatWishApi } from '@/api/seatWish.js'

const props = defineProps({
  open: { type: Boolean, default: false },
  course: { type: Object, default: null },
  round: { type: Object, default: null }
})
const emit = defineEmits(['close', 'registered'])

const text = ref('')
const loading = ref(false)
const error = ref('')
const stage = ref('input')

const EXAMPLES = [
  '3명이서 붙어 앉고 싶어요. 1매 15만원 이하로요.',
  '혼자 볼 거라 어디든 괜찮지만 최대한 앞쪽이면 좋겠어요.',
  '두 명이 볼 R석 연석을 찾아주세요.'
]

watch(() => [props.open, props.round?.id], ([isOpen]) => {
  if (!isOpen) return
  text.value = ''
  error.value = ''
  stage.value = 'input'
})

async function registerWish() {
  if (!props.round || !props.course) return
  loading.value = true
  error.value = ''
  try {
    const registered = await seatWishApi.register({ courseId: props.course.id, text: text.value })
    emit('registered', {
      ...registered,
      courseId: Number(props.course.id),
      roundId: props.round.id,
      rawText: text.value
    })
    stage.value = 'done'
  } catch (e) {
    console.error('[seat-wish-modal] 희망사항 등록 실패:', e)
    error.value = e.response?.status === 401
      ? '로그인이 필요합니다.'
      : e.response?.data?.detail || e.response?.data?.message || '희망사항을 등록하지 못했습니다.'
  } finally {
    loading.value = false
  }
}

function close() {
  emit('close')
}

</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
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
.intro { margin-bottom: 12px; font-size: 13px; color: var(--t2); }
.wish { min-height: 112px; }
.examples { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0 16px; }
.examples button {
  padding: 5px 9px;
  border: 1px solid var(--ai-line);
  background: var(--ai-wash);
  color: var(--ai);
  font-size: 11.5px;
}
.actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; }
.btn-ai { background: var(--ai); color: #fff; border-color: var(--ai); }
.btn-ai:hover:not(:disabled) { background: #16233A; }
.spin-w { width: 14px; height: 14px; border-color: rgba(255,255,255,.4); border-top-color: #fff; }
.result-copy { display: flex; align-items: flex-start; gap: 12px; padding: 13px 15px; background: var(--ok-wash); border: 1px solid #C9E7D7; }
.result-copy .ok { width: 26px; height: 26px; display: grid; place-items: center; border-radius: 50%; background: var(--ok); color: #fff; }
.result-copy b { font-size: 15px; color: var(--ok); }
.result-copy p { margin-top: 3px; font-size: 12.5px; color: var(--t2); }
@media (max-width: 640px) {
  .overlay { padding: 8px; }
  .dialog { max-height: calc(100vh - 16px); padding: 18px 14px; }
  .head h2 { font-size: 19px; }
  .actions { flex-direction: column-reverse; }
  .actions .btn { width: 100%; }
}
</style>
