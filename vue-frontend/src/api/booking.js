import api from './index.js'
import { FEATURES } from '@/config/features.js'
import * as mock from '@/mock/inventory.js'

// 예매 = 기존 enrollment-service(POST /api/enrollments)로 실제 예매 건을 만들고,
// 회차·등급·매수·선점 마감시각은 booking-service가 생기기 전까지 프론트가 들고 있는다.

function unwrap(res) {
  const d = res?.data
  return d && typeof d === 'object' && 'data' in d ? d.data : d
}

const LOCAL_KEY = 'inticket.booking.v1'

function loadLocal() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}') } catch { return {} }
}
function saveLocal(m) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(m)) } catch { /* noop */ }
}

// 백엔드는 중복 예매에 409가 아니라 400 + "이미 수강신청한 강의입니다"로 답한다.
// 문구는 내부 도메인 그대로라 화면에는 공연 표현으로 바꿔서 보여 준다.
export function isDuplicate(e) {
  const st = e.response?.status
  const msg = e.response?.data?.message || ''
  return st === 409 || (st === 400 && /이미 .*(수강신청|예매)/.test(msg))
}

export const bookingApi = {
  // 좌석등급 선점. 잔여 수량이 즉시 줄고 결제 마감 시각을 받는다.
  async hold(course, roundId, grade, quantity) {
    if (FEATURES.holdApi) {
      return unwrap(await api.post('/api/enrollments/holds', {
        performanceId: course.id, scheduleId: roundId, grade, quantity
      }))
    }
    return mock.hold(course, roundId, grade, quantity)
  },

  // 선점분 결제 확정. 실제 예매 건은 기존 enrollment API로 만든다.
  async confirm(course, roundId, held) {
    const created = unwrap(await api.post('/api/enrollments', {
      courseId: Number(course.id), holdId: held.holdId
    }))
    // 응답은 PENDING이지만 모의 결제가 곧바로 끝나 DB는 이미 ACTIVE일 수 있다.
    // 확정 여부는 화면에서 목록을 다시 읽어 판단한다.

    // 회차·등급·매수는 백엔드가 아직 모르는 정보라 브라우저에 붙여 둔다.
    const key = String(created?.id ?? `${course.id}-${roundId}`)
    const m = loadLocal()
    m[key] = {
      courseId: Number(course.id),
      roundId,
      grade: held.grade,
      quantity: held.quantity,
      unitPrice: held.unitPrice,
      amount: held.amount,
      at: new Date().toISOString()
    }
    saveLocal(m)
    return created
  },

  // 선점만 풀기(결제 안 함) — 잔여 수량 복구
  async release(courseId, roundId, grade, quantity, holdId = null) {
    if (FEATURES.holdApi) {
      return unwrap(await api.delete('/api/enrollments/holds', {
        data: { holdId, performanceId: courseId, scheduleId: roundId, grade, quantity }
      }))
    }
    return mock.release(courseId, roundId, grade, quantity)
  },

  mine() {
    return api.get('/api/enrollments/my').then(unwrap)
  },

  // 예매 건에 붙여 둔 회차·등급 정보
  detailOf(enrollmentId) {
    return loadLocal()[String(enrollmentId)] || null
  }
}
