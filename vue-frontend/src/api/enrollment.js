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

export const recommendApi = {
  // 규칙 기반 공연 추천
  forUser(userId) {
    return api.get(`/api/recommend/${userId}`)
  }
}
