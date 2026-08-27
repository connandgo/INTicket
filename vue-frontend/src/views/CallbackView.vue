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
    router.replace({ name: 'Login', query: { error: '로그인이 취소되었거나 인증에 실패했습니다.' } })
    return
  }

  if (!code) {
    console.error('OAuth callback error: code 파라미터가 없습니다.')
    message.value = '잘못된 로그인 요청입니다.'
    router.replace({ name: 'Login', query: { error: '로그인 응답에 인증 코드가 없습니다.' } })
    return
  }

  try {
    await auth.handleCallback(code)
    message.value = '로그인 완료. 이동합니다'
    router.replace(auth.consumeRedirect())
  } catch (err) {
    console.error('OAuth callback 처리 실패:', err)
    message.value = '로그인 처리에 실패했습니다.'
    router.replace({ name: 'Login', query: { error: '로그인 처리에 실패했습니다. 다시 시도해 주세요.' } })
  }
})
</script>

<style scoped>
.page { min-height: 100vh; display: grid; place-items: center; }
.box { display: flex; flex-direction: column; align-items: center; gap: 16px; }
.mark-sq {
  width: 30px; height: 30px; display: grid; place-items: center;
  background: var(--red); color: #fff;
  font-family: var(--num); font-size: 11px; font-weight: 700;
  border-radius: var(--r);
}
.msg { font-size: 13.5px; color: var(--t3); }
</style>
