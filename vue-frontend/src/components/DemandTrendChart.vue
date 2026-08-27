<template>
  <figure class="chart">
    <figcaption class="legend">
      <span class="lg"><i class="ln solid"></i>실제 집계 (대기 데이터)</span>
      <span class="lg"><i class="ln dash"></i>AI 예측</span>
    </figcaption>

    <svg :viewBox="`0 0 ${W} ${H}`" class="svg" role="img"
         :aria-label="`유효 수요 추세. 실측 ${actual.length}일, 예측 ${forecast.length - 1}일.`">
      <!-- 가로 눈금 -->
      <g class="grid">
        <template v-for="t in ticks" :key="t.v">
          <line :x1="PAD.l" :x2="W - PAD.r" :y1="t.y" :y2="t.y" />
          <text :x="PAD.l - 8" :y="t.y + 4" class="ytick">{{ t.v.toLocaleString() }}</text>
        </template>
      </g>

      <!-- 오늘 기준선 -->
      <line class="today" :x1="todayX" :x2="todayX" :y1="PAD.t" :y2="H - PAD.b" />
      <g :transform="`translate(${todayX}, ${PAD.t - 6})`">
        <rect x="-17" y="-14" width="34" height="17" rx="3" class="today-chip" />
        <text x="0" y="-1" class="today-tx">오늘</text>
      </g>

      <!-- 예측(점선) 먼저 그려 실측이 위에 오게 -->
      <polyline class="line dash" :points="ptsForecast" />
      <polyline class="line solid" :points="ptsActual" />

      <!-- 점 + 값 -->
      <g v-for="(p, i) in allPoints" :key="i">
        <circle :cx="p.x" :cy="p.y" :r="p.forecast ? 3 : 3.4"
                :class="['dot', p.forecast ? 'f' : 'a']" />
        <text :x="p.x" :y="p.y - 10" class="val" :class="{ f: p.forecast }">
          {{ p.value.toLocaleString() }}
        </text>
        <text :x="p.x" :y="H - PAD.b + 16" class="xtick">{{ p.label }}</text>
      </g>

      <text :x="PAD.l - 8" :y="PAD.t - 12" class="unit">유효 수요 (석)</text>
    </svg>
  </figure>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  actual: { type: Array, default: () => [] },
  forecast: { type: Array, default: () => [] }
})

const W = 880
const H = 300
const PAD = { l: 52, r: 16, t: 34, b: 30 }

const all = computed(() => [
  ...props.actual.map((d) => ({ ...d, forecast: false })),
  // 예측 첫 점은 실측 마지막과 같은 점이라 건너뛴다
  ...props.forecast.slice(1).map((d) => ({ ...d, forecast: true }))
])

const maxV = computed(() => {
  const m = Math.max(1, ...all.value.map((d) => d.value))
  // 눈금이 깔끔하게 떨어지도록 올림
  const step = Math.pow(10, Math.floor(Math.log10(m))) / 2
  return Math.ceil(m / step) * step
})

const ticks = computed(() => {
  const n = 6
  return Array.from({ length: n + 1 }, (_, i) => {
    const v = Math.round((maxV.value / n) * i)
    return { v, y: yOf(v) }
  })
})

function xOf(i) {
  const n = Math.max(1, all.value.length - 1)
  return PAD.l + ((W - PAD.l - PAD.r) * i) / n
}
function yOf(v) {
  return H - PAD.b - ((H - PAD.t - PAD.b) * v) / maxV.value
}

const allPoints = computed(() =>
  all.value.map((d, i) => ({
    x: xOf(i),
    y: yOf(d.value),
    value: d.value,
    forecast: d.forecast,
    label: (d.date || '').slice(5).replace('-', '/')
  }))
)

const ptsActual = computed(() =>
  allPoints.value.filter((p) => !p.forecast).map((p) => `${p.x},${p.y}`).join(' ')
)
// 점선은 실측 마지막 점부터 이어 그린다
const ptsForecast = computed(() => {
  const a = allPoints.value.filter((p) => !p.forecast)
  const f = allPoints.value.filter((p) => p.forecast)
  const last = a[a.length - 1]
  return [last, ...f].filter(Boolean).map((p) => `${p.x},${p.y}`).join(' ')
})

const todayX = computed(() => {
  const a = allPoints.value.filter((p) => !p.forecast)
  return a.length ? a[a.length - 1].x : PAD.l
})
</script>

<style scoped>
.chart { display: flex; flex-direction: column; gap: 10px; }
.legend { display: flex; gap: 18px; font-size: 12px; color: var(--t2); }
.lg { display: inline-flex; align-items: center; gap: 6px; }
.ln { width: 18px; height: 0; border-top: 2px solid var(--ai); display: inline-block; }
.ln.dash { border-top-style: dashed; border-color: var(--ok); }

.svg { width: 100%; height: auto; overflow: visible; }
.grid line { stroke: var(--line); stroke-width: 1; }
.ytick, .xtick { font-size: 10px; fill: var(--t4); font-family: var(--num); }
.ytick { text-anchor: end; }
.xtick { text-anchor: middle; }
.unit { font-size: 10.5px; fill: var(--t3); text-anchor: end; }

.today { stroke: var(--line-dark); stroke-width: 1; stroke-dasharray: 3 3; }
.today-chip { fill: var(--ai); }
.today-tx { font-size: 9.5px; fill: #fff; text-anchor: middle; font-weight: 700; }

.line { fill: none; stroke-width: 2.2; stroke-linejoin: round; stroke-linecap: round; }
.line.solid { stroke: var(--ai); }
.line.dash { stroke: var(--ok); stroke-dasharray: 5 4; stroke-width: 2; }

.dot.a { fill: var(--ai); }
.dot.f { fill: #fff; stroke: var(--ok); stroke-width: 2; }
.val { font-size: 10px; font-family: var(--num); fill: var(--ai); text-anchor: middle; font-weight: 600; }
.val.f { fill: var(--ok); }
</style>
