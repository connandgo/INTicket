// 매진 판정.
//
// 백엔드 규칙: capacity가 null이면 무제한, 숫자면 해당 공연의 정원이다.
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

// 서버에 아직 그 기능이 배포되지 않은 경우.
// 소스에는 있는데 컨테이너가 옛 이미지로 돌고 있으면 404/405/500 이 온다.
// 사용자에게 '서버 오류'라고만 말하면 원인을 알 수 없어서 따로 구분한다.
export function isNotDeployed(e) {
  const st = e?.response?.status
  return st === 404 || st === 405 || st === 501 || st === 500
}
