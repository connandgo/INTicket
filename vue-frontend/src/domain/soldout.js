// 매진 판정.
//
// 백엔드 규칙(API_SPEC 2절): capacity 가 null 이면 무제한, 숫자면 그게 정원.
// enrollmentCount >= capacity 가 되면 매진이고, 그 뒤로는 예매 대신
// 취소표 대기 등록만 가능하다. 판정이 여러 화면에 흩어지지 않게 여기 모아 둔다.

export function hasCapacity(course) {
  return course?.capacity !== null && course?.capacity !== undefined
}

export function isSoldOut(course) {
  if (!hasCapacity(course)) return false
  return Number(course.enrollmentCount || 0) >= Number(course.capacity)
}

export function seatsLeft(course) {
  if (!hasCapacity(course)) return null
  return Math.max(0, Number(course.capacity) - Number(course.enrollmentCount || 0))
}

// 잔여가 얼마 안 남았을 때 강조할지
export function isAlmostGone(course) {
  const left = seatsLeft(course)
  return left !== null && left > 0 && left <= 10
}

// 백엔드가 매진이라고 400 을 줬는지
export function isSoldOutError(e) {
  const msg = e?.response?.data?.message || ''
  return e?.response?.status === 400 && msg.includes('매진된')
}

// 매진이 아닌데 대기 등록을 시도했을 때
export function isNotSoldOutError(e) {
  const msg = e?.response?.data?.message || ''
  return e?.response?.status === 400 && msg.includes('매진되지 않은')
}
