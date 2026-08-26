// 백엔드가 아직 없는 기능은 프론트 목업으로 돌린다.
//
// 팀 기능명세서(Sprint1)에는 회차·좌석등급·잔여수량·선점(expiresAt)이 있는데
// 현재 백엔드에는 courses/enrollments/payments/recommend 밖에 없다.
// 없는 것만 목업으로 채우고, 엔드포인트가 생기면 여기 플래그만 끄면 된다.
//
// .env 에 VITE_API_PERFORMANCE=true 처럼 넣으면 개별로 전환된다.
const on = (key) => import.meta.env[key] === 'true'

// 데모 모드 — 백엔드 없이 화면 전체를 돌린다.
// .env 의 VITE_DEMO, 주소의 ?demo=1 / ?demo=0, 그리고 화면에서 켠 값 순으로 본다.
function demoOn() {
  if (on('VITE_DEMO')) return true
  try {
    const q = new URLSearchParams(location.search).get('demo')
    if (q === '1') { localStorage.setItem('inticket.demo', '1'); return true }
    if (q === '0') { localStorage.removeItem('inticket.demo'); return false }
    return localStorage.getItem('inticket.demo') === '1'
  } catch {
    return false
  }
}

export const DEMO = demoOn()

export function setDemo(v) {
  try {
    if (v) localStorage.setItem('inticket.demo', '1')
    else localStorage.removeItem('inticket.demo')
  } catch { /* noop */ }
  location.href = '/'
}

export const FEATURES = {
  // 공연 목록·상세 — 기존 course-service 사용 (실제 API)
  performanceApi: true,

  // 회차 / 좌석등급 / 잔여수량 — performance-service 생기면 true
  scheduleApi: on('VITE_API_SCHEDULE'),

  // 선점(HOLD) + 결제 마감 시각 — booking-service 생기면 true
  holdApi: on('VITE_API_HOLD'),

  // 대기 등록 · 취소표 매칭 (Sprint2)
  waitlistApi: on('VITE_API_WAITLIST')
}

// 선점 유지 시간(분). 명세서상 미결제 시 다음 순번으로 승계된다.
export const HOLD_MINUTES = 10
