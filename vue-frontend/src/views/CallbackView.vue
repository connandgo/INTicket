<template>
  <div class="page">
    <div class="box">
      <span class="mark-sq">IN</span>
      <span class="spin"></span>
      <p class="msg">{{ message }}</p>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/store/auth.js'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const message = ref('로그인 처리 중입니다')
const processing = ref(false)

onMounted(async () => {
  if (processing.value) return
  processing.value = true

  const code = route.query.code
  const error = route.query.error

  if (error) {
    console.error('OAuth callback error:', error, route.query.error_description)
    message.value = '로그인에 실패했습니다.'
    router.replace('/login')
    return
  }

  if (!code) {
    console.error('OAuth callback error: code 파라미터가 없습니다.')
    message.value = '잘못된 로그인 요청입니다.'
    router.replace('/login')
    return
  }

  try {
    await auth.handleCallback(code)
    message.value = '로그인 완료. 이동합니다'
    router.replace('/courses')
  } catch (err) {
    console.error('OAuth callback 처리 실패:', err)
    message.value = '로그인 처리에 실패했습니다.'
    router.replace('/login')
  }
})
</script>

<style scoped>
.page { min-height: 100vh; display: grid; place-items: center; }
.box { display: flex; flex-direction: column; align-items: center; gap: 16px; }
.mark-sq {
  width: 30px; height: 30px; display: grid; place-items: center;
  background: var(--red); color: #fff;
  font-family: var(--mono); font-size: 11px; font-weight: 700;
  border-radius: var(--r);
}
.msg { font-size: 13.5px; color: var(--t3); }
</style>
