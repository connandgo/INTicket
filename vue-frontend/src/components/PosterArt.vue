<template>
  <div class="poster" :style="style">
    <span class="g">{{ genre }}</span>
    <span class="t">{{ title }}</span>
    <span class="edge"></span>
  </div>
</template>

<script setup>
import { computed } from 'vue'

// CourseResponse에는 thumbnail 필드가 없다(명세서 R7).
// 없는 데이터를 지어내지 않고, 공연 ID로 색만 고정해서 포스터 자리를 채운다.
const props = defineProps({
  id: { type: [Number, String], default: 0 },
  title: { type: String, default: '' },
  genre: { type: String, default: '' }
})

const PALETTE = [
  ['#1B2536', '#38455E'],
  ['#7A1F2B', '#B33A49'],
  ['#123B33', '#276B5C'],
  ['#3A2352', '#61407F'],
  ['#5A3410', '#8C5A20'],
  ['#14324F', '#2A5C86']
]

const pair = computed(() => PALETTE[Math.abs(Number(props.id) || 0) % PALETTE.length])
const style = computed(() => ({
  background: `linear-gradient(160deg, ${pair.value[0]} 0%, ${pair.value[1]} 100%)`
}))
</script>

<style scoped>
.poster {
  position: relative;
  aspect-ratio: 3 / 4;
  padding: 14px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 6px;
  overflow: hidden;
}
.g {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: .08em;
  color: rgba(255,255,255,.62);
}
.t {
  font-size: 17px;
  font-weight: 700;
  line-height: 1.32;
  letter-spacing: -0.04em;
  color: #fff;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
/* 포스터 위쪽에 얇은 광택 한 줄 */
.edge {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(255,255,255,.14) 0%, rgba(255,255,255,0) 42%);
  pointer-events: none;
}
</style>
