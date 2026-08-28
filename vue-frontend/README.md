# INTicket — 공연 예매 플랫폼 프론트엔드

공연 기획사와 관람객을 연결하는 B2B2C 티켓 예매 서비스의 화면입니다.
Vue 3 + Pinia + Vite 로 만들었고, API Gateway(`:8080`)를 통해 백엔드 서비스와 통신합니다.

판교캠퍼스 6반 4조 · Agile 방법론 및 MSA 개발

---

## 실행

```bash
npm install
npm run dev
```

브라우저에서 http://localhost:3000 을 엽니다.

**백엔드가 없어도 그대로 실행됩니다.** 서버에 닿지 못하면 내장 데이터로 자동 전환되어
공연 조회부터 예매·결제·취소표 매칭까지 전부 동작합니다. 전환은 첫 API 호출이
실패하는 순간 한 번만 일어나고, 이후에는 네트워크로 나가지 않습니다.

내장 데이터로 도는 동안 쓸 수 있는 계정입니다.

| 역할 | 이메일 | 비밀번호 |
| --- | --- | --- |
| 관람객 | `viewer@demo.com` | `inticket1234` |
| 공연기획사 | `promoter@demo.com` | `inticket1234` |

회원가입도 됩니다. 가입할 때 정한 비밀번호로 바로 로그인됩니다.

백엔드를 함께 띄우려면 프로젝트 루트에서 `docker compose up -d` 를 실행한 뒤
이 화면을 새로고침하면 됩니다. 그때는 실제 로그인(OAuth2)과 실제 DB 를 씁니다.

---

## 무엇이 실제 API 이고 무엇이 화면 처리인가

프로젝트 명세가 **신규 테이블·신규 API 없이** 기존 계약(`/api/courses`,
`/api/enrollments`)만으로 MVP 를 구현하도록 요구합니다. 그래서 백엔드에 없는
개념(회차·좌석 재고·선점)은 화면에서 처리합니다.

### 실제 백엔드가 처리하는 것

| 기능 | 서비스 | 엔드포인트 |
| --- | --- | --- |
| 로그인 · JWT | auth-server `:9000` | OAuth2 Authorization Code |
| 공연 목록 · 상세 · 등록 | course-service `:8082` | `GET/POST /api/courses` |
| 매진 판정 | enrollment-service `:8083` | `enrollmentCount >= capacity` 검증 |
| 예매 생성 | enrollment-service `:8083` | `POST /api/enrollments` |
| 결제 | payment-service `:8084` | Kafka `payment.completed` 발행 |
| 예매 확정 | enrollment-service `:8083` | 위 이벤트를 받아 `PENDING → ACTIVE` |
| 취소표 대기 · 조건 파싱(LLM) | recommend-service `:8085` | `POST /api/recommend/waitlists` |
| 취소표 매칭 · 좌석 배정 | recommend-service `:8085` | `GET /api/recommend/offers/my` |
| 수요 분석 | recommend-service `:8085` | `GET /api/recommend/forecast/{id}` |

취소표 매칭이 돌려주는 좌석 번호(`S-Q-5` 등)는 **서버가 정합니다.**
화면은 조건을 보내고 결과를 받아 표시할 뿐입니다.

### 화면에서 처리하는 것

| 기능 | 이유 |
| --- | --- |
| 회차 (날짜·시간) | 회차 테이블이 없음 |
| 등급별 잔여 좌석 | 좌석 재고 API 가 없음 |
| 좌석 배치도 | 위와 같음 |
| 10분 선점 타이머 | 선점 API 가 없음 |

이 값들은 `src/mock/inventory.js` 가 브라우저 저장소에 들고 있습니다.
다만 **잔여 수량의 총합은 백엔드가 주는 정원·예매수에 맞춥니다.** 목록에서
"2석 남음"인 공연은 상세 화면에서도, 수요 분석에서도 2석입니다.

좌석 배치도의 등급·열 구성은 recommend-service 의 `app/data/seats.py` 와 같은
값을 씁니다(`src/data/seatLayout.js`). 그래야 서버가 배정한 좌석이 배치도에
실제로 존재합니다.

