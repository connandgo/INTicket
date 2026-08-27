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
              :class="{ taken: s.taken && !isPicked(z.grade, s), on: isPicked(z.grade, s) }"
              :style="!s.taken || isPicked(z.grade, s) ? { '--c': z.color } : null"
              :disabled="readOnly || (s.taken && !isPicked(z.grade, s))"
              :aria-label="`${z.grade}등급 ${row.label}열 ${s.n}번${s.taken && !isPicked(z.grade, s) ? ' 판매완료' : ''}`"
              :title="seatName(s.id)"
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

    <p v-if="selectionText" class="selection" aria-live="polite">
      <b>{{ readOnly ? '매칭 좌석' : '선택 좌석' }}</b>
      <span>{{ selectionText }}</span>
    </p>

    <p class="note">
      좌석을 누르면 <b>등급·열·번호</b>를 확인할 수 있습니다.
    </p>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { SEAT_GRADES } from '@/data/seatLayout.js'

const props = defineProps({
  round: { type: Object, required: true },
  grade: { type: String, default: '' },
  quantity: { type: Number, default: 0 },
  max: { type: Number, default: 4 },
  selectedSeats: { type: Array, default: () => [] },
  readOnly: { type: Boolean, default: false },
  focusGrade: { type: String, default: '' }
})
const emit = defineEmits(['pick'])
const lastPicked = ref('')

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
  props.round.grades
    .filter((g) => !props.focusGrade || g.grade === props.focusGrade)
    .map((g) => {
    const layout = g.rows || SEAT_GRADES[g.grade]?.rows || {}
    const rows = []
    const allSeats = []
    let seatIndex = 0

    for (const [label, count] of Object.entries(layout)) {
      const seats = []
      for (let i = 1; i <= count; i++) {
        const seat = { n: i, idx: seatIndex, taken: false, id: `${g.grade}-${label}-${i}` }
        seats.push(seat)
        allSeats.push(seat)
        seatIndex++
      }
      rows.push({ label, seats })
    }

    // 같은 회차는 새로고침해도 위치가 바뀌지 않는 결정적 무작위 순서로 판매 좌석을 고른다.
    const capacity = allSeats.length
    const sold = Math.min(capacity, Math.max(0, Number(g.sold) || 0))
    const taken = [...allSeats]
      .sort((a, b) => randomScore(`${props.round.id}-${a.id}`) - randomScore(`${props.round.id}-${b.id}`))
      .slice(0, sold)
    const takenIds = new Set(taken.map((s) => s.id))
    allSeats.forEach((s) => { s.taken = takenIds.has(s.id) })

    return {
      grade: g.grade,
      price: g.price,
      capacity,
      sold,
      left: capacity - sold,
      rows,
      color: COLOR[g.grade] || '#4B5563'
    }
    })
)

const selectedSet = computed(() => new Set(props.selectedSeats || []))
const selectionText = computed(() => {
  const ids = props.selectedSeats?.length ? props.selectedSeats : (lastPicked.value ? [lastPicked.value] : [])
  return ids.map(seatName).join(', ')
})

function isPicked(grade, seat) {
  if (selectedSet.value.size) return selectedSet.value.has(seat.id)
  if (grade !== props.grade || !props.quantity) return false
  const z = zones.value.find((x) => x.grade === grade)
  if (!z) return false
  const free = z.rows.flatMap((r) => r.seats).filter((s) => !s.taken).slice(0, props.quantity)
  return free.some((s) => s.id === seat.id)
}

function toggle(zone, seat) {
  if (props.readOnly || seat.taken || zone.left === 0) return
  lastPicked.value = seat.id

  const sameGrade = (props.selectedSeats || []).filter((id) => id.startsWith(`${zone.grade}-`))
  let seats
  if (sameGrade.includes(seat.id)) seats = sameGrade.filter((id) => id !== seat.id)
  else if (sameGrade.length >= Math.min(props.max, zone.left)) seats = [...sameGrade.slice(1), seat.id]
  else seats = [...sameGrade, seat.id]

  emit('pick', {
    grade: seats.length ? zone.grade : '',
    quantity: seats.length,
    seats,
    seatId: seat.id,
    seatLabel: seatName(seat.id)
  })
}

function seatName(seatId) {
  const [grade, row, no] = String(seatId).split('-')
  return grade && row && no ? `${grade}석 ${row}열 ${no}번` : String(seatId)
}

function randomScore(text) {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
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
.seat.taken.on { background: var(--red); border-color: var(--red-dark); opacity: 1; }

.legend { display: flex; flex-wrap: wrap; gap: 15px; font-size: 11.5px; color: var(--t3); }
.k { display: inline-flex; align-items: center; gap: 5px; }
.sw { width: 11px; height: 10px; border-radius: 2px; display: inline-block; }
.sw.free  { background: #C9D6E8; border: 1px solid #A9BEDA; }
.sw.sel   { background: #1F4E8C; }
.sw.taken { background: var(--bg-dim); border: 1px solid var(--line); }

.selection {
  display: flex;
  align-items: baseline;
  gap: 9px;
  padding: 9px 11px;
  border: 1px solid var(--ai-line);
  background: var(--ai-wash);
  font-size: 12.5px;
  color: var(--t2);
}
.selection b { color: var(--ai); font-weight: 700; white-space: nowrap; }

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
