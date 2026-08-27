# B2B AI 수요 분석 구현 점검

점검일: 2026-08-27

## 제공 API

- `GET /api/recommend/forecast/{courseId}`
- `POST /api/recommend/forecast/{courseId}/simulate`

두 API 모두 Bearer 토큰 인증을 사용한다. `forecast_router`는 기존
`/api/recommend/{user_id}` 보다 먼저 등록되어 경로 충돌이 없다.

## 계산 원칙

- 대기자 수, 요청 좌석, 유효수요, 증가율, 차트, 회차별 예상 관객은 코드가 계산한다.
- LLM은 대기자별 구매 전환 가능성, 인사이트 3개, 권고 문장만 생성한다.
- LLM이 비활성화되거나 실패하면 전환확률 `0.5`와 템플릿 문구로 응답한다.
- `aiEnabled`는 모든 LLM 단계가 성공했을 때만 `true`다.

## 프론트 계약

현재 `DemandInsightView`가 소비하는 `target`, `excessDemand`, `extraShow`,
`momentum`, `trend`, `candidates`, `insights`, `recommendation` 필드를 반환한다.
기존 프론트의 임시 계산기가 실제 응답을 받으면 자동으로 대체된다.

## 시드 및 폴백 검증

courseId `1`에 B2C 대기자 시드를 확장해 다음 데이터를 만들었다.

- 대기자: 85명
- 총 요청 좌석: 131석
- LLM 비활성 전환확률(0.5) 기준 유효수요: 66석
- 추천 회차: 토요일 19:00
- 추천 회차 예상 관객: 33 / 520석 (6.35%)

Docker에서 외부 네트워크를 차단하고 아래를 확인했다.

- `GET /forecast/1`: 200, 프론트 필수 필드 및 인사이트 3개 반환
- `POST /forecast/1/simulate`: 200, `2026-09-22 19:00 / 1000석`에서 16명 반환
- `GET /forecast/999`: 404 반환
- 기존 B2C 단건 릴리즈 `S-Q-5`: 기존과 동일하게 `userId=3` 선택
