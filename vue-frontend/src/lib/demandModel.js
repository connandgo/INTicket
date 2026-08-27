// AI 수요 분석의 임시 계산기.
//
// recommend-service 의 GET /api/recommend/forecast/{courseId} 는 아직 스텁이고
// "응답 구조도 AI 담당이 설계할 것"으로 남아 있다. 화면을 먼저 만들려면 계약이
// 있어야 해서, 프론트에서 응답 모양을 정하고 그 모양대로 값을 만들어 둔다.
//
// AI 담당이 같은 모양으로 응답을 돌려주면 이 파일은 통째로 안 쓰이게 된다.
// 화면 코드는 이 파일을 직접 부르지 않고 api/forecast.js 를 거친다.
//
// 값은 공연 ID 로 고정된 난수를 써서 항상 같게 나온다(시연 중 숫자가 안 흔들리게).

function seeded(seed) {
  let t = seed + 0x6d2b79f5
  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const WD = ['일', '월', '화', '수', '목', '금', '토']

function ymd(d) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function levelOf(ratio) {
  if (ratio >= 1.5) return { code: 'VERY_HIGH', label: '매우 높음' }
  if (ratio >= 0.8) return { code: 'HIGH', label: '높음' }
  if (ratio >= 0.3) return { code: 'MEDIUM', label: '보통' }
  return { code: 'LOW', label: '낮음' }
}

function verdictOf(rate) {
  if (rate >= 0.9) return { code: 'RECOMMEND', label: '추가 회차 추천' }
  if (rate >= 0.75) return { code: 'HIGH', label: '높음' }
  if (rate >= 0.55) return { code: 'MEDIUM', label: '보통' }
  return { code: 'LOW', label: '낮음' }
}

/**
 * @param {object} course  CourseResponse (capacity, enrollmentCount, title ...)
 * @param {number} waitingCount  취소표 대기자 수. 집계 API 가 없으면 null.
 */
/**
 * @param {object} stock  실제 좌석 재고. { capacity, sold, roundSeats }
 *   예매 화면이 쓰는 좌석 배치도와 같은 값이어야 한다. 없으면 course 값으로 계산하는데,
 *   그러면 '전체 좌석 1,204석'처럼 좌석 배치도(회차당 520석)와 다른 숫자가 나온다.
 */
export function analyze(course, waitingCount = null, stock = null) {
  const id = Number(course.id) || 1
  const rand = seeded(id * 7919)

  const capacity = stock?.capacity ?? course.capacity ?? null
  const sold = Number(stock?.sold ?? course.enrollmentCount ?? 0)
  const sellRate = capacity ? Math.min(1, sold / capacity) : null
  const soldOut = capacity != null && sold >= capacity

  // 집계 API 가 없어서 판매율로부터 추정한다.
  // AI 담당은 waitlist 테이블을 직접 집계하면 된다.
  const base = capacity || Math.max(sold, 200)
  const waiting = waitingCount ?? Math.round(base * (soldOut ? 1.6 + rand() * 1.4 : 0.15 + rand() * 0.4))
  const requested = Math.round(waiting * (1.3 + rand() * 0.3))

  // 대기자 전부가 실제로 사지는 않는다. 전환 가능성이 높은 몫만 유효수요로 본다.
  const effective = Math.round(waiting * (0.68 + rand() * 0.12))
  const ratioToSupply = base ? effective / base : 0

  // ---- 추세: 최근 7일 실측 + 앞으로 7일 예측 ----
  const today = new Date()
  const actual = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    // 오늘 값이 effective 가 되도록 뒤에서부터 역산
    const factor = 1 - i * (0.035 + rand() * 0.02)
    actual.push({ date: ymd(d), value: Math.round(effective * Math.max(0.35, factor)) })
  }
  actual[actual.length - 1].value = effective

  const growth7d = actual[0].value ? effective / actual[0].value - 1 : 0

  const forecast = [{ ...actual[actual.length - 1] }]
  let v = effective
  for (let i = 1; i <= 7; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() + i)
    // 성장은 점점 둔해진다
    v = Math.round(v * (1 + (growth7d / 7) * (1 - i * 0.07)))
    forecast.push({ date: ymd(d), value: v })
  }
  const forecast7d = forecast[forecast.length - 1].value

  // ---- 추가 회차 후보 ----
  const slots = [
    { weekday: '토', time: '19:00', w: 1.0 },
    { weekday: '토', time: '14:00', w: 0.9 },
    { weekday: '일', time: '14:00', w: 0.78 },
    { weekday: '금', time: '20:00', w: 0.64 }
  ]
  // 추가 회차 한 번의 좌석 수다. 공연 전체 좌석을 쓰면 한 회차가 전 회차를
  // 합친 만큼 팔 수 있다는 계산이 돼서 '718 / 1,204석' 같은 값이 나온다.
  const extraSeats = stock?.roundSeats || capacity || 1000
  const candidates = slots
    .map((s) => {
      // 유효수요 중 그 회차로 옮겨올 수 있는 몫
      const convertible = Math.min(extraSeats, Math.round(effective * 0.5 * s.w))
      const rate = extraSeats ? convertible / extraSeats : 0
      return {
        weekday: s.weekday,
        time: s.time,
        expectedAudience: convertible,
        expectedSeats: extraSeats,
        expectedRate: Math.min(1, rate),
        verdict: verdictOf(Math.min(1, rate))
      }
    })
    .sort((a, b) => b.expectedRate - a.expectedRate)
    .map((c, i) => ({ ...c, rank: i + 1 }))

  const best = candidates[0]
  const lvl = levelOf(ratioToSupply)

  const insights = []
  if (soldOut) {
    insights.push(
      `현재 공연은 전체 ${capacity.toLocaleString()}석이 매진된 상태이며, 분석 결과 약 ${effective.toLocaleString()}석의 추가 수요가 존재하는 것으로 추정됩니다.`
    )
  } else if (capacity) {
    insights.push(
      `현재 판매율은 ${Math.round(sellRate * 100)}%(${sold.toLocaleString()}/${capacity.toLocaleString()}석)이며, 대기 수요는 약 ${effective.toLocaleString()}석으로 추정됩니다.`
    )
  } else {
    insights.push('정원이 설정되지 않아 매진·초과수요를 판정할 수 없습니다. 공연 등록에서 정원을 지정해 주세요.')
  }
  insights.push(
    `최근 7일간 잠재수요가 ${growth7d >= 0 ? '+' : ''}${Math.round(growth7d * 100)}% 변했으며 ${growth7d > 0.05 ? '상승 추세를 유지하고 있습니다' : '큰 변동은 없습니다'}.`
  )
  insights.push(
    `추가 회차 시뮬레이션 결과 ${best.weekday}요일 ${parseInt(best.time)}시 회차의 예상 판매율이 ${Math.round(best.expectedRate * 100)}%로 가장 높게 분석되었습니다.`
  )

  return {
    courseId: id,
    generatedAt: new Date().toISOString(),
    source: 'LOCAL_ESTIMATE',

    target: { capacity, sold, sellRate, soldOut },

    excessDemand: {
      effectiveSeats: effective,
      level: lvl,
      waitingCount: waiting,
      requestedTickets: requested,
      ratioToSupply
    },

    extraShow: {
      recommended: { weekday: best.weekday, time: best.time },
      expectedAudience: best.expectedAudience,
      expectedSeats: best.expectedSeats,
      expectedRate: best.expectedRate,
      verdict: best.verdict
    },

    momentum: {
      changeRate7d: growth7d,
      direction: growth7d > 0.02 ? 'UP' : growth7d < -0.02 ? 'DOWN' : 'FLAT',
      current: effective,
      forecast7d,
      state: growth7d > 0.05 ? '상승 추세 지속 예상' : growth7d < -0.05 ? '수요 소멸 예상' : '보합 예상'
    },

    trend: { actual, forecast },
    candidates,
    insights,
    recommendation: `${best.weekday}요일 ${parseInt(best.time)}시 추가 회차 편성을 적극 검토하는 것을 추천합니다.`
  }
}

/** 기획사가 조건을 직접 넣어 돌려보는 시뮬레이션 */
export function simulate(course, analysis, { seats }) {
  const effective = analysis.excessDemand.effectiveSeats
  const cap = Number(seats) || analysis.extraShow.expectedSeats
  const convertible = Math.min(cap, Math.round(effective * 0.487))
  const rate = cap ? convertible / cap : 0
  return {
    expectedAudience: convertible,
    expectedSeats: cap,
    expectedRate: Math.min(1, rate),
    conversionRate: effective ? convertible / effective : 0,
    verdict: verdictOf(Math.min(1, rate))
  }
}
