// 좌석 배치도 — recommend-service 의 app/data/seats.py 와 같은 값.
//
// AI 매칭이 돌려주는 좌석 ID 는 "{등급}-{열}-{번호}" 형식이고(예: S-Q-5),
// 그 좌석이 실제로 어느 등급의 몇 열인지는 서버의 SEAT_MAP 이 정한다.
// 화면이 다른 배치를 그리면 "S-Q-5 를 배정받았는데 배치도에 Q열이 없다"가 된다.
// 그래서 등급·열·가격을 서버와 같은 값으로 맞춰 둔다.
//
// 서버가 GET /api/recommend/internal/seats 로 배치도를 내려주므로,
// api/performance.js 는 가능하면 그걸 받아 쓰고 실패할 때만 이 값을 쓴다.

export const SEAT_GRADES = {
  VIP: { price: 240000, rows: { A: 20, B: 20 } },
  R: { price: 150000, rows: { D: 20, E: 20, F: 20, G: 20, H: 20, J: 20 } },
  S: {
    price: 102000,
    rows: { G: 20, H: 20, J: 20, K: 20, L: 20, M: 20, N: 20, P: 20, Q: 20, R: 20 }
  },
  A: { price: 68000, rows: { K: 20, L: 20, M: 20, N: 20, P: 20, Q: 20, R: 20, S: 20 } }
}

export const GRADE_ORDER = ['VIP', 'R', 'S', 'A']

/** 등급별 정원 (열 수 × 열당 좌석 수) */
export function capacityOf(grade) {
  const g = SEAT_GRADES[grade]
  if (!g) return 0
  return Object.values(g.rows).reduce((a, n) => a + n, 0)
}

/** 서버 응답({ seatMap: { VIP: { A: [...] } } })을 같은 모양으로 정규화 */
export function fromServerMap(seatMap) {
  if (!seatMap || typeof seatMap !== 'object') return null
  const out = {}
  for (const [grade, rows] of Object.entries(seatMap)) {
    if (!rows || typeof rows !== 'object') continue
    const r = {}
    for (const [row, seats] of Object.entries(rows)) {
      r[row] = Array.isArray(seats) ? seats.length : Number(seats) || 0
    }
    out[grade] = { price: SEAT_GRADES[grade]?.price ?? 0, rows: r }
  }
  return Object.keys(out).length ? out : null
}

/**
 * 전 등급·전 열의 좌석 ID 목록.
 *
 * 취소표 발생 시연에서 쓴다. 한 등급만 풀면 조건에 뭘 적었든 모두 그 등급을
 * 받게 되어 결과가 늘 같아 보인다. 전 등급을 풀어야 서버가 각자의 조건에 맞는
 * 자리를 골라 준다(S석 요청 → S 좌석, 3매 연석 요청 → 붙은 세 자리).
 */
export function allSeatIds() {
  return seatIdsOfGrades(GRADE_ORDER)
}

/**
 * 지정한 등급들의 좌석 ID 목록.
 *
 * 서버는 required(하드 조건)만 후보 필터로 쓴다. '~면 좋겠어요' 처럼 말하면
 * LLM 이 등급을 preferred 로 분류하고, 그러면 서버는 남은 자리 중 제일 좋은
 * 자리부터 준다 — 곧 VIP 다. 무엇을 적든 VIP 가 나오는 이유가 이것이다.
 *
 * 그래서 화면이 조건에 나온 등급만 푼다. 하드 조건이 아니어도 그 사람이 원한
 * 등급 안에서 자리가 정해진다. 등급을 말하지 않았으면 전 등급을 푼다.
 */
export function seatIdsOfGrades(grades) {
  const wanted = (grades || []).filter((g) => SEAT_GRADES[g])
  const list = wanted.length ? wanted : GRADE_ORDER
  const seats = []
  for (const grade of list) {
    const rows = SEAT_GRADES[grade]?.rows || {}
    for (const [row, n] of Object.entries(rows)) {
      for (let i = 1; i <= n; i++) seats.push(`${grade}-${row}-${i}`)
    }
  }
  return seats
}

// 공연별 취소표 발생 시연 좌석. 실제 서비스에서는 결제 취소 이벤트가 이 값을
// 넘기지만, MVP에서는 버튼을 눌렀을 때 공연마다 다른 취소 상황을 재현한다.
// 모든 시나리오에 등급별 좌석과 2~3연석을 섞어 다양한 대기 조건을 테스트할 수 있다.
const RELEASE_SCENARIOS = {
  1: ['VIP-A-1', 'VIP-A-2', 'R-D-1', 'R-D-2', 'S-G-1', 'S-G-2', 'S-G-3', 'A-K-1', 'A-K-2'],
  2: ['VIP-B-5', 'VIP-B-6', 'R-F-5', 'R-F-6', 'S-Q-5', 'S-Q-6', 'S-Q-7', 'A-L-5', 'A-L-6'],
  3: ['VIP-A-9', 'VIP-A-10', 'R-H-8', 'R-H-9', 'S-P-3', 'S-P-4', 'S-P-5', 'A-M-3', 'A-M-4'],
  4: ['VIP-B-12', 'VIP-B-13', 'R-E-10', 'R-E-11', 'S-N-7', 'S-N-8', 'S-N-9', 'A-N-7', 'A-N-8'],
  5: ['VIP-A-15', 'VIP-A-16', 'R-G-12', 'R-G-13', 'S-R-10', 'S-R-11', 'S-R-12', 'A-P-10', 'A-P-11'],
  6: ['VIP-B-17', 'VIP-B-18', 'R-J-14', 'R-J-15', 'S-K-13', 'S-K-14', 'S-K-15', 'A-Q-13', 'A-Q-14'],
  7: ['VIP-A-4', 'VIP-A-5', 'R-D-16', 'R-D-17', 'S-L-16', 'S-L-17', 'S-L-18', 'A-R-16', 'A-R-17'],
  8: ['VIP-B-8', 'VIP-B-9', 'R-F-18', 'R-F-19', 'S-M-4', 'S-M-5', 'S-M-6', 'A-S-4', 'A-S-5'],
  9: ['VIP-A-19', 'VIP-A-20', 'R-H-2', 'R-H-3', 'S-J-8', 'S-J-9', 'S-J-10', 'A-K-12', 'A-K-13']
}

export function releasedSeatsForCourse(courseId) {
  const scenario = RELEASE_SCENARIOS[Number(courseId)] || RELEASE_SCENARIOS[1]
  return [...scenario]
}

/** 좌석 ID → { grade, row, no } */
export function parseSeatId(seatId) {
  const p = String(seatId).split('-')
  return p.length === 3 ? { grade: p[0], row: p[1], no: Number(p[2]) } : null
}
