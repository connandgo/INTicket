import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { enrollmentApi } from '@/api/enrollment.js'
import { bookingApi } from '@/api/booking.js'
import { DEMO } from '@/config/features.js'

function unwrap(res) {
  const d = res?.data
  if (d && typeof d === 'object' && 'data' in d) return d.data
  return d
}

// 화면 표시용 상태 이름. 내부 값(PENDING/ACTIVE/CANCELLED)은 그대로 둔다(명세서 4.1).
export const STATUS_LABEL = {
  PENDING: '결제 처리 중',
  ACTIVE: '예매 확정',
  CANCELLED: '예매 취소'
}
export const STATUS_STYLE = {
  PENDING: 'bdg-warn',
  ACTIVE: 'bdg-ok',
  CANCELLED: 'bdg-gray'
}

export const useEnrollmentStore = defineStore('enrollment', () => {
  const items = ref([])
  const loading = ref(false)
  const error = ref(null)
  const loaded = ref(false)

  const bookedCourseIds = computed(
    () => new Set(items.value.filter((e) => e.status !== 'CANCELLED').map((e) => e.courseId))
  )

  async function fetchMine() {
    loading.value = true
    error.value = null
    try {
      const list = unwrap(await enrollmentApi.getMine())
      items.value = Array.isArray(list) ? list : []
      loaded.value = true
    } catch (e) {
      console.error('[enrollment] 내 예매 조회 실패:', e)
      error.value = e.response?.data?.message || '예매 내역을 불러오지 못했습니다.'
      items.value = []
    } finally {
      loading.value = false
    }
  }

  // 예매 신청. 서버가 결제 요청까지 이어서 처리하고 PENDING으로 돌아온다.
  async function book(courseId) {
    const res = await enrollmentApi.book(courseId)
    const created = unwrap(res)
    await fetchMine()
    return created
  }

  // 실서버는 예매 취소와 동시에 선점 좌석·결제 상태를 원자적으로 되돌린다.
  // 백엔드가 없는 데모 모드에서만 브라우저 재고를 직접 복구한다.
  async function cancel(enrollment) {
    await enrollmentApi.cancel(enrollment.id)

    const d = DEMO ? bookingApi.detailOf(enrollment.id) : null
    if (DEMO && d) {
      try {
        await bookingApi.release(d.courseId, d.roundId, d.grade, d.quantity)
      } catch (e) {
        console.warn('[enrollment] 재고 복구 실패:', e)
      }
    }

    await fetchMine()
  }

  function findByCourse(courseId) {
    return items.value.find((e) => e.courseId === Number(courseId) && e.status !== 'CANCELLED') || null
  }

  return { items, loading, error, loaded, bookedCourseIds, fetchMine, book, cancel, findByCourse }
})
