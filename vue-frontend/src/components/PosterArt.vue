<template>
  <div class="poster" :style="style">
    <!-- 인쇄 망점 느낌의 미세한 도트. CSS 그라데이션 티를 지운다 -->
    <span class="grain"></span>

    <header class="p-top">
      <span class="p-genre">{{ genre }}</span>
      <span class="p-mark">IN</span>
    </header>

    <hr class="p-rule" />

    <div class="p-body">
      <p class="p-title">{{ title }}</p>
    </div>

    <footer class="p-foot">
      <span class="p-line"></span>
      <span class="p-tag">TICKET</span>
    </footer>
  </div>
</template>

<script setup>
import { computed } from 'vue'

// CourseResponse 에는 thumbnail 필드가 없다(명세서 R7).
// 없는 데이터를 지어내지 않고, 공연 ID 로 색을 고정해 인쇄물처럼 조판한다.
const props = defineProps({
  id: { type: [Number, String], default: 0 },
  title: { type: String, default: '' },
  genre: { type: String, default: '' }
})

// 그라데이션 대신 단색. 인쇄된 포스터에 가깝게 보이게 하려는 것이고,
// 목록에 여러 장이 깔렸을 때 색이 흐르지 않아 정돈돼 보인다.
const PALETTE = [
  { bg: '#1C2433', fg: '#F4F1EA' },
  { bg: '#8C2B2B', fg: '#FBEFE6' },
  { bg: '#14453C', fg: '#EFF5EE' },
  { bg: '#3B2C55', fg: '#F2EEF8' },
  { bg: '#7A4A12', fg: '#FBF3E6' },
  { bg: '#153A5B', fg: '#EDF3F8' },
  { bg: '#5B1F3B', fg: '#F9EDF3' }
]

const c = computed(() => PALETTE[Math.abs(Number(props.id) || 0) % PALETTE.length])
const style = computed(() => ({ '--bg': c.value.bg, '--fg': c.value.fg }))
</script>

<style scoped>
.poster {
  position: relative;
  aspect-ratio: 3 / 4;
  padding: 13px 13px 11px;
  display: flex;
  flex-direction: column;
  background: var(--bg);
  color: var(--fg);
  overflow: hidden;
}

/* 인쇄 망점. 아주 옅게 깔아 단색 면이 밋밋하지 않게 한다 */
.grain {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(currentColor .5px, transparent .5px);
  background-size: 4px 4px;
  opacity: .07;
  pointer-events: none;
}

.p-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.p-genre {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .18em;
  opacity: .78;
}
.p-mark {
  font-family: var(--num);
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: .1em;
  opacity: .5;
}

.p-rule {
  height: 0;
  border: 0;
  border-top: 1px solid currentColor;
  opacity: .35;
  margin: 9px 0 0;
}

.p-body { flex: 1; display: flex; align-items: center; }
.p-title {
  font-size: 19px;
  font-weight: 800;
  line-height: 1.22;
  letter-spacing: -0.055em;
  word-break: keep-all;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.p-foot { display: flex; align-items: center; gap: 8px; }
.p-line { flex: 1; height: 1px; background: currentColor; opacity: .35; }
.p-tag {
  font-family: var(--num);
  font-size: 8.5px;
  font-weight: 700;
  letter-spacing: .22em;
  opacity: .55;
}

/* 작은 자리(내 예매 목록 등)에서는 조판을 접는다 */
@container (max-width: 90px) {
  .p-title { font-size: 12px; }
}
</style>
