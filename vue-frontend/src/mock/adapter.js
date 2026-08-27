// 데모 모드에서 axios 요청을 가로채 백엔드 대신 응답한다.
//
// 화면·스토어·api 모듈은 전혀 고치지 않는다. 여기서 실제 백엔드와 똑같은 모양
// ({ success, message, data } 래퍼, 같은 상태코드, 같은 오류 문구)으로 돌려주기 때문에,
// 데모 모드를 끄면 그대로 진짜 서버를 부른다.

import { read, write, nextId } from './db.js'

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
    .filter((w) => w.courseId === courseId && w.status === 'WAITING')
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

  return fail(config, `데모 모드에서 지원하지 않는 요청입니다: ${method.toUpperCase()} ${url}`, 404)
}
