import api from './index.js'

// 명세서 10.1 — 신규 API 없이 기존 계약을 그대로 쓴다.
export const courseApi = {
  // 공연 목록
  getAll(params) {
    return api.get('/api/courses', { params })
  },

  // 장르별 공연
  getByCategory(category) {
    return api.get(`/api/courses/category/${category}`)
  },

  // 공연 상세
  getById(id) {
    return api.get(`/api/courses/${id}`)
  },

  // 공연 등록 (공연기획사)
  create(data) {
    return api.post('/api/courses', data)
  }

  // PUT /api/courses/{id} 는 백엔드에 없다(명세서 R5). 화면에 수정 기능을 두지 않는다.
}
