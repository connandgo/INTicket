import { SHOWCASE } from '@/data/showcase.js'
// 데모 모드용 저장소.
//
// 백엔드가 없어도 화면 전체가 돌아가도록, 백엔드가 돌려줄 값과 똑같은 모양으로
// 공연·예매·사용자를 브라우저에 들고 있는다. DB 스키마는 건드리지 않는다.
// 실제 서버가 붙으면 이 파일은 아예 쓰이지 않는다.

// v3: 공연 목록을 내장 카탈로그(실제 DB 값)로 바꿨다. 이전 저장값은 공연 구성이 달라
// 백엔드가 있을 때와 없을 때 화면이 다른 숫자를 말한다.
const KEY = 'inticket.demo.v3'

function seed() {
  // capacity 가 null 이면 정원 무제한. 숫자면 enrollmentCount 가 그 값에 닿는 순간 매진.

  return {
    users: [
      { id: 1, email: 'viewer@demo.com', name: '김관람', role: 'STUDENT', password: 'inticket1234', createdAt: new Date().toISOString() },
      { id: 2, email: 'promoter@demo.com', name: '한기획', role: 'INSTRUCTOR', password: 'inticket1234', createdAt: new Date().toISOString() }
    ],
    // 공연 목록은 내장 카탈로그를 그대로 쓴다.
    // 실제 DB(course-service)에서 뜬 값이라, 백엔드가 있든 없든 같은 공연·같은
    // 정원·같은 예매수가 보인다. 따로 적어 두면 두 화면이 다른 숫자를 말하게 된다.
    // 기획사 ID 만 데모 계정(한기획, id 2)으로 바꿔 수요 분석을 열어볼 수 있게 한다.
    courses: SHOWCASE.map((c) => ({
      ...c,
      instructorId: 2,
      createdAt: new Date(Date.now() - c.id * 3600_000).toISOString()
    })),
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
