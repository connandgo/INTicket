<template>
  <div class="map">
    <div class="stage">STAGE</div>

    <div class="zones">
      <section v-for="z in zones" :key="z.grade" class="zone" :class="{ out: z.left === 0 }">
        <header class="z-head">
          <span class="z-name" :style="{ background: z.color }">{{ z.grade }}석</span>
          <span class="z-price num">{{ z.price.toLocaleString() }}원</span>
          <span class="z-left num" :class="{ few: z.left > 0 && z.left <= 10 }">
            {{ z.left === 0 ? '매진' : `잔여 ${z.left}` }}
          </span>
        </header>

        <div class="rows">
          <div v-for="row in z.rows" :key="row.label" class="row">
            <span class="r-label num">{{ row.label }}</span>
            <button
              v-for="s in row.seats"
              :key="s.n"
              type="button"
              class="seat"
              :class="{ taken: s.taken, on: isPicked(z.grade, s) }"
              :style="!s.taken ? { '--c': z.color } : null"
              :disabled="s.taken"
              :aria-label="`${z.grade}등급 ${row.label}열 ${s.n}번${s.taken ? ' 판매완료' : ''}`"
              :title="s.id || `${z.grade}석 ${row.label}${s.n}`"
              @click="toggle(z, s)"
            ></button>
          </div>
        </div>
      </section>
    </div>

    <p class="legend">
      <span class="k"><i class="sw free"></i>예매 가능</span>
      <span class="k"><i class="sw sel"></i>선택</span>
      <span class="k"><i class="sw taken"></i>판매 완료</span>
    </p>

    <p class="note">
      좌석은 등급 단위로 예매되며 <b>개별 좌석 번호는 지정되지 않습니다.</b>
      배치도는 남은 자리가 어디에 얼마나 있는지 보여주기 위한 것이고,
      실제 자리는 같은 등급 안에서 현장 배정됩니다.
    </p>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { remaining } from '@/api/performance.js'
import { SEAT_GRADES } from '@/data/seatLayout.js'

const props = defineProps({
  round: { type: Object, required: true },
  grade: { type: String, default: '' },
  quantity: { type: Number, default: 0 },
  max: { type: Number, default: 4 }
})
const emit = defineEmits(['pick'])

const COLOR = {
  VIP: '#8E2340',
  R: '#1F4E8C',
  S: '#1D6B54',
  A: '#7A5A18'
}

// 한 줄에 몇 자리씩 놓을지. 등급마다 정원이 달라 줄 수가 달라진다.
// 열 이름과 열당 좌석 수는 서버 좌석 배치도를 따른다.
// 화면이 임의로 열을 붙이면 AI 가 배정한 'S-Q-5' 가 배치도에 없는 자리가 된다.
const zones = computed(() =>
  props.round.grades.map((g) => {
    const left = remaining(g)
    const layout = g.rows || SEAT_GRADES[g.grade]?.rows || {}
    const rows = []
    // 팔린 자리는 앞열부터 채운다 — 앞자리가 먼저 나가는 실제 흐름에 맞춘다
    let seatIndex = 0

    for (const [label, count] of Object.entries(layout)) {
      const seats = []
      for (let i = 1; i <= count; i++) {
        seats.push({ n: i, idx: seatIndex, taken: seatIndex < g.sold, id: `${g.grade}-${label}-${i}` })
        seatIndex++
      }
      rows.push({ label, seats })
    }

    return { grade: g.grade, price: g.price, capacity: g.capacity, left, rows, color: COLOR[g.grade] || '#4B5563' }
  })
)

// 선택 표시는 "이 등급에서 앞쪽 quantity개"로 그린다.
// 실제 좌석 번호를 서버에 보내지 않으므로, 어떤 칸을 칠하든 의미는 같다.
function isPicked(grade, seat) {
  if (grade !== props.grade || !props.quantity) return false
  const z = zones.value.find((x) => x.grade === grade)
  if (!z) return false
  const firstFree = z.capacity - z.left
  return seat.idx >= firstFree && seat.idx < firstFree + props.quantity
}

function toggle(zone, seat) {
  if (seat.taken || zone.left === 0) return
  // 같은 등급을 다시 누르면 매수를 하나 늘린다. 다른 등급이면 1매로 시작.
  const next =
    zone.grade === props.grade
      ? (props.quantity % Math.min(props.max, zone.left)) + 1
      : 1
  emit('pick', { grade: zone.grade, quantity: next })
}
</script>

<style scoped>
.map { display: flex; flex-direction: column; gap: 16px; }

.stage {
  height: 30px;
  display: grid;
  place-items: center;
  background: var(--navy);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .28em;
  border-radius: 2px;
}

.zones { display: flex; flex-direction: column; gap: 14px; }
.zone {
  border: 1px solid var(--line);
  border-radius: var(--r);
  padding: 11px 13px 13px;
  background: #fff;
}
.zone.out { opacity: .5; }

.z-head { display: flex; align-items: center; gap: 9px; margin-bottom: 9px; }
.z-name {
  padding: 2px 8px;
  border-radius: 2px;
  color: #fff;
  font-size: 11.5px;
  font-weight: 700;
}
.z-price { font-size: 12.5px; font-weight: 600; }
.z-left { margin-left: auto; font-size: 11.5px; color: var(--t3); }
.z-left.few { color: var(--red); font-weight: 700; }

.rows { display: flex; flex-direction: column; gap: 3px; }
.row { display: flex; align-items: center; gap: 3px; }
.r-label {
  width: 13px;
  font-size: 9px;
  color: var(--t4);
  text-align: right;
  flex-shrink: 0;
}

.seat {
  width: 13px;
  height: 11px;
  border-radius: 2px 2px 3px 3px;
  background: color-mix(in srgb, var(--c) 22%, #fff);
  border: 1px solid color-mix(in srgb, var(--c) 40%, #fff);
  padding: 0;
  transition: transform .1s var(--ease), background .12s var(--ease);
}
.seat:hover:not(:disabled) { background: var(--c); transform: scale(1.28); }
.seat.on { background: var(--c); border-color: var(--c); box-shadow: 0 0 0 1.5px #fff, 0 0 0 3px var(--c); }
.seat.taken { background: var(--bg-dim); border-color: var(--line); cursor: not-allowed; }

.legend { display: flex; flex-wrap: wrap; gap: 15px; font-size: 11.5px; color: var(--t3); }
.k { display: inline-flex; align-items: center; gap: 5px; }
.sw { width: 11px; height: 10px; border-radius: 2px; display: inline-block; }
.sw.free  { background: #C9D6E8; border: 1px solid #A9BEDA; }
.sw.sel   { background: #1F4E8C; }
.sw.taken { background: var(--bg-dim); border: 1px solid var(--line); }

.note {
  padding: 10px 12px;
  background: var(--bg-soft);
  border-left: 2px solid var(--line-dark);
  font-size: 12px;
  color: var(--t2);
  line-height: 1.65;
}
.note b { font-weight: 700; color: var(--t1); }

@media (max-width: 640px) {
  .seat { width: 10px; height: 9px; }
}
</style>
