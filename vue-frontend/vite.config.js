import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  server: {
    host: 'localhost',
    port: 3000,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false
      },
      '/oauth2': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false
      },
      // 인증 서버 로그아웃을 같은 출처로 부르기 위한 통로.
      // 로그아웃하려고 브라우저를 :8080 으로 보내면 인증 서버 로그인 페이지에
      // 사용자가 남겨진다. 이 경로로 조용히 호출하고 화면은 우리 앱에 머문다.
      // (쿠키는 포트를 구분하지 않아 :8080 이 심은 세션 쿠키가 함께 전달된다)
      '/auth-logout': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
        rewrite: (p) => p.replace(/^\/auth-logout/, '/logout')
      }
      // /login, /logout, /userinfo 는 프록시하지 않는다.
      // /login 은 이 앱의 라우트라서, 프록시를 걸면 주소창에 직접 치거나
      // 새로고침했을 때 SPA 대신 백엔드로 넘어가 Whitelabel 404가 뜬다.
      // OAuth 로그인 화면은 VITE_AUTH_SERVER_URL(:8080)로 직접 이동하므로
      // 이 포트에서 /login 을 넘겨줄 필요가 없다.
    }
  }
})