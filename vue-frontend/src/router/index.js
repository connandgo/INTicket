import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/store/auth.js'

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
    component: () => import('@/views/CourseListView.vue'),
    meta: { requiresAuth: true }
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
    component: () => import('@/views/CourseDetailView.vue'),
    meta: { requiresAuth: true }
  },
  {
    // UI-005 내 예매
    path: '/enrollments',
    name: 'Enrollment',
    component: () => import('@/views/EnrollmentView.vue'),
    meta: { requiresAuth: true }
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
  if (to.meta.requiresAuth && !auth.isAuthenticated) return { name: 'Login' }
  if (to.meta.guestOnly && auth.isAuthenticated) return { name: 'CourseList' }
  if (to.meta.plannerOnly && auth.user?.role !== 'INSTRUCTOR') return { name: 'CourseList' }
})

export default router
