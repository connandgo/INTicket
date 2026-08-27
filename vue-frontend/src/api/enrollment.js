import api from './index.js'

export const enrollmentApi = {
  // 예매 신청. 서버에서 결제 요청까지 이어진다.
  book(courseId) {
    return api.post('/api/enrollments', { courseId })
  },

  // 내 예매 내역
  getMine() {
    return api.get('/api/enrollments/my')
  },

  // 예매 취소. 본인 예매만 가능하고 결제도 함께 취소된다.
  // 남의 예매면 403, 이미 취소됐거나 없는 예매면 400.
  cancel(enrollmentId) {
    return api.delete(`/api/enrollments/${enrollmentId}`)
  }
}

// 취소표 대기 (Sprint2)
export const waitlistApi = {
  // 매진된 공연에만 등록할 수 있다. 매진이 아니면 400.
  register(courseId) {
    return api.post('/api/enrollments/waitlist', { courseId })
  },

  // 내 대기 목록. status 가 WAITING → MATCHED 로 바뀐다.
  // 서버가 먼저 알려주지 않으므로 화면에서 다시 불러 확인해야 한다.
  mine() {
    return api.get('/api/enrollments/waitlist/my')
  }
}

export const recommendApi = {
  forUser(userId) {
    return api.get(`/api/recommend/${userId}`)
  }
}
