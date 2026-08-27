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
    // host: 'localhost' 로 두면 환경에 따라 IPv6(::1)에만 물려서
    // 브라우저가 127.0.0.1 로 접속할 때 연결이 거부된다.
    // true(=0.0.0.0)로 두면 IPv4·IPv6 양쪽에서 다 들어온다.
    host: true,
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
      }
      // /login, /logout, /userinfo 는 프록시하지 않는다.
      // /login 은 이 앱의 라우트라서, 프록시를 걸면 주소창에 직접 치거나
      // 새로고침했을 때 SPA 대신 백엔드로 넘어가 Whitelabel 404가 뜬다.
      // OAuth 로그인 화면은 VITE_AUTH_SERVER_URL(:8080)로 직접 이동하므로
      // 이 포트에서 /login 을 넘겨줄 필요가 없다.
    }
  }
})