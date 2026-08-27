import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { courseApi } from '@/api/course.js'
import { genreLabel } from '@/domain/genre.js'

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
  // 실서버는 공연 목록에도 인증을 요구한다(게이트웨이 정책).
  // 로그인 안내와 진짜 장애를 화면에서 구분하려고 따로 둔다.
  const needsLogin = ref(false)

  const genre = ref('ALL')

  const visible = computed(() =>
    genre.value === 'ALL' ? courses.value : courses.value.filter((c) => c.category === genre.value)
  )

  // 인기순 — 누적 예매 수 기준. 목록 상단 랭킹에 쓴다.
  const ranked = computed(() =>
    [...courses.value].sort((a, b) => (b.enrollmentCount || 0) - (a.enrollmentCount || 0))
  )

  async function fetchCourses({ force = false } = {}) {
    if (!force && courses.value.length) return courses.value
    if (listRequest) return listRequest

    loading.value = true
    error.value = null
    needsLogin.value = false
    listRequest = (async () => {
      try {
        const list = unwrap(await courseApi.getAll())
        courses.value = Array.isArray(list) ? list : []
        return courses.value
      } catch (e) {
        console.error('[course] 목록 조회 실패:', e)
        if (e.response?.status === 401) needsLogin.value = true
        else error.value = message(e, '공연 목록을 불러오지 못했습니다.')
        courses.value = []
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
    needsLogin.value = false
    current.value = null
    try {
      const c = unwrap(await courseApi.getById(id))
      current.value = c && typeof c === 'object' ? c : null
      if (!current.value) error.value = '존재하지 않는 공연입니다.'
    } catch (e) {
      console.error('[course] 상세 조회 실패:', e)
      // 백엔드는 없는 id에 404가 아니라 400 + "강의를 찾을 수 없습니다"로 답한다
      if (e.response?.status === 401) { needsLogin.value = true; return }
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
    courses, current, loading, error, needsLogin, genre, visible, ranked,
    fetchCourses, fetchCourse, create, setGenre, genreLabel
  }
})

function message(e, fallback) {
  return e.response?.data?.message || fallback
}
