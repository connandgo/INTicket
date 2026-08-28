// 회차 · 좌석등급 · 잔여수량 · 선점 상태를 브라우저에 들고 있는 임시 저장소.
//
// performance-service / booking-service 가 생기면 통째로 버릴 파일이다.
// 그래서 화면 코드는 이 파일을 직접 부르지 않고 api/performance.js, api/booking.js 를 거친다.
//
// 한계는 분명하다 — 브라우저 안에서만 유효하고, 다른 사람과 재고가 공유되지 않는다.
// 발표 시연과 화면 검증까지가 이 파일의 역할이다.

import { HOLD_MINUTES } from '@/config/features.js'
import { SEAT_GRADES, GRADE_ORDER, capacityOf } from '@/data/seatLayout.js'
import { seatsLeft } from '@/domain/soldout.js'

// v3: 배치도 총 좌석을 공연 정원에 맞추기 시작했다.
// 이전 저장값은 공연과 무관하게 1,560석이라 목록의 잔여석과 어긋난다.
const KEY = 'inticket.inventory.v4'

// 등급·가격·정원은 서버 좌석 배치도(seats.py)를 그대로 따른다.
// 공연 가격에서 배수로 계산하면 AI 가 배정하는 좌석의 등급·가격과 어긋난다.
export const GRADE_PRESET = GRADE_ORDER.map((grade) => ({
  grade,
  price: SEAT_GRADES[grade].price,
  capacity: capacityOf(grade),
  rows: SEAT_GRADES[grade].rows
}))

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

// 좌석 배치도는 서버 SEAT_MAP 과 같은 크기(회차당 520석)를 유지한다.
// 정원에 맞춰 줄여 봤더니 열마다 네 자리씩 남는 옹졸한 표가 됐고, 취소표
// 매칭이 배정하는 S-Q-5 같은 좌석이 배치도에 없는 자리가 됐다.
// 화면에 보이는 '잔여'는 fitToCourseStock 이 실제 정원에 맞춰 준다.

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
        const rows = { ...g.rows }
        const capacity = g.capacity
        // 회차마다, 등급마다 팔린 정도가 달라야 판매 현황이 의미 있게 보인다.
        // 앞등급일수록 그리고 주말 회차일수록 더 팔린 것으로 잡았다.
        const seed = (Number(course.id) * 31 + i * 17 + gi * 7) % 60
        const ratio = Math.min(0.98, 0.2 + seed / 100 + (i === 1 ? 0.18 : 0) + (3 - gi) * 0.04)
        const sold = Math.min(capacity, Math.round(capacity * ratio))
        return {
          grade: g.grade,
          price: g.price,
          capacity,
          rows,
          sold
        }
      })
    }
  })

  const performance = { courseId: Number(course.id), rounds }
  fitToCourseStock(performance, course)
  return performance
}

// 지어낸 판매량을 백엔드가 말하는 잔여 좌석에 맞춘다.
//
// 회차·좌석 재고 API 가 없어서 판매량을 여기서 만들어 쓰는데, 그러다 보니
// 목록에서는 매진인 공연이 상세로 들어가면 잔여 660석으로 보였다.
// 같은 공연을 두고 화면마다 다른 말을 하는 셈이라 총량만이라도 맞춰 둔다.
//
// capacity 가 null 이면 백엔드 기준 무제한이므로 손대지 않는다.
function fitToCourseStock(performance, course) {
  const target = seatsLeft(course)
  if (target === null) return

  // 지어낸 잔여를 가중치로 삼아 실제 잔여를 나눠 준다.
  // 등급별로 팔린 정도가 달랐던 모양은 유지하면서 합계만 맞춘다.
  const cells = []
  let weight = 0
  for (const round of performance.rounds) {
    for (const g of round.grades) {
      const left = Math.max(0, g.capacity - g.sold)
      cells.push({ g, left, share: 0 })
      weight += left
    }
  }
  if (!cells.length) return

  let assigned = 0
  for (const cell of cells) {
    cell.share = weight > 0 ? Math.min(cell.g.capacity, Math.floor((target * cell.left) / weight)) : 0
    assigned += cell.share
  }
  // 내림으로 남은 몫은 원래 잔여가 많던 칸부터 채운다
  let rest = target - assigned
  for (const cell of [...cells].sort((x, y) => y.left - x.left)) {
    if (rest <= 0) break
    const room = cell.g.capacity - cell.share
    const add = Math.min(room, rest)
    cell.share += add
    rest -= add
  }

  for (const cell of cells) cell.g.sold = cell.g.capacity - cell.share
}

export function getPerformance(course) {
  if (!course) return null
  const db = load()
  const key = String(course.id)
  if (!db[key]) {
    db[key] = seedFor(course)
  }
  // 예전 브라우저 저장값도 현재 좌석 배치도와 맞춘다.
  // 좌석 그림의 칸 수와 잔여 숫자가 달라지는 현상을 여기서 한 번에 보정한다.
  normalizePerformance(db[key])
  save(db)
  return db[key]
}

export function getRound(course, roundId) {
  const p = getPerformance(course)
  return p?.rounds.find((r) => String(r.id) === String(roundId)) || null
}

export function remaining(g) {
  const visualCapacity = Object.values(g.rows || {}).reduce((a, n) => a + (Number(n) || 0), 0)
  const capacity = visualCapacity || Number(g.capacity) || 0
  return Math.max(0, capacity - (Number(g.sold) || 0))
}

function normalizePerformance(performance) {
  for (const round of performance?.rounds || []) {
    for (const grade of round.grades || []) {
      const preset = SEAT_GRADES[grade.grade]
      if (!preset) continue
      // 열 구성은 저장된 값을 그대로 둔다. 공연 정원에 맞춰 줄여 둔 것이라
      // 여기서 preset 으로 되돌리면 배치도가 다시 1,560석으로 부풀어 오른다.
      if (!grade.rows || !Object.keys(grade.rows).length) grade.rows = { ...preset.rows }
      const capacity = Object.values(grade.rows).reduce((t, n) => t + (Number(n) || 0), 0)
      grade.price = preset.price
      grade.capacity = capacity
      grade.sold = Math.min(capacity, Math.max(0, Number(grade.sold) || 0))
    }
  }
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
