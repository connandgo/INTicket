// 데모 모드용 저장소.
//
// 백엔드가 없어도 화면 전체가 돌아가도록, 백엔드가 돌려줄 값과 똑같은 모양으로
// 공연·예매·사용자를 브라우저에 들고 있는다. DB 스키마는 건드리지 않는다.
// 실제 서버가 붙으면 이 파일은 아예 쓰이지 않는다.

// v2: 사용자에 비밀번호가 생겼다. v1 저장값에는 없어서 로그인이 되지 않는다.
const KEY = 'inticket.demo.v2'

function seed() {
  // capacity 가 null 이면 정원 무제한. 숫자면 enrollmentCount 가 그 값에 닿는 순간 매진.
  const mk = (id, title, category, price, count, desc, capacity = null) => ({
    id, title, description: desc, category, price, capacity,
    instructorId: 2, enrollmentCount: count, status: 'ACTIVE',
    createdAt: new Date(Date.now() - id * 3600_000).toISOString()
  })

  return {
    users: [
      { id: 1, email: 'viewer@demo.com', name: '김관람', role: 'STUDENT', password: 'inticket1234', createdAt: new Date().toISOString() },
      { id: 2, email: 'promoter@demo.com', name: '한기획', role: 'INSTRUCTOR', password: 'inticket1234', createdAt: new Date().toISOString() }
    ],
    courses: [
      mk(1, '뮤지컬 오페라의 유령', 'BACKEND', 150000, 842,
         '일시 2026.09.12(금) 19:30\n장소 블루스퀘어 신한카드홀\n관람시간 160분(인터미션 20분 포함)\n관람등급 14세 이상\n\n파리 오페라 하우스 지하에 사는 유령과 젊은 소프라노.', 842),
      mk(2, '연극 고도를 기다리며', 'FRONTEND', 60000, 317,
         '일시 2026.09.19(금) 20:00\n장소 LG아트센터 서울\n관람시간 120분(인터미션 없음)\n관람등급 14세 이상\n\n무대에 나무 한 그루와 돌 하나. 배우 네 명이 두 시간을 채웁니다.', 320),
      mk(3, '말러 교향곡 제2번 부활', 'DATA_SCIENCE', 100000, 521,
         '일시 2026.09.26(토) 20:00\n장소 롯데콘서트홀\n관람시간 95분(인터미션 없음)\n관람등급 초등학생 이상\n\n합창단 120명과 오르간이 함께 오르는 5악장.'),
      mk(4, 'THE FIRST LIGHT 콘서트', 'DEVOPS', 132000, 1204,
         '일시 2026.10.03(토) 18:00\n장소 KSPO DOME\n관람시간 150분\n관람등급 8세 이상', 1204),
      mk(5, '뮤지컬 레미제라블', 'BACKEND', 140000, 678,
         '일시 2026.09.13(토) 14:00\n장소 샤롯데씨어터\n관람시간 175분(인터미션 20분 포함)\n관람등급 8세 이상\n\n바리케이드 회전 무대가 그대로 올라옵니다.'),
      mk(6, '연극 한여름 밤의 꿈', 'FRONTEND', 45000, 132,
         '일시 2026.09.13(토) 15:00\n장소 예술의전당 자유소극장\n관람시간 145분\n관람등급 8세 이상'),
      mk(7, '베토벤 피아노 협주곡 전곡', 'DATA_SCIENCE', 88000, 94,
         '일시 2026.10.10(토) 17:00\n장소 예술의전당 콘서트홀\n관람시간 130분(인터미션 20분 포함)')
    ],
    enrollments: [],
    waitlist: [],
    seq: { user: 10, course: 100, enrollment: 1000, waitlist: 500 }
  }
}

export function read() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* 초기화로 넘어간다 */ }
  const s = seed()
  write(s)
  return s
}

export function write(db) {
  try { localStorage.setItem(KEY, JSON.stringify(db)) } catch { /* noop */ }
}

export function reset() {
  try { localStorage.removeItem(KEY) } catch { /* noop */ }
  // 회차·재고도 같이 비운다
  try { localStorage.removeItem('inticket.inventory.v1') } catch { /* noop */ }
  try { localStorage.removeItem('inticket.booking.v1') } catch { /* noop */ }
}

export function nextId(db, kind) {
  db.seq[kind] += 1
  return db.seq[kind]
}
