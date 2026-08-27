import api from './index.js'
import { FEATURES } from '@/config/features.js'
import * as mock from '@/mock/inventory.js'
import { DEMO } from '@/config/features.js'

// 회차·좌석 등급·판매 현황은 course-service에서 제공한다.
// DEMO일 때만 브라우저 재고를 사용한다.

function unwrap(res) {
  const d = res?.data
  return d && typeof d === 'object' && 'data' in d ? d.data : d
}

// 공연 목록·상세·등록은 api/course.js 가 담당한다. 여기는 회차·좌석등급만 본다.
export const performanceApi = {
  // 회차 + 좌석등급별 가격·잔여
  async rounds(course) {
    if (FEATURES.scheduleApi && !DEMO) {
      return unwrap(await api.get(`/api/courses/${course.id}/schedules`))
    }
    return mock.getPerformance(course)?.rounds ?? []
  },

  async round(course, roundId) {
    if (FEATURES.scheduleApi && !DEMO) {
      return unwrap(await api.get(`/api/courses/${course.id}/schedules/${roundId}`))
    }
    return mock.getRound(course, roundId)
  },

  async addRound(courseId, round) {
    if (FEATURES.scheduleApi && !DEMO) {
      return unwrap(await api.post(`/api/courses/${courseId}/schedules`, round))
    }
    return mock.addRound(courseId, round)
  },

  async sales(course) {
    if (FEATURES.scheduleApi && !DEMO) {
      return unwrap(await api.get(`/api/courses/${course.id}/sales`))
    }
    return mock.salesOf(course)
  }
}

export const remaining = mock.remaining
