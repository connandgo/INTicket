// DEMO 모드의 회차 · 좌석등급 · 잔여수량 · 선점 상태를 브라우저에 보관한다.
// 화면 코드는 이 파일을 직접 부르지 않고 api/performance.js, api/booking.js 를 거친다.
//
// 브라우저 안에서만 유효하며 발표 시연과 화면 검증에 사용한다.

import { HOLD_MINUTES } from '@/config/features.js'

const KEY = 'inticket.inventory.v1'

export const GRADE_PRESET = [
  { grade: 'VIP', rate: 1.6 },
  { grade: 'R', rate: 1.0 },
  { grade: 'S', rate: 0.68 },
  { grade: 'A', rate: 0.45 }
]

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}')
  } catch {
    return {}
  }
}

function save(db) {
  try {
    localStorage.setItem(KEY, JSON.stringify(db))
  } catch (e) {
    console.warn('[mock] 재고를 저장하지 못했습니다:', e)
  }
}

// 공연 하나당 회차 3개를 만들어 둔다. 같은 공연은 항상 같은 회차가 나온다.
function seedFor(course) {
  const base = new Date('2026-09-11T00:00:00')
  const offset = (Number(course.id) * 3) % 21
  const WD = ['일', '월', '화', '수', '목', '금', '토']

  const rounds = [0, 2, 3].map((d, i) => {
    const dt = new Date(base)
    dt.setDate(dt.getDate() + offset + d)
    const time = ['19:30', '15:00', '19:00'][i]
    return {
      id: Number(course.id) * 100 + i + 1,
      date: dt.toISOString().slice(0, 10),
      weekday: WD[dt.getDay()],
      time,
      grades: GRADE_PRESET.map((g, gi) => {
        const capacity = [40, 120, 200, 160][gi]
        // 회차마다, 등급마다 팔린 정도가 달라야 판매 현황이 의미 있게 보인다.
        // 앞등급일수록 그리고 주말 회차일수록 더 팔린 것으로 잡았다.
        const seed = (Number(course.id) * 31 + i * 17 + gi * 7) % 60
        const ratio = Math.min(0.98, 0.2 + seed / 100 + (i === 1 ? 0.18 : 0) + (3 - gi) * 0.04)
        const sold = Math.min(capacity, Math.round(capacity * ratio))
        return {
          grade: g.grade,
          price: Math.round((Number(course.price) * g.rate) / 1000) * 1000,
          capacity,
          sold
        }
      })
    }
  })

  return { courseId: Number(course.id), rounds }
}

export function getPerformance(course) {
  if (!course) return null
  const db = load()
  const key = String(course.id)
  if (!db[key]) {
    db[key] = seedFor(course)
    save(db)
  }
  return db[key]
}

export function getRound(course, roundId) {
  const p = getPerformance(course)
  return p?.rounds.find((r) => String(r.id) === String(roundId)) || null
}

export function remaining(g) {
  return Math.max(0, g.capacity - g.sold)
}

// 기획사가 회차를 직접 추가할 때
export function addRound(courseId, round) {
  const db = load()
  const key = String(courseId)
  db[key] ||= { courseId: Number(courseId), rounds: [] }
  db[key].rounds.push({ ...round, id: Date.now() })
  db[key].rounds.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
  save(db)
  return db[key]
}

// 선점 — 잔여 수량을 즉시 줄이고 결제 마감 시각을 돌려준다.
export function hold(course, roundId, grade, qty) {
  const db = load()
  const p = db[String(course.id)] || getPerformance(course)
  const round = p.rounds.find((r) => String(r.id) === String(roundId))
  if (!round) throw new Error('회차를 찾을 수 없습니다.')

  const g = round.grades.find((x) => x.grade === grade)
  if (!g) throw new Error('좌석 등급을 찾을 수 없습니다.')

  const left = remaining(g)
  if (qty > left) {
    const err = new Error(`잔여 ${left}석보다 많이 신청할 수 없습니다.`)
    err.code = 'SOLD_OUT'
    throw err
  }

  g.sold += qty
  db[String(course.id)] = p
  save(db)

  return {
    expiresAt: new Date(Date.now() + HOLD_MINUTES * 60_000).toISOString(),
    grade,
    quantity: qty,
    unitPrice: g.price,
    amount: g.price * qty,
    remaining: remaining(g)
  }
}

// 선점 취소 / 예매 취소 — 잔여 수량 복구
export function release(courseId, roundId, grade, qty) {
  const db = load()
  const p = db[String(courseId)]
  if (!p) return
  const round = p.rounds.find((r) => String(r.id) === String(roundId))
  const g = round?.grades.find((x) => x.grade === grade)
  if (!g) return
  g.sold = Math.max(0, g.sold - qty)
  save(db)
}

// 회차별 판매율 — 기획사 판매 현황용
export function salesOf(course) {
  const p = getPerformance(course)
  if (!p) return []
  return p.rounds.map((r) => {
    const capacity = r.grades.reduce((a, g) => a + g.capacity, 0)
    const sold = r.grades.reduce((a, g) => a + g.sold, 0)
    return { ...r, capacity, sold, rate: capacity ? Math.round((sold / capacity) * 100) : 0 }
  })
}

export function resetAll() {
  try { localStorage.removeItem(KEY) } catch { /* noop */ }
}
