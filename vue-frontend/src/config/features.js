// 백엔드가 아직 없는 기능은 프론트 목업으로 돌린다.
//
// 팀 기능명세서(Sprint1)에는 회차·좌석등급·잔여수량·선점(expiresAt)이 있는데
// 현재 백엔드에는 courses/enrollments/payments/recommend 밖에 없다.
// 없는 것만 목업으로 채우고, 엔드포인트가 생기면 여기 플래그만 끄면 된다.
//
// .env 에 VITE_API_PERFORMANCE=true 처럼 넣으면 개별로 전환된다.
const on = (key) => import.meta.env[key] === 'true'

// 데모 모드 — 백엔드 없이 화면 전체를 돌린다.
//
// 저장 위치는 sessionStorage 다. localStorage 에 두었더니 한 번 켠 뒤로 계속
// 눌러붙어서, 실서버에 붙이려는데 데모가 화면을 가로채는 일이 있었다.
// 탭을 닫으면 자동으로 꺼지는 편이 안전하다.
//
// 켜는 방법: .env 의 VITE_DEMO=true, 또는 주소에 ?demo=1
// 끄는 방법: 주소에 ?demo=0, 헤더의 '끄기', 또는 탭 닫기
const DEMO_KEY = 'inticket.demo'

function demoOn() {
  // 예전 버전이 localStorage 에 남겨 둔 값은 발견하는 즉시 지운다.
  try { localStorage.removeItem(DEMO_KEY) } catch { /* noop */ }

  if (on('VITE_DEMO')) return true

  try {
    const q = new URLSearchParams(location.search).get('demo')
    if (q === '1') { sessionStorage.setItem(DEMO_KEY, '1'); return true }
    if (q === '0') { sessionStorage.removeItem(DEMO_KEY); return false }
    return sessionStorage.getItem(DEMO_KEY) === '1'
  } catch {
    return false
  }
}

export const DEMO = demoOn()

export function setDemo(v) {
  try {
    if (v) sessionStorage.setItem(DEMO_KEY, '1')
    else sessionStorage.removeItem(DEMO_KEY)
    localStorage.removeItem(DEMO_KEY)
  } catch { /* noop */ }
  // 데모를 끌 때는 데모용 로그인 상태도 같이 버린다. 실서버 토큰이 아니기 때문.
  if (!v) {
    try { sessionStorage.removeItem('access_token'); sessionStorage.removeItem('user') } catch { /* noop */ }
  }
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
