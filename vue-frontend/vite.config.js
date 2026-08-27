import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    vue(),
    // 인증 서버 세션 쿠키를 지우는 개발용 엔드포인트.
    //
    // JSESSIONID 는 HttpOnly 라 브라우저 JS 로는 못 지운다. 하지만 Domain 없이
    // host(localhost)에 심긴 쿠키라 포트가 달라도 이 서버로 함께 전송되고,
    // 이 서버가 만료 헤더를 내려주면 브라우저가 삭제한다.
    //
    // 인증 서버 로그아웃이 세션을 확실히 끊어 주지 않는 상황을 우회하기 위한 것이다.
    // 게이트웨이에 /connect/** 라우트가 추가되면 필요 없어진다(노션 이슈 등록됨).
    {
      name: 'inticket-kill-session',
      configureServer(server) {
        server.middlewares.use('/kill-session', (req, res) => {
          res.setHeader('Set-Cookie', [
            'JSESSIONID=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax',
            'JSESSIONID=; Path=/; Max-Age=0; SameSite=Lax'
          ])
          res.setHeader('Cache-Control', 'no-store')
          res.setHeader('Content-Type', 'application/json')
          // 지우기 직전에 브라우저가 들고 있던 쿠키를 되돌려 준다.
          // HttpOnly 라 JS 로는 볼 수 없어서, 삭제가 먹었는지 확인할 유일한 방법이다.
          res.end(JSON.stringify({ ok: true, hadCookie: req.headers.cookie || null }))
        })
      }
    }
  ],
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