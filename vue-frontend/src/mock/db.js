// 데모 모드용 저장소.
//
// 백엔드가 없어도 화면 전체가 돌아가도록, 백엔드가 돌려줄 값과 똑같은 모양으로
// 공연·예매·사용자를 브라우저에 들고 있는다. DB 스키마는 건드리지 않는다.
// 실제 서버가 붙으면 이 파일은 아예 쓰이지 않는다.

import { SHOWCASE } from '@/data/showcase.js'

const KEY = 'inticket.demo.v1'

function seed() {
  return {
    users: [
      { id: 1, email: 'viewer@demo.com', name: '김관람', role: 'STUDENT', createdAt: new Date().toISOString() },
      { id: 2, email: 'promoter@demo.com', name: '한기획', role: 'INSTRUCTOR', createdAt: new Date().toISOString() }
    ],
    courses: SHOWCASE.map((course) => ({ ...course })),
    enrollments: [],
    waitlist: [],
    offers: [],
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
