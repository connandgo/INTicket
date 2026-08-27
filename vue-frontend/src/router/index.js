import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/store/auth.js'
import { DEMO } from '@/config/features.js'

// 명세서 9 — 최소 변경 원칙상 물리 route(/courses, /enrollments)는 그대로 두고
// 화면 이름과 문구만 공연 도메인으로 바꾼다.
const routes = [
  { path: '/', name: 'Landing', component: () => import('@/views/LandingView.vue') },
  { path: '/login', name: 'Login', component: () => import('@/views/LoginView.vue'), meta: { guestOnly: true } },
  { path: '/callback', name: 'Callback', component: () => import('@/views/CallbackView.vue') },

  {
    // UI-002 공연 목록
    path: '/courses',
    name: 'CourseList',
    component: () => import('@/views/CourseListView.vue')
    // 로그인 없이 둘러볼 수 있다. 예매할 때만 로그인을 요구한다.
  },
  {
    // UI-003 공연 등록 — 공연기획사(INSTRUCTOR)만
    path: '/courses/new',
    name: 'CourseCreate',
    component: () => import('@/views/CourseCreateView.vue'),
    meta: { requiresAuth: true, plannerOnly: true }
  },
  {
    // UI-004 공연 상세
    path: '/courses/:id(\\d+)',
    name: 'CourseDetail',
    component: () => import('@/views/CourseDetailView.vue')
  },
  {
    // 좌석등급 선택 · 선점 · 결제
    path: '/courses/:id(\\d+)/booking',
    name: 'Booking',
    component: () => import('@/views/BookingView.vue'),
    meta: { requiresAuth: true, viewerOnly: true }
  },
  {
    // UI-005 내 예매
    path: '/enrollments',
    name: 'Enrollment',
    component: () => import('@/views/EnrollmentView.vue'),
    meta: { requiresAuth: true, viewerOnly: true }
  },
  {
    // 자연어 기반 AI 취소표 대기
    path: '/courses/:id(\\d+)/seat-wish',
    name: 'SeatWish',
    component: () => import('@/views/SeatWishView.vue'),
    meta: { requiresAuth: true, viewerOnly: true }
  },
  {
    // 공연기획사 AI 수요 분석
    path: '/courses/:id(\\d+)/insights',
    name: 'DemandInsight',
    component: () => import('@/views/DemandInsightView.vue'),
    meta: { requiresAuth: true, plannerOnly: true }
  },
  {
    // UI-006 / UI-007 마이페이지
    path: '/mypage',
    name: 'MyPage',
    component: () => import('@/views/MyPageView.vue'),
    meta: { requiresAuth: true }
  },

  { path: '/:pathMatch(.*)*', redirect: '/' }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 })
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'Login', query: { redirect: to.fullPath } }
  }
  // 데모 모드에서는 로그인한 뒤에도 /login 에 들어갈 수 있어야 한다.
  // 계정을 바꿔 가며 관람객/기획사 화면을 둘 다 봐야 하기 때문.
  if (to.meta.guestOnly && auth.isAuthenticated && !DEMO) return { name: 'CourseList' }
  if (to.meta.plannerOnly && auth.user?.role !== 'INSTRUCTOR') return { name: 'CourseList' }
  if (to.meta.viewerOnly && auth.user?.role === 'INSTRUCTOR') return { name: 'CourseList' }
})

export default router
