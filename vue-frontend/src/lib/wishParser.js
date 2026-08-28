// 좌석 희망사항 자연어 파서 (LLM 대체용 규칙 기반).
//
// 팀 기능명세서 Sprint2 "대기 등록 (AI 조건 파싱)" 완료 기준:
//   자연어 입력이 필수 / 선호 / 양보가능 3단계로 분류된다
//   파싱 결과가 화면에 표시되고 사용자가 수정할 수 있다
//
// LLM 이 붙기 전까지 같은 모양의 결과를 규칙으로 만들어 둔다.
// api/seatWish.js 가 LLM 응답을 받으면 이 파일은 쓰이지 않는다.

export const GRADES = ['VIP', 'R', 'S', 'A']

// 등급별로 무대에서 얼마나 가까운지 (0 = 가장 앞)
export const GRADE_ZONE = { VIP: 0, R: 1, S: 2, A: 3 }

// "세 명", "네 자리" 같은 한글 수사도 받는다
const KOR_NUM = { 한: 1, 두: 2, 세: 3, 네: 4, 다섯: 5, 여섯: 6 }

function pickQuantity(t) {
  const m = t.match(/(\d+)\s*(명|장|매|자리|석)/)
  if (m) return Number(m[1])
  for (const [k, v] of Object.entries(KOR_NUM)) {
    if (new RegExp(`${k}\\s*(명|장|매|자리|석)`).test(t)) return v
  }
  if (/혼자|1인/.test(t)) return 1
  if (/둘이|커플/.test(t)) return 2
  return null
}

function pickPrice(t) {
  const m = t.match(/(\d+)\s*만\s*원?\s*(이하|아래|까지|미만|넘지)/)
  if (m) return Number(m[1]) * 10000
  const m2 = t.match(/(\d{4,})\s*원\s*(이하|아래|까지|미만)/)
  if (m2) return Number(m2[1])
  return null
}

/**
 * 자연어 → 구조화된 희망 조건
 * 결과 모양은 api/seatWish.js 상단에 문서화돼 있다(LLM 이 맞춰야 할 계약).
 */
export function parseWish(text) {
  const t = (text || '').replace(/\s+/g, ' ').trim()
  const low = t.toLowerCase()

  const must = []
  const prefer = []
  const flexible = []

  // ── 매수 ── 인원은 타협 대상이 아니라 항상 필수
  const quantity = pickQuantity(low)
  if (quantity) must.push({ key: 'quantity', label: '매수', value: `${quantity}매` })

  // ── 등급 ──
  let grades = GRADES.filter((g) => new RegExp(`${g}\\s*(석|등급)?`, 'i').test(t))
  if (!grades.length) {
    if (/앞자리|앞쪽|앞 열|앞열|가까운|가까이|무대 가까|무대앞/.test(low)) grades = ['VIP', 'R']
    else if (/뒤쪽|뒷자리|뒷 열|뒷열|멀어도|저렴|싼|가성비/.test(low)) grades = ['S', 'A']
  }
  const gradeStrict = /무조건|반드시|꼭/.test(low) && grades.length
  if (grades.length) {
    const item = { key: 'grades', label: '좌석 등급', value: grades.join('·') + '석' }
    ;(gradeStrict ? must : prefer).push(item)
  }

  // ── 가격 ──
  const maxPrice = pickPrice(low)
  if (maxPrice) must.push({ key: 'maxPrice', label: '1매 최대 가격', value: `${maxPrice.toLocaleString()}원` })

  // ── 연석 ──
  // "꼭 붙어 앉고 싶지만 정 안 되면 떨어져도 괜찮다" 처럼 희망과 양보가 함께 오는 게
  // 흔하다. 둘 중 하나만 남기면 사용자가 쓴 말을 절반 버리는 셈이라 둘 다 담는다.
  const wantsTogether = /붙어|붙여|나란히|연석|같이 앉|옆자리/.test(low)
  const acceptsApart = /떨어져\s*(도|앉아도|앉아야)|따로\s*앉아도|나눠\s*앉|흩어져도|간격\s*있어도/.test(low)

  let together = null
  if (wantsTogether) together = true
  else if (acceptsApart) together = false

  if (wantsTogether) {
    const strict = /무조건|반드시|꼭/.test(low)
    ;(strict ? must : prefer).push({ key: 'together', label: '연석', value: '붙어 있는 자리' })
  }
  if (acceptsApart) {
    flexible.push({ key: 'together', label: '연석', value: '떨어져 앉아도 괜찮음' })
  }

  // ── 위치 선호 ──
  const frontPreferred = /앞자리|앞쪽|앞 열|앞열|가까운|가까이|무대 가까|무대앞/.test(low)
    ? true
    : /뒤쪽|뒷자리|뒷 열|뒷열|멀어도/.test(low)
      ? false
      : null
  if (frontPreferred === true) prefer.push({ key: 'front', label: '위치', value: '무대와 가까운 앞쪽' })
  if (frontPreferred === false) flexible.push({ key: 'front', label: '위치', value: '뒤쪽이어도 괜찮음' })

  const centerPreferred = /중앙|가운데|센터|정면/.test(low) ? true : null
  if (centerPreferred) prefer.push({ key: 'center', label: '위치', value: '중앙 구역' })

  // ── 명시적 양보 표현 ──
  if (/비싸도|가격 상관 없|가격상관없/.test(low)) flexible.push({ key: 'price', label: '가격', value: '더 비싸도 괜찮음' })
  if (/등급 상관 없|아무 자리|아무 석|어디든|어디라도/.test(low)) flexible.push({ key: 'grades', label: '좌석 등급', value: '등급 상관 없음' })
  if (/통로|복도/.test(low)) prefer.push({ key: 'aisle', label: '위치', value: '통로 쪽' })

  // 아무것도 못 읽었으면 원문을 남겨 사용자가 직접 고치게 한다
  const unparsed = []
  if (!must.length && !prefer.length && !flexible.length && t) unparsed.push(t)

  return {
    quantity,
    // 사람이 실제로 말한 등급. 아무 말도 없으면 빈 배열이다.
    // grades 는 화면 표시용이라 미언급 시 전 등급을 채우는데, 그 값을 좌석
    // 릴리즈에 쓰면 전 등급이 풀려 늘 제일 좋은 자리(VIP)가 나간다.
    statedGrades: [...grades],
    grades: grades.length ? grades : [...GRADES],
    maxPrice,
    together,
    frontPreferred,
    centerPreferred,
    buckets: { must, prefer, flexible },
    unparsed
  }
}