이 한계는 이슈로 등록되어 있습니다 — *[BE] 회차·좌석등급 재고 API가 없어
프론트가 목업으로 돌고 있음*. 백엔드에 API 가 생기면
`src/config/features.js` 의 플래그만 켜면 되고, 화면 코드는 그대로 둡니다.

---

## 구조

```
src/
├── api/            백엔드 호출. 화면은 여기만 부른다
│   ├── index.js        axios 인스턴스, 인증 헤더, 오프라인 전환
│   ├── course.js       공연
│   ├── booking.js      예매 · 선점 · 결제
│   ├── seatWish.js     취소표 대기 · 매칭
│   ├── forecast.js     수요 분석
│   └── performance.js  회차 · 좌석
├── views/          화면
├── components/     공용 UI (좌석 배치도, 포스터, 차트 …)
├── store/          Pinia (auth, course, enrollment, waitlist)
├── domain/         도메인 규칙 (매진 판정, 장르 라벨)
├── lib/            조건 파서, 수요 모델
├── data/           좌석 배치도, 내장 공연 카탈로그
└── mock/           백엔드가 없을 때 응답을 만든다
```

**화면은 `mock/` 을 직접 부르지 않습니다.** 언제나 `api/*.js` 를 거치고,
그 안에서 실제 API 를 쓸지 내장 데이터를 쓸지 정합니다. 백엔드가 붙으면
화면 코드는 한 줄도 고치지 않습니다.

---

## 주요 화면

| 경로 | 내용 |
| --- | --- |
| `/` | 공연 둘러보기 |
| `/courses` | 공연 목록 (장르 · 정렬 · 매진 표시) |
| `/courses/:id` | 공연 상세 · 회차별 예매 · 취소표 매칭 |
| `/courses/:id/booking` | 등급 · 매수 선택 → 선점 → 결제 |
| `/courses/:id/seat-wish` | 자연어로 좌석 조건 등록 |
| `/courses/:id/insights` | 수요 분석 (공연기획사 전용) |
| `/enrollments` | 내 예매 · 취소표 대기 현황 |

### 취소표 매칭

매진된 회차에서 원하는 자리를 문장으로 적으면, 서버가 조건을 해석해 대기자로
등록합니다. 취소가 발생하면 조건에 맞는 대기자에게 좌석이 배정되고, 배정된
좌석은 등급을 다시 고르는 단계 없이 곧바로 결제로 이어집니다.

```
"둘이서 A석으로 붙어 앉고 싶어요"
  → A등급 K열 1번, 2번 배정
  → 결제 136,000원
```

다른 대기자에게 나간 배정은 화면에 표시하지 않습니다. 내 좌석은 언제나
`GET /api/recommend/offers/my` 로 다시 받아 옵니다.

### 수요 분석

공연기획사 계정으로 자신이 등록한 공연의 유효 초과수요, 추가 회차 예상
판매율, 수요 모멘텀을 봅니다. 자리가 남은 공연에는 추가 회차를 추천하지
않습니다.

---

## 환경 변수

`.env` 에 들어 있는 값입니다. 로컬 주소와 데모용 OAuth 클라이언트 값이라
그대로 두면 됩니다.

```
VITE_API_BASE_URL=http://localhost:8080
VITE_AUTH_SERVER_URL=http://localhost:8080
VITE_CLIENT_ID=web-client
VITE_CLIENT_SECRET=web-secret
VITE_REDIRECT_URI=http://localhost:3000/callback
```

---

## 알아두면 좋은 것

- 브라우저 저장소를 쓰므로 다른 브라우저·시크릿 창에서는 예매 내역이 보이지
  않습니다. 백엔드를 붙이면 서버 데이터를 씁니다.
- 취소표 조건 해석은 서버의 LLM 이 합니다. 호출이 실패하면 서버가 규칙 기반
  으로 폴백하고, 백엔드가 아예 없으면 화면의 `lib/wishParser.js` 가 대신
  읽습니다. 어느 경우든 등급·매수·연석·가격은 같게 나옵니다.
- `npm run build` 로 정적 파일을 만들 수 있습니다. `Dockerfile` 과
  `nginx.conf` 는 컨테이너 배포용입니다.
