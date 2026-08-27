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

/** 좌석 ID → { grade, row, no } */
export function parseSeatId(seatId) {
  const p = String(seatId).split('-')
  return p.length === 3 ? { grade: p[0], row: p[1], no: Number(p[2]) } : null
}
