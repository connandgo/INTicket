import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { courseApi } from '@/api/course.js'
import { genreLabel } from '@/domain/genre.js'
import { DEMO } from '@/config/features.js'
import { SHOWCASE, findShowcase } from '@/data/showcase.js'

// 서버 응답이 { success, data, message } 껍데기로 오기도 하고 그냥 오기도 한다.
function unwrap(res) {
  const d = res?.data
  if (d && typeof d === 'object' && 'data' in d) return d.data
  return d
}

export const useCourseStore = defineStore('course', () => {
  const courses = ref([])
  const current = ref(null)
  const loading = ref(false)
  const error = ref(null)
  let listRequest = null
  // Gateway가 비로그인 조회를 막을 때 MVP 공개 카탈로그를 표시하는 상태.
  const isShowcase = ref(false)

  const genre = ref('ALL')

  const visible = computed(() =>
    genre.value === 'ALL' ? courses.value : courses.value.filter((c) => c.category === genre.value)
  )

  // 인기순 — 누적 예매 수 기준. 목록 상단 랭킹에 쓴다.
  const ranked = computed(() =>
    [...courses.value].sort((a, b) => (b.enrollmentCount || 0) - (a.enrollmentCount || 0))
  )

  async function fetchCourses({ force = false } = {}) {
    if (!force && courses.value.length) {
      const signedInAfterPreview = isShowcase.value && sessionStorage.getItem('access_token')
      if (!signedInAfterPreview) return courses.value
    }
    if (listRequest) return listRequest

    loading.value = true
    error.value = null
    isShowcase.value = false

    // 현재 Gateway 정책을 이미 알고 있으므로 불필요한 401 요청과 콘솔 오류 없이
    // 공개 카탈로그를 즉시 보여준다. 데모 모드는 자체 어댑터의 데이터를 사용한다.
    if (!DEMO && !sessionStorage.getItem('access_token')) {
      courses.value = SHOWCASE.map((course) => ({ ...course }))
      isShowcase.value = true
      loading.value = false
      return courses.value
    }

    listRequest = (async () => {
      try {
        const list = unwrap(await courseApi.getAll())
        courses.value = Array.isArray(list) ? list : []
        isShowcase.value = false
        return courses.value
      } catch (e) {
        console.error('[course] 목록 조회 실패:', e)
        if (e.response?.status === 401) {
          courses.value = SHOWCASE.map((course) => ({ ...course }))
          isShowcase.value = true
        } else {
          error.value = message(e, '공연 목록을 불러오지 못했습니다.')
          courses.value = []
        }
        return courses.value
      } finally {
        loading.value = false
        listRequest = null
      }
    })()
    return listRequest
  }

  async function fetchCourse(id) {
    loading.value = true
    error.value = null
    isShowcase.value = false
    current.value = null

    if (!DEMO && !sessionStorage.getItem('access_token')) {
      current.value = findShowcase(id)
      isShowcase.value = Boolean(current.value)
      if (!current.value) error.value = '존재하지 않는 공연입니다.'
      loading.value = false
      return current.value
    }

    try {
      const c = unwrap(await courseApi.getById(id))
      current.value = c && typeof c === 'object' ? c : null
      if (!current.value) error.value = '존재하지 않는 공연입니다.'
    } catch (e) {
      console.error('[course] 상세 조회 실패:', e)
      // 백엔드는 없는 id에 404가 아니라 400 + "강의를 찾을 수 없습니다"로 답한다
      if (e.response?.status === 401) {
        current.value = findShowcase(id)
        isShowcase.value = Boolean(current.value)
        if (!current.value) error.value = '존재하지 않는 공연입니다.'
        return
      }
      const notFound = e.response?.status === 404 ||
        (e.response?.status === 400 && /찾을 수 없|존재하지 않/.test(e.response?.data?.message || ''))
      error.value = notFound
        ? '존재하지 않는 공연입니다.'
        : message(e, '공연 정보를 불러오지 못했습니다.')
    } finally {
      loading.value = false
    }
  }

  async function create(payload) {
    const res = await courseApi.create(payload)
    const created = unwrap(res)
    if (created && typeof created === 'object') courses.value.unshift(created)
    return created
  }

  function setGenre(code) {
    genre.value = code
  }

  return {
    courses, current, loading, error, isShowcase, genre, visible, ranked,
    fetchCourses, fetchCourse, create, setGenre, genreLabel
  }
})

function message(e, fallback) {
  return e.response?.data?.message || fallback
}
