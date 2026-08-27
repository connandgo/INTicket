// 데모 모드에서 axios 요청을 가로채 백엔드 대신 응답한다.
//
// 화면·스토어·api 모듈은 전혀 고치지 않는다. 여기서 실제 백엔드와 똑같은 모양
// ({ success, message, data } 래퍼, 같은 상태코드, 같은 오류 문구)으로 돌려주기 때문에,
// 데모 모드를 끄면 그대로 진짜 서버를 부른다.

import { read, write, nextId } from './db.js'
import * as demandModel from '@/lib/demandModel.js'

const ok = (config, data, status = 200) => ({
  data: { success: true, message: '성공', data },
  status, statusText: 'OK', headers: {}, config
})

// 백엔드는 실패를 400 + { success:false, message } 형태로 준다.
function fail(config, message, status = 400) {
  const err = new Error(message)
  err.response = { data: { success: false, message, data: null }, status, statusText: 'Bad Request', headers: {}, config }
  err.config = config
  err.isAxiosError = true
  return Promise.reject(err)
}

// FastAPI recommend-service 응답에는 Java 공통 래퍼가 없다.
const raw = (config, data) => ({ data, status: 200, statusText: 'OK', headers: {}, config })

const delay = (ms = 180) => new Promise((r) => setTimeout(r, ms))

function currentUser(config) {
  try {
    return JSON.parse(sessionStorage.getItem('user') || 'null')
  } catch {
    return null
  }
}

// capacity 가 null 이면 무제한, 숫자면 enrollmentCount 가 그 값 이상일 때 매진
function soldOut(course) {
  if (course.capacity == null) return false
  return Number(course.enrollmentCount || 0) >= Number(course.capacity)
}

// 자리가 하나 났을 때 가장 먼저 대기한 사람을 자동으로 예매시킨다.
function autoMatch(db, courseId) {
  const next = db.waitlist
    .filter((w) => w.courseId === courseId && w.status === 'WAITING' && !w.parsed)
    .sort((a, b) => a.id - b.id)[0]
  if (!next) return
  const course = db.courses.find((c) => c.id === courseId)
  if (!course) return

  next.status = 'MATCHED'
  db.enrollments.push({
    id: nextId(db, 'enrollment'),
    userId: next.userId,
    courseId,
    status: 'ACTIVE',       // 자동 결제까지 끝난 상태로 들어온다
    createdAt: new Date().toISOString(),
    course: null
  })
  course.enrollmentCount += 1
}

function mockParse(text) {
  const source = String(text || '')
  const lower = source.toLowerCase()
  const required = {}
  const preferred = {}
  const flexible = {}
  const count = lower.match(/(\d+)\s*(명|장|매|자리|석)/)
  const wordCount = lower.match(/(한|두|세|네)\s*(명|장|매|자리|석)/)
  if (count) required.count = Number(count[1])
  else if (wordCount) required.count = { 한: 1, 두: 2, 세: 3, 네: 4 }[wordCount[1]]
  const price = lower.match(/(\d+)\s*만\s*원?\s*(이하|아래|까지)/)
  if (price) required.max_price = Number(price[1]) * 10000
  const grades = ['VIP', 'R', 'S', 'A'].filter((grade) => new RegExp(`${grade}\\s*석`, 'i').test(source))
  if (grades.length) (/무조건|반드시|꼭/.test(lower) ? required : preferred).grade = grades
  else if (/앞자리|앞쪽|가까운|무대/.test(lower)) preferred.grade = ['VIP', 'R']
  if (/붙어|나란히|연석|같이 앉/.test(lower)) preferred.row = 'same'
  if (/떨어져|따로 앉|나눠 앉/.test(lower)) flexible.allow_split = true
  return { required, preferred, flexible }
}