/**
 * 파싱된 조건으로 지금 살 수 있는 좌석 등급을 점수 매겨 제안한다.
 * 개별 좌석은 백엔드에 없으므로 등급 단위로 낸다.
 */
export function matchGrades(round, wish) {
  if (!round) return []
  const want = new Set(wish.grades)
  const need = wish.quantity || 1

  return round.grades
    .map((g) => {
      const left = Math.max(0, g.capacity - g.sold)
      const reasons = []
      let score = 40

      if (want.has(g.grade)) {
        score += 40
        reasons.push(`요청하신 ${g.grade}석입니다.`)
      } else {
        reasons.push('요청 등급은 아니지만 조건에 가까워 함께 보여드립니다.')
      }

      if (wish.maxPrice) {
        if (g.price <= wish.maxPrice) {
          score += 22
          reasons.push(`1매 ${g.price.toLocaleString()}원으로 예산 안에 들어옵니다.`)
        } else {
          score -= 30
          reasons.push(`1매 ${g.price.toLocaleString()}원으로 예산을 넘습니다.`)
        }
      }

      if (wish.frontPreferred === true) {
        const z = GRADE_ZONE[g.grade] ?? 3
        score += (3 - z) * 7
        if (z <= 1) reasons.push('무대와 가까운 구역입니다.')
      } else if (wish.frontPreferred === false) {
        score += (GRADE_ZONE[g.grade] ?? 0) * 4
      }

      if (left === 0) {
        score -= 100
        reasons.push('매진되어 지금은 예매할 수 없습니다.')
      } else if (left < need) {
        score -= 45
        reasons.push(`잔여 ${left}석으로 요청하신 ${need}매를 채울 수 없습니다.`)
      } else {
        score += 18
        reasons.push(`잔여 ${left}석으로 ${need}매 예매가 가능합니다.`)
        if (wish.together) reasons.push('같은 등급 구역 안에서 인접 배정됩니다.')
      }

      return {
        grade: g.grade,
        price: g.price,
        left,
        available: left >= need,
        score: Math.max(0, Math.min(100, score)),
        reasons
      }
    })
    .sort((a, b) => b.score - a.score)
}
