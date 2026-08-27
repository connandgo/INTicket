import api from './index.js'
import { FEATURES } from '@/config/features.js'
import * as mock from '@/mock/inventory.js'

// 공연 = 기존 course-service. 회차·좌석등급은 아직 백엔드가 없어 목업을 거친다.
// performance-service가 생기면 FEATURES.scheduleApi 를 켜기만 하면 된다.

function unwrap(res) {
  const d = res?.data
  return d && typeof d === 'object' && 'data' in d ? d.data : d
}

// 공연 목록·상세·등록은 api/course.js 가 담당한다. 여기는 회차·좌석등급만 본다.
export const performanceApi = {
  // 회차 + 좌석등급별 가격·잔여
  async rounds(course) {
    if (FEATURES.scheduleApi) {
      return unwrap(await api.get(`/api/performances/${course.id}/schedules`))
    }
    return mock.getPerformance(course)?.rounds ?? []
  },

  async round(course, roundId) {
    if (FEATURES.scheduleApi) {
      return unwrap(await api.get(`/api/performances/${course.id}/schedules/${roundId}`))
    }
    return mock.getRound(course, roundId)
  },

  async addRound(courseId, round) {
    if (FEATURES.scheduleApi) {
      return unwrap(await api.post(`/api/performances/${courseId}/schedules`, round))
    }
    return mock.addRound(courseId, round)
  },

  async sales(course) {
    if (FEATURES.scheduleApi) {
      return unwrap(await api.get(`/api/performances/${course.id}/sales`))
    }
    return mock.salesOf(course)
  }
}

export const remaining = mock.remaining
