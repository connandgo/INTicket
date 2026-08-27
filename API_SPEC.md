# 공연 예매 플랫폼 API 명세서 (백엔드 → 프론트엔드)

모든 요청은 반드시 **API Gateway(`http://localhost:8080`)** 를 거쳐야 합니다.
서비스 포트(8081~8085)로 직접 호출하면 인증 정책이 다르게 적용되어 CORS 오류가 나거나
실제 배포 환경과 다르게 동작합니다.

내부 필드명(`course`, `enrollment`, `courseId` 등)은 명세서(`MSA_코드최소변경_공연예매MVP기능명세서.md`)의
"최소 변경" 원칙에 따라 원본 그대로 유지됩니다. 화면 표시(장르 라벨 등)는 프론트엔드
(`vue-frontend/src/domain/genre.js`)에서 매핑합니다.

---

## 인증

OAuth2 Authorization Code 방식입니다. (`vue-frontend/src/api/auth.js` 참고)

1. 브라우저를 `/oauth2/authorize?response_type=code&client_id=web-client&redirect_uri=...&scope=openid` 로 이동
2. 로그인 후 `redirect_uri`로 `?code=...` 와 함께 리다이렉트됨
3. 그 code를 `POST /oauth2/token` 으로 교환 (`Authorization: Basic base64(client_id:client_secret)`)
4. 응답의 `access_token`을 이후 모든 요청에 `Authorization: Bearer {token}` 헤더로 포함

JWT payload에 `role`(`STUDENT`/`INSTRUCTOR`), `user_id`, `email`, `name` 포함됨.
Gateway가 이를 검증 후 `X-User-Id`, `X-User-Email`, `X-User-Role` 헤더로 하위 서비스에 전달함.

인증 불필요(공개 경로): `/api/users/register`, `/oauth2/**`, `/login`

---

## 공통 응답 포맷

Java 서비스(user/course/enrollment/payment)는 공통 래퍼를 씀:

```json
{ "success": true, "message": "성공", "data": { ... } }
{ "success": false, "message": "에러 메시지", "data": null }
```

recommend-service(FastAPI)는 래퍼 없이 바로 객체 반환.

---

## 1. 회원 (user-service)

### POST /api/users/register — 회원가입 (관람객/공연기획사)
인증 불필요.

Request
```json
{ "email": "organizer1@test.com", "password": "testpass123", "name": "Organizer1", "role": "INSTRUCTOR" }
```
`role`은 `"STUDENT"`(관람객) 또는 `"INSTRUCTOR"`(공연기획사).

Response (201)
```json
{ "success": true, "message": "성공", "data": {
  "id": 3, "email": "organizer1@test.com", "name": "Organizer1",
  "role": "INSTRUCTOR", "createdAt": "2026-08-26T15:17:56.138701" } }
```

### GET /api/users/me — 내 정보 조회
인증 필요.

Response (200)
```json
{ "success": true, "message": "성공", "data": {
  "id": 3, "email": "organizer1@test.com", "name": "Organizer1",
  "role": "INSTRUCTOR", "createdAt": "2026-08-26T15:17:56.138701" } }
```

---

## 2. 공연 (course-service)

### POST /api/courses — 공연 등록
INSTRUCTOR만 가능. STUDENT 시도 시 **403**.

Request
```json
{ "title": "TestConcert", "description": "desc", "category": "BACKEND", "price": 55000 }
```
`category`는 원본 enum 값 그대로 전송: `BACKEND | FRONTEND | DEVOPS | DATA_SCIENCE | MOBILE | SECURITY | DATABASE | OTHER`
(화면에는 `genre.js`가 `BACKEND→뮤지컬, FRONTEND→연극, DEVOPS→콘서트, DATA_SCIENCE→클래식`으로 매핑, 나머지는 "기타")

Response (201)
```json
{ "success": true, "message": "성공", "data": {
  "id": 1, "title": "TestConcert", "description": "desc", "category": "BACKEND",
  "price": 55000, "instructorId": 3, "enrollmentCount": 0, "status": "ACTIVE",
  "createdAt": "2026-08-26T15:18:59.448254" } }
```

STUDENT가 시도한 경우 (403)
```json
{ "success": false, "message": "강의 등록은 INSTRUCTOR만 가능합니다", "data": null }
```

### GET /api/courses — 공연 목록 (ACTIVE만 반환)
인증 필요.

Response (200)
```json
{ "success": true, "message": "성공", "data": [
  { "id": 1, "title": "TestConcert", "category": "BACKEND", "price": 55000.00,
    "instructorId": 3, "enrollmentCount": 1, "status": "ACTIVE", ... }
] }
```

### GET /api/courses/{id} — 공연 상세
존재하지 않는 id → 400
```json
{ "success": false, "message": "강의를 찾을 수 없습니다: 9999", "data": null }
```

### GET /api/courses/category/{category} — 장르별 공연 목록
경로 예: `/api/courses/category/BACKEND`. 응답 형식은 목록 조회와 동일.

---

## 3. 예매 (enrollment-service)

