// 실서버에서는 회차·좌석 선점·대기열 API를 기본 사용한다.
// 발표용 DEMO에서만 같은 흐름을 브라우저 목업으로 재현한다.
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

  // 회차 / 좌석등급 / 잔여수량 — course-service
  scheduleApi: import.meta.env.VITE_API_SCHEDULE !== 'false',

  // 선점(HOLD) + 결제 마감 시각 — enrollment-service
  holdApi: import.meta.env.VITE_API_HOLD !== 'false',

  // 대기 등록 · 취소표 자동 매칭
  waitlistApi: import.meta.env.VITE_API_WAITLIST !== 'false'
}

// 선점 유지 시간(분). 결제를 마치지 않으면 재고로 자동 반환된다.
export const HOLD_MINUTES = 10
