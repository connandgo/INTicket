import api from './index.js'
import * as local from '@/lib/wishParser.js'

// AI 취소표 매칭 (recommend-service).
//
// 관람객이 "3명이서 붙어 앉고 싶고 앞쪽이면 좋겠어요. 15만원 이하로요" 같은
// 줄글을 쓰면 서버의 LLM 이 구조화된 조건으로 바꾸고, 취소가 발생하면
// 조건에 맞는 대기자에게 좌석을 제안한다.
//
// ── 서버 계약 (app/router/waitlist_router.py) ───────────
// POST /api/recommend/waitlists         { courseId, conditionText }
//   → { waitlistId, seq, parsed }
// GET  /api/recommend/waitlists/my      → [{ waitlistId, courseId, seq, rawText, parsed }]
// GET  /api/recommend/offers/my         → [{ offerId, courseId, seats[], seatsText,
//                                            message, reason, expiresAt, status }]
// POST /api/recommend/offers/{id}/accept → { success, message }
//
// parsed = { required, preferred, flexible }
//   required  어기면 후보에서 제외되는 하드 조건 (count, grade, row, max_price)
//   preferred 맞으면 좋지만 양보 가능. 수락가능성 판단에만 쓴다
//   flexible  명시적으로 포기 가능하다고 말한 것 (allow_split, max_split_gap, price_ceiling)
//
// LLM 키가 없으면 서버가 알아서 폴백(순번 기준)으로 동작한다.
// 프론트는 그 차이를 몰라도 되고, 응답 모양은 같다.
// ────────────────────────────────────────────────────────

function unwrap(res) {
  const d = res?.data
  return d && typeof d === 'object' && 'data' in d ? d.data : d
}

/* ---------- 서버 조건(parsed) → 화면 표시용 3단계 ---------- */

// 조건 키를 사람이 읽는 말로 바꾼다. 서버가 새 키를 추가해도
// 원문 키를 그대로 보여주도록 두어 화면이 깨지지 않게 한다.
const LABEL = {
  count: '매수',
  grade: '좌석 등급',
  row: '열',
  max_price: '1매 최대 가격',
  price_ceiling: '가격 상한',
  allow_split: '따로 앉기',
  max_split_gap: '떨어질 수 있는 간격',
  zone: '구역',
  near_stage: '무대 근접'
}

// 서버가 주는 원문 값(same, true …)을 그대로 노출하면 사용자가 못 읽는다.
const VALUE_WORD = { same: '같은 열', adjacent: '앞뒤 열', any: '상관 없음' }

function fmt(key, v) {
  if (v === true) return '허용'
  if (v === false) return '불가'
  if (v === null || v === undefined) return '상관 없음'
  if (Array.isArray(v)) return v.map((x) => (key === 'grade' ? `${x}석` : x)).join('·')
  if (key === 'count') return `${v}매`
  if (key === 'max_price' || key === 'price_ceiling') return `${Number(v).toLocaleString()}원`
  if (key === 'max_split_gap') return `${v}칸`
  if (key === 'grade') return `${v}석`
  return VALUE_WORD[String(v)] || String(v)
}

function toItems(obj) {
  return Object.entries(obj || {}).map(([k, v]) => ({
    key: k,
    label: LABEL[k] || k,
    value: fmt(k, v)
  }))
}

// 서버 parsed 를 화면이 쓰는 buckets 모양으로 맞춘다.
// 이름만 다를 뿐(required/preferred/flexible ↔ must/prefer/flexible) 개념은 같다.
export function toBuckets(parsed) {
  return {
    must: toItems(parsed?.required),
    prefer: toItems(parsed?.preferred),
    flexible: toItems(parsed?.flexible)
  }
}

// 조건에서 좌석 등급 제안에 필요한 값만 뽑는다.
function toWish(parsed) {
  const r = parsed?.required || {}
  const p = parsed?.preferred || {}
  const f = parsed?.flexible || {}
  const grades = []
  for (const src of [r.grade, p.grade]) {
    if (!src) continue
    if (Array.isArray(src)) grades.push(...src)
    else grades.push(src)
  }
  const rowWanted = r.row || p.row
  return {
    quantity: r.count ?? p.count ?? null,
    grades: grades.length ? [...new Set(grades)] : ['VIP', 'R', 'S', 'A'],
    maxPrice: r.max_price ?? f.price_ceiling ?? null,
    // allow_split 은 '떨어져도 된다'는 양보지 '붙기를 원하지 않는다'가 아니다.
    // 붙기 희망(row)이 함께 있으면 희망 쪽을 남긴다.
    together: rowWanted ? true : f.allow_split === true ? false : null,
    frontPreferred: null,
    centerPreferred: null
  }
}

export const seatWishApi = {
  /**
   * 자연어 조건으로 취소표 대기를 등록한다.
   * 서버가 LLM 으로 파싱한 결과를 함께 돌려준다.
   */
  async register({ courseId, text }) {
    const d = unwrap(
      await api.post('/api/recommend/waitlists', { courseId: Number(courseId), conditionText: text })
    )
    return {
      waitlistId: d.waitlistId,
      seq: d.seq,
      parsed: d.parsed,
      buckets: toBuckets(d.parsed),
      wish: toWish(d.parsed),
      unparsed: [],
      source: 'AI_SERVICE'
    }
  },

  /** 등록 전에 문장만 미리 해석해 본다. 서버에 미리보기 API 가 없어 로컬 파서를 쓴다. */
  async preview(text) {
    await new Promise((r) => setTimeout(r, 350))
    const w = local.parseWish(text)
    return { ...w, source: 'LOCAL_PARSER' }
  },

  /** 내 대기 목록 */
  async myWaitlists() {
    const list = unwrap(await api.get('/api/recommend/waitlists/my'))
    return (Array.isArray(list) ? list : []).map((w) => ({
      ...w,
      buckets: toBuckets(w.parsed),
      wish: toWish(w.parsed)
    }))
  },

  /** 내게 온 좌석 제안 */
  async myOffers() {
    const list = unwrap(await api.get('/api/recommend/offers/my'))
    return Array.isArray(list) ? list : []
  },

  /** 제안 수락 — 서버가 예매까지 처리한다 */
  async acceptOffer(offerId) {
    return unwrap(await api.post(`/api/recommend/offers/${offerId}/accept`))
  },

  /** 조건에 맞는 좌석 등급 제안 (지금 살 수 있는 자리용, 화면 계산) */
  match(round, wish) {
    return local.matchGrades(round, wish)
  }
}

// 좌석 ID 는 "{등급}-{열}-{번호}" 형식이다 (app/data/seats.py). 예: "S-Q-5"
export function seatLabel(seatId) {
  const m = String(seatId).split('-')
  if (m.length === 3) return `${m[0]}등급 ${m[1]}열 ${m[2]}번`
  return String(seatId)
}

export function seatsLabel(seats) {
  return (seats || []).map(seatLabel).join(', ')
}

/* ---------- 시연용 내부 엔드포인트 ----------
   발표에서 "취소가 나면 이렇게 매칭된다"를 보여줄 때 쓴다. */
export const matchingDemoApi = {
  /** 좌석 취소를 발생시켜 매칭을 돌린다 */
  release(courseId, seats, reason = 'SINGLE') {
    return api
      .post('/api/recommend/internal/released', { courseId: Number(courseId), seats, reason })
      .then(unwrap)
  },
  seatMap() {
    return api.get('/api/recommend/internal/seats').then(unwrap)
  },
  reset() {
    return api.post('/api/recommend/internal/reset').then(unwrap)
  }
}