### POST /api/enrollments — 예매 신청
인증 필요(관람객). 내부적으로 결제 요청까지 자동 실행됨(별도 결제 화면 없음).

Request
```json
{ "courseId": 1 }
```

Response (201) — 응답은 `PENDING`이지만 결제가 워낙 빨리 끝나서(모의 결제) DB는 이미 `ACTIVE`일 수 있음.
화면은 "결제 처리 중" → 목록 재조회 → "예매 확정" 흐름을 권장.
```json
{ "success": true, "message": "성공", "data": {
  "id": 1, "userId": 4, "courseId": 1, "status": "PENDING",
  "createdAt": "2026-08-26T15:19:14.75357518", "course": null } }
```

이미 예매한 공연 재요청 (400)
```json
{ "success": false, "message": "이미 수강신청한 강의입니다", "data": null }
```

존재하지 않는 공연 (400)
```json
{ "success": false, "message": "존재하지 않는 강의입니다: 9999", "data": null }
```

### GET /api/enrollments/my — 내 예매 목록
본인 것만 반환됨(다른 사용자 예매 안 보임, 검증됨).

Response (200)
```json
{ "success": true, "message": "성공", "data": [
  { "id": 1, "userId": 4, "courseId": 1, "status": "ACTIVE",
    "createdAt": "2026-08-26T15:19:14.753575",
    "course": {
      "id": 1, "title": "TestConcert", "description": "desc", "category": "BACKEND",
      "price": 55000, "thumbnail": null, "instructorName": null, "enrollmentCount": 1
    } } ] }
```
`status`: `PENDING`(결제 처리 중) → `ACTIVE`(예매 확정) → `CANCELLED`(취소)
`course.category`는 위와 동일하게 원본 enum 값. `course.instructorName`, `course.thumbnail`은 항상 `null` —
백엔드에 해당 데이터가 없으므로 화면에서 표시하지 말 것.

### DELETE /api/enrollments/{id} — 예매 취소
인증 필요. 본인 예매만 취소 가능. 취소하면 결제도 같이 취소 처리됨(모의 결제라 실제
환불 없이 상태만 바뀜), 확정(ACTIVE) 상태였던 예매면 공연의 누적 예매 수도 같이 줄어듦.

Response (200)
```json
{ "success": true, "message": "성공", "data": null }
```

본인 소유가 아닌 예매를 취소하려는 경우 (403)
```json
{ "success": false, "message": "본인의 예매만 취소할 수 있습니다", "data": null }
```

이미 취소된 예매를 다시 취소하려는 경우 (400)
```json
{ "success": false, "message": "이미 취소된 예매입니다", "data": null }
```

존재하지 않는 예매 (400)
```json
{ "success": false, "message": "예매 정보를 찾을 수 없습니다: 9999", "data": null }
```

---

## 4. 결제 (payment-service)

프론트에서 직접 호출할 일 없음(enrollment-service가 내부적으로 호출). 결제 내역 조회만 필요시 사용.

### GET /api/payments/user/{userId} — 결제 내역

Response (200)
```json
{ "success": true, "message": "성공", "data": [
  { "paymentId": 1, "userId": 4, "courseId": 1, "amount": 55000.00,
    "status": "COMPLETED", "transactionId": "b22493d1-...", "createdAt": "..." } ] }
```
`status`에 이제 `CANCELLED`도 나올 수 있음 — 예매를 취소하면 그 예매에 연결된 결제도
같이 `CANCELLED`로 바뀜(`DELETE /api/enrollments/{id}` 참고).

---

## 5. 추천 (recommend-service)

### GET /api/recommend/{userId} — 추천 공연 목록
래퍼 없음(FastAPI 직접 반환).

예매 이력 있는 사용자 (같은 장르 미예매 공연을 인기순으로)
```json
{ "userId": 4,
  "recommendedCourses": [ { "id": 2, "title": "TestConcert2", "category": "BACKEND", ... } ],
  "basedOnCategory": "BACKEND",
  "message": "BACKEND 장르 기반 추천 공연입니다" }
```

신규 사용자(예매 이력 없음, 전체 인기순)
```json
{ "userId": 5,
  "recommendedCourses": [ { "id": 1, "enrollmentCount": 1, ... }, { "id": 2, "enrollmentCount": 0, ... } ],
  "basedOnCategory": null,
  "message": "인기 공연 추천입니다" }
```

recommend-service가 죽어있어도 공연 조회·예매·결제는 정상 동작함(독립적으로 장애 격리됨).

---

## 자주 겪을 수 있는 문제

- **CORS 오류** → 서비스 포트(8081~8085) 직접 호출했을 가능성. 반드시 `:8080`(Gateway)으로 호출
- **401** → 토큰 없음/만료. 재로그인 필요
- **403** (공연 등록 시) → STUDENT 계정으로 등록 시도. INSTRUCTOR 계정 필요
- **카테고리 값이 이상하게 보임** → `category`는 항상 영문 원본 enum. 화면 라벨은 `genre.js`에서 매핑, 백엔드가 번역해서 주지 않음