export default async function mockAdapter(config) {
  await delay()

  const url = (config.url || '').split('?')[0]
  const method = (config.method || 'get').toLowerCase()
  const body = config.data ? JSON.parse(config.data) : {}
  const db = read()
  const me = currentUser(config)

  /* ---------- 사용자 ---------- */
  if (url === '/api/users/register' && method === 'post') {
    if (db.users.some((u) => u.email === body.email)) {
      return fail(config, '이미 사용 중인 이메일입니다')
    }
    const user = {
      id: nextId(db, 'user'),
      email: body.email,
      name: body.name,
      role: body.role || 'STUDENT',
      createdAt: new Date().toISOString()
    }
    db.users.push(user)
    write(db)
    return ok(config, user, 201)
  }

  if (url === '/api/users/me' && method === 'get') {
    if (!me) return fail(config, '인증이 필요합니다', 401)
    return ok(config, me)
  }

  /* ---------- 공연 ---------- */
  if (url === '/api/courses' && method === 'get') {
    return ok(config, db.courses.filter((c) => c.status === 'ACTIVE'))
  }

  if (url === '/api/courses' && method === 'post') {
    if (me?.role !== 'INSTRUCTOR') {
      return fail(config, '강의 등록은 INSTRUCTOR만 가능합니다', 403)
    }
    const course = {
      id: nextId(db, 'course'),
      title: body.title,
      description: body.description ?? null,
      category: body.category,
      price: Number(body.price),
      capacity: body.capacity == null ? null : Number(body.capacity),
      instructorId: me.id,
      enrollmentCount: 0,
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    }
    db.courses.push(course)
    write(db)
    return ok(config, course, 201)
  }

  let m = url.match(/^\/api\/courses\/category\/([A-Z_]+)$/)
  if (m && method === 'get') {
    return ok(config, db.courses.filter((c) => c.category === m[1] && c.status === 'ACTIVE'))
  }

  m = url.match(/^\/api\/courses\/(\d+)$/)
  if (m && method === 'get') {
    const c = db.courses.find((x) => x.id === Number(m[1]))
    if (!c) return fail(config, `강의를 찾을 수 없습니다: ${m[1]}`)
    return ok(config, c)
  }

  /* ---------- 예매 ---------- */
  if (url === '/api/enrollments' && method === 'post') {
    if (!me) return fail(config, '인증이 필요합니다', 401)
    const course = db.courses.find((c) => c.id === Number(body.courseId))
    if (!course) return fail(config, `존재하지 않는 강의입니다: ${body.courseId}`)

    const dup = db.enrollments.find(
      (e) => e.userId === me.id && e.courseId === course.id && e.status !== 'CANCELLED'
    )
    if (dup) return fail(config, '이미 수강신청한 강의입니다')

    if (soldOut(course)) {
      return fail(config, '매진된 공연입니다. 취소표 대기 등록을 이용해 주세요')
    }

    const e = {
      id: nextId(db, 'enrollment'),
      userId: me.id,
      courseId: course.id,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      course: null,
      booking: body.booking || null
    }
    db.enrollments.push(e)
    write(db)

    // 모의 결제가 곧바로 끝나 ACTIVE로 넘어가는 실제 동작을 흉내낸다.
    setTimeout(() => {
      const d = read()
      const t = d.enrollments.find((x) => x.id === e.id)
      if (t && t.status === 'PENDING') {
        t.status = 'ACTIVE'
        const c = d.courses.find((x) => x.id === t.courseId)
        if (c) c.enrollmentCount += Number(t.booking?.quantity || 1)
        write(d)
      }
    }, 900)

    return ok(config, e, 201)
  }

  if (url === '/api/enrollments/my' && method === 'get') {
    if (!me) return fail(config, '인증이 필요합니다', 401)
    const list = db.enrollments
      .filter((e) => e.userId === me.id)
      .map((e) => {
        const c = db.courses.find((x) => x.id === e.courseId)
        return {
          ...e,
          course: c
            ? {
                id: c.id, title: c.title, description: c.description,
                category: c.category, price: c.price,
                thumbnail: null, instructorName: null,
                enrollmentCount: c.enrollmentCount
              }
            : null
        }
      })
      .sort((a, b) => b.id - a.id)
    return ok(config, list)
  }

  m = url.match(/^\/api\/enrollments\/(\d+)$/)
  if (m && method === 'delete') {
    if (!me) return fail(config, '인증이 필요합니다', 401)
    const e = db.enrollments.find((x) => x.id === Number(m[1]))
    if (!e) return fail(config, `예매 정보를 찾을 수 없습니다: ${m[1]}`)
    if (e.userId !== me.id) return fail(config, '본인의 예매만 취소할 수 있습니다', 403)
    if (e.status === 'CANCELLED') return fail(config, '이미 취소된 예매입니다')

    // ACTIVE였을 때만 예매 수를 되돌린다(PENDING은 애초에 올라간 적이 없다)
    if (e.status === 'ACTIVE') {
      const c = db.courses.find((x) => x.id === e.courseId)
      if (c) c.enrollmentCount = Math.max(0, c.enrollmentCount - Number(e.booking?.quantity || 1))
    }
    e.status = 'CANCELLED'

    // 자리가 났으니 대기 순서대로 한 명을 자동 예매·결제 처리한다.
    // 서버가 하는 일을 그대로 흉내낸 것이다.
    autoMatch(db, e.courseId)

    write(db)
    return ok(config, null)
  }

  /* ---------- 취소표 대기 ---------- */
  if (url === '/api/enrollments/waitlist' && method === 'post') {
    if (!me) return fail(config, '인증이 필요합니다', 401)
    const course = db.courses.find((c) => c.id === Number(body.courseId))
    if (!course) return fail(config, `존재하지 않는 강의입니다: ${body.courseId}`)
    if (!soldOut(course)) return fail(config, '매진되지 않은 공연입니다. 바로 예매해 주세요')

    if (db.waitlist.find((w) => w.userId === me.id && w.courseId === course.id)) {
      return fail(config, '이미 대기 등록한 공연입니다')
    }
    if (db.enrollments.find((e) => e.userId === me.id && e.courseId === course.id && e.status !== 'CANCELLED')) {
      return fail(config, '이미 예매한 공연입니다')
    }

    const w = {
      id: nextId(db, 'waitlist'),
      userId: me.id,
      courseId: course.id,
      status: 'WAITING',
      createdAt: new Date().toISOString()
    }
    db.waitlist.push(w)
    write(db)
    return ok(config, w, 201)
  }

  if (url === '/api/enrollments/waitlist/my' && method === 'get') {
    if (!me) return fail(config, '인증이 필요합니다', 401)
    return ok(config, db.waitlist.filter((w) => w.userId === me.id).sort((a, b) => b.id - a.id))
  }

  /* ---------- AI 취소표 매칭 (recommend-service) ---------- */
  if (url === '/api/recommend/waitlists' && method === 'post') {
    if (!me) return fail(config, '인증이 필요합니다', 401)
    const parsed = mockParse(body.conditionText)
    const seq = db.waitlist.filter((item) => item.courseId === Number(body.courseId)).length + 1
    const item = {
      id: nextId(db, 'waitlist'), waitlistId: db.seq.waitlist,
      userId: me.id, courseId: Number(body.courseId), seq,
      rawText: body.conditionText || '', parsed, status: 'WAITING',
      createdAt: new Date().toISOString()
    }
    db.waitlist.push(item)
    write(db)
    return raw(config, { waitlistId: item.waitlistId, seq, parsed })
  }

  if (url === '/api/recommend/waitlists/my' && method === 'get') {
    if (!me) return fail(config, '인증이 필요합니다', 401)
    return raw(config, db.waitlist
      .filter((item) => item.userId === me.id && item.parsed && item.status === 'WAITING')
      .map((item) => ({
        waitlistId: item.waitlistId, courseId: item.courseId, seq: item.seq,
        rawText: item.rawText, parsed: item.parsed
      })))
  }

  if (url === '/api/recommend/offers/my' && method === 'get') {
    if (!me) return fail(config, '인증이 필요합니다', 401)
    const now = Date.now() / 1000
    for (const item of db.offers || []) {
      if (item.status === 'PENDING' && item.expiresAt <= now) item.status = 'EXPIRED'
    }
    write(db)
    return raw(config, (db.offers || []).filter((item) => item.userId === me.id && item.status === 'PENDING'))
  }

  m = url.match(/^\/api\/recommend\/offers\/([^/]+)\/accept$/)
  if (m && method === 'post') {
    if (!me) return fail(config, '인증이 필요합니다', 401)
    const item = (db.offers || []).find((offer) => offer.offerId === m[1] && offer.userId === me.id)
    if (!item || item.status !== 'PENDING') return fail(config, '수락할 수 없는 제안입니다.')
    item.status = 'ACCEPTED'
    const waiting = db.waitlist.find((w) => w.userId === me.id && w.courseId === item.courseId && w.parsed)
    if (waiting) waiting.status = 'MATCHED'
    write(db)
    return raw(config, { success: true, message: '좌석 제안을 수락했습니다.' })
  }

  if (url === '/api/recommend/internal/released' && method === 'post') {
    const next = db.waitlist
      .filter((item) => item.courseId === Number(body.courseId) && item.status === 'WAITING' && item.parsed)
      .sort((a, b) => a.seq - b.seq)[0]
    if (!next) return raw(config, { matched: 0, offers: [], reason: '조건에 맞는 대기자가 없습니다.', mode: 'NONE' })

    const required = next.parsed?.required || {}
    const preferred = next.parsed?.preferred || {}
    const grades = required.grade || preferred.grade || []
    const count = Math.max(1, Math.min(4, Number(required.count) || 1))
    const candidates = (body.seats || []).filter((seat) => !grades.length || grades.includes(String(seat).split('-')[0]))
    const assigned = candidates.slice(0, count)
    if (assigned.length < count) return raw(config, { matched: 0, offers: [], reason: '조건에 맞는 좌석이 부족합니다.', mode: 'NONE' })

    const offer = {
      offerId: `of-${Date.now()}`, userId: next.userId, courseId: next.courseId,
      seats: assigned, seatsText: assigned.join(', '), expiresAt: Date.now() / 1000 + 600,
      status: 'PENDING'
    }
    db.offers ||= []
    db.offers.push(offer)
    write(db)
    return raw(config, { matched: 1, offers: [offer], reason: `대기 ${next.seq}번의 필수 조건에 맞는 좌석입니다.`, mode: body.reason === 'DEADLINE_BATCH' ? 'BATCH' : 'SINGLE' })
  }

  /* ---------- 기획사 AI 수요 분석 ----------
     데모 모드에서도 실서비스와 같은 API 계약으로 응답해 404 경고나
     "임시 추정치" 안내 없이 발표 흐름을 그대로 확인할 수 있게 한다. */
  m = url.match(/^\/api\/recommend\/forecast\/(\d+)$/)
  if (m && method === 'get') {
    if (!me) return fail(config, '인증이 필요합니다', 401)
    const course = db.courses.find((item) => item.id === Number(m[1]))
    if (!course) return fail(config, '공연을 찾을 수 없습니다.', 404)
    return raw(config, { ...demandModel.analyze(course), aiEnabled: false })
  }

  m = url.match(/^\/api\/recommend\/forecast\/(\d+)\/simulate$/)
  if (m && method === 'post') {
    if (!me) return fail(config, '인증이 필요합니다', 401)
    const course = db.courses.find((item) => item.id === Number(m[1]))
    if (!course) return fail(config, '공연을 찾을 수 없습니다.', 404)
    const analysis = demandModel.analyze(course)
    return raw(config, {
      ...demandModel.simulate(course, analysis, { seats: Number(body.capacity) }),
      dayLabel: '', time: body.time, capacity: Number(body.capacity), aiEnabled: false
    })
  }

  /* ---------- 개인화 공연 추천 ---------- */
  m = url.match(/^\/api\/recommend\/(\d+)$/)
  if (m && method === 'get') {
    const userId = Number(m[1])
    const mine = db.enrollments.filter((item) => item.userId === userId && item.status === 'ACTIVE')
    const booked = new Set(mine.map((item) => item.courseId))
    const last = db.courses.find((item) => item.id === mine.at(-1)?.courseId)
    const category = last?.category || null
    const candidates = db.courses
      .filter((item) => !booked.has(item.id) && (!category || item.category === category))
      .sort((a, b) => b.enrollmentCount - a.enrollmentCount)
      .slice(0, 4)
    return raw(config, {
      userId, recommendedCourses: candidates.length ? candidates : db.courses.slice(0, 4),
      basedOnCategory: category, message: category ? `${category} 장르 기반 추천 공연입니다` : '인기 공연 추천입니다'
    })
  }

  return fail(config, `데모 모드에서 지원하지 않는 요청입니다: ${method.toUpperCase()} ${url}`, 404)
}
