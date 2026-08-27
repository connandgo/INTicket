<template>
  <div class="poster" :style="style">
    <img
      v-if="posterSrc"
      class="art"
      :src="posterSrc"
      :alt="`${title} 공연 포스터`"
      loading="lazy"
      decoding="async"
    />
    <span class="g">{{ genre }}</span>
    <span class="t">{{ title }}</span>
    <span class="edge"></span>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import phantomPoster from '@/assets/posters/course-1-phantom.webp'
import waitingPoster from '@/assets/posters/course-2-waiting.webp'
import resurrectionPoster from '@/assets/posters/course-3-resurrection.webp'
import firstLightPoster from '@/assets/posters/course-4-first-light.webp'
import barricadePoster from '@/assets/posters/course-5-barricade.webp'
import midsummerPoster from '@/assets/posters/course-6-midsummer.webp'
import pianoPoster from '@/assets/posters/course-7-piano.webp'

// 현재 CourseResponse에는 thumbnail 필드가 없으므로 MVP 시드 공연만 정적 포스터와
// 연결한다. 새로 등록한 공연은 기존 ID 기반 그라데이션을 안전한 fallback으로 쓴다.
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

const POSTERS = {
  1: phantomPoster,
  2: waitingPoster,
  3: resurrectionPoster,
  4: firstLightPoster,
  5: barricadePoster,
  6: midsummerPoster,
  7: pianoPoster
}

const posterSrc = computed(() => POSTERS[String(props.id)] || '')
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
.art {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.g {
  position: relative;
  z-index: 2;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: .08em;
  color: rgba(255,255,255,.62);
}
.t {
  position: relative;
  z-index: 2;
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
  z-index: 1;
  background:
    linear-gradient(180deg, rgba(255,255,255,.12) 0%, rgba(255,255,255,0) 38%),
    linear-gradient(180deg, rgba(7,10,16,0) 45%, rgba(7,10,16,.88) 100%);
  pointer-events: none;
}
</style>
