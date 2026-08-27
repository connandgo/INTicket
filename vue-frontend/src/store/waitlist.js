import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { waitlistApi } from '@/api/enrollment.js'

function unwrap(res) {
  const d = res?.data
  return d && typeof d === 'object' && 'data' in d ? d.data : d
}

export const WAIT_LABEL = {
  WAITING: '대기 중',
  MATCHED: '자리 배정됨'
}
export const WAIT_STYLE = {
  WAITING: 'bdg-warn',
  MATCHED: 'bdg-ok'
}

export const useWaitlistStore = defineStore('waitlist', () => {
  const items = ref([])
  const loading = ref(false)
  const error = ref(null)
  // 구버전 서버와 함께 띄웠을 때 대기 기능 지원 여부
  const available = ref(true)

  const waitingCourseIds = computed(
    () => new Set(items.value.filter((w) => w.status === 'WAITING').map((w) => w.courseId))
  )
  const hasWaiting = computed(() => items.value.some((w) => w.status === 'WAITING'))

  async function fetchMine() {
    loading.value = true
    error.value = null
    try {
      const list = unwrap(await waitlistApi.mine())
      items.value = Array.isArray(list) ? list : []
    } catch (e) {
      // 구버전 서버에는 엔드포인트가 없을 수 있으므로 빈 상태로 호환한다.
      const st = e.response?.status
      if (st === 404 || st === 405 || st === 500) {
        available.value = false
      } else {
        console.error('[waitlist] 대기 목록 조회 실패:', e)
        error.value = e.response?.data?.message || '대기 내역을 불러오지 못했습니다.'
      }
      items.value = []
    } finally {
      loading.value = false
    }
  }

  async function register(courseId) {
    const created = unwrap(await waitlistApi.register(Number(courseId)))
    await fetchMine()
    return created
  }

  function findByCourse(courseId) {
    return items.value.find((w) => w.courseId === Number(courseId)) || null
  }

  /* ---------- 자동 매칭 확인 ----------
     취소가 나면 서버가 대기 순서대로 알아서 예매까지 끝내고 status 를 MATCHED 로 바꾼다.
     푸시가 없으므로 대기 중인 게 있을 때만 주기적으로 다시 읽는다. */
  let timer = null

  function startPolling(onMatched, everyMs = 15000) {
    stopPolling()
    if (!hasWaiting.value) return
    timer = setInterval(async () => {
      const before = new Set(items.value.filter((w) => w.status === 'MATCHED').map((w) => w.id))
      await fetchMine()
      const fresh = items.value.filter((w) => w.status === 'MATCHED' && !before.has(w.id))
      if (fresh.length && typeof onMatched === 'function') onMatched(fresh)
      if (!hasWaiting.value) stopPolling()
    }, everyMs)
  }

  function stopPolling() {
    if (timer) clearInterval(timer)
    timer = null
  }

  return {
    items, loading, error, available,
    waitingCourseIds, hasWaiting,
    fetchMine, register, findByCourse, startPolling, stopPolling
  }
})
