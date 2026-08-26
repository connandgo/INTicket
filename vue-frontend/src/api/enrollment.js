import api from './index.js'

export const enrollmentApi = {
  // 예매 신청. 서버에서 결제 요청까지 이어진다.
  book(courseId) {
    return api.post('/api/enrollments', { courseId })
  },

  // 내 예매 내역
  getMine() {
    return api.get('/api/enrollments/my')
  }

  // DELETE /api/enrollments/{id} 는 백엔드에 없다(명세서 R5). 취소 버튼을 두지 않는다.
}

export const recommendApi = {
  // 규칙 기반 공연 추천
  forUser(userId) {
    return api.get(`/api/recommend/${userId}`)
  }
}
