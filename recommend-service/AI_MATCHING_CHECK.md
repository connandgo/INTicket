# B2C AI 취소표 매칭 서비스 점검 정리

점검일: 2026-08-27

## 1. 현재 구현 요약

`recommend-service`에 B2C 취소표 대기/매칭 기능이 1차 구현되어 있다.

- 대기자가 자연어 조건을 등록하면 LLM이 `required`, `preferred`, `flexible`로 파싱한다.
- 좌석 연속성, 가격, 등급, 열, 분리 배정 가능 여부는 코드가 규칙 기반으로 계산한다.
- 취소표가 나오면 단건/대량 국면으로 나누어 매칭한다.
- 선정된 대기자에게 `OfferItem` 형태의 좌석 제안을 만든다.
- 상태 저장은 DB가 아니라 `waitlist_store.py`의 인메모리 저장소를 사용한다.

## 2. API 응답 구조

### 대기 등록

`POST /api/recommend/waitlists`

요청:

```json
{
  "courseId": 1,
  "conditionText": "S등급이면 좋겠고 10만원 정도 생각하고 있어요."
}
```

응답:

```json
{
  "waitlistId": 6,
  "seq": 6,
  "parsed": {
    "required": { "count": 1 },
    "preferred": { "grade": ["S"], "max_price": 100000 },
    "flexible": { "price_ceiling": 110000 }
  }
}
```

### 취소표 릴리즈

`POST /api/recommend/internal/released`

요청:

```json
{
  "courseId": 1,
  "seats": ["S-Q-5"],
  "reason": "SINGLE"
}
```

응답 형태:

```json
{
  "matched": 1,
  "offers": [
    {
      "offerId": "of_1",
      "userId": 3,
      "courseId": 1,
      "seats": ["S-Q-5"],
      "seatsText": "S등급 Q열 5번(S-Q-5, 102,000원)",
      "expiresAt": 1787805405.9063191,
      "status": "PENDING"
    }
  ],
  "reason": "선정 이유",
  "mode": "SINGLE",
  "debug": []
}
```

### 제안 수락

`POST /api/recommend/offers/{offer_id}/accept`

응답:

```json
{
  "success": true,
  "message": "예매가 확정되었습니다"
}
```

## 3. LLM 호출별 응답

현재 LLM 호출은 `app/service/ai_matching_service.py`에 모여 있다.

### 3.1 조건 파싱

함수: `parse_condition(text)`

LLM 기대 응답:

```json
{
  "required": {
    "count": 1
  },
  "preferred": {
    "grade": ["S"],
    "max_price": 100000
  },
  "flexible": {
    "price_ceiling": 110000
  }
}
```

후처리:

- markdown 코드펜스 제거
- JSON 외 앞뒤 잡문 제거
- 허용 키만 유지
- 등급은 `VIP`, `R`, `S`, `A`만 허용
- 열은 좌석 배치도에 있는 값만 허용
- 등급/열 조합이 불가능하면 열 조건 제거
- 인원 언급이 없으면 `required.count = 1`

LLM 실패 시 폴백:

```json
{
  "required": { "count": 1 },
  "preferred": {},
  "flexible": {}
}
```

### 3.2 단건 수락가능성 평가

함수: `estimate_acceptance(seats, waiters)`

LLM 기대 응답:

```json
{
  "results": [
    {
      "user_id": 3,
      "score": 0.8,
      "reason": "S등급 선호와 맞고 원문이 유연해 수락 가능성이 높습니다."
    }
  ]
}
```

코드 처리:

- 이미 필수 조건을 통과한 대기자만 LLM에 전달한다.
- LLM은 가부 판정이 아니라 0~1 수락가능성만 평가한다.
- 최종 단건 점수는 `수락가능성 * 0.6 + 순번가점 * 0.4`이다.
- 동점이면 순번이 빠른 대기자를 우선한다.

LLM 실패 시 폴백:

```json
{
  "user_id": {
    "score": 0.5
  }
}
```

이 경우 모든 후보의 수락가능성이 같아져 사실상 순번가점 중심으로 결정된다.

### 3.3 제안 메시지

함수: `compose_offer_message(seats, waiter)`

MVP 프론트에는 AI 설명문이 필요하지 않으므로 LLM을 호출하지 않는다.
안내 문구는 프론트가 직접 표시하고, `OfferItem`에는 좌석·제안 ID·만료 시각·상태만 포함한다.

프론트 표시 예시: `취소표가 매칭되었습니다. S등급 Q열 5번`

### 3.4 대량 배분안 선택

함수: `decide_batch_plan(plans, waiters)`

MVP 프론트에는 AI 설명문이 필요하지 않으므로 LLM을 호출하지 않는다.
대량 배분 후보는 이미 코드에서 다음 기준으로 정렬되어 있고, 최종 선택은 `plans[0]`이다.

- 배분 후보는 코드가 먼저 생성하고 정렬한다.
- 1순위: 만족 인원 최대
- 2순위: 순번합 최소
- 3순위: 탐색 결과 순서

배분 이유와 디버그 정보는 내부 확인용이며 프론트 화면에는 표시하지 않는다.

## 4. 실제 검증 결과

두 가지 경로를 확인했다.

- 폴백 검증: Docker 컨테이너에서 `LLM_ENABLED=false`, `--network none`으로 외부 네트워크를 차단하고 실행
- 실제 LLM 검증: 사용자가 승인한 뒤 `recommend-service/.env`의 LLM 설정으로 조건 파싱/단건 수락가능성 호출 실행

현재 구조에서는 AI 설명문 생성과 대량 배분안 선택에 LLM을 쓰지 않는다.

### 4.0 기능 테스트 종합 결과

Docker 컨테이너 안에서 FastAPI `TestClient`와 실제 서비스 함수를 호출해 기능 테스트를 수행했다.
LLM 외부 호출에 따른 흔들림을 제거하기 위해 `LLM_ENABLED=false`, `--network none`으로 실행했다.

결과:

```text
총 16개 테스트 실행
통과 16개
실패 0개
```

테스트 범위:

| 구분 | 테스트 | 결과 |
|---|---|---|
| 좌석 데이터 | `S-Q-5` 좌석 정보 조회 | PASS |
| 좌석 데이터 | `S-P-1`, `S-P-2`, `S-P-3` 연석 판정 | PASS |
| 좌석 데이터 | `S-P-1`, `S-P-4` 최대 간격 3 계산 | PASS |
| 시드/API | `POST /api/recommend/internal/reset` 대기자 15명 주입 | PASS |
| 시드/API | `GET /api/recommend/internal/waitlists/1` 콘서트 대기자 10명 조회 | PASS |
| 단건 매칭 | `S-Q-5` 릴리즈 시 `SINGLE` 모드, 1명 매칭 | PASS |
| 단건 매칭 | 순번 1번 제외, 순번 2번 `userId=3` 선정 | PASS |
| 단건 매칭 | 폴백 수락가능성/순번가점 점수 계산 `0.66` | PASS |
| 단건 매칭 | AI 설명문 미사용, 템플릿 메시지 반환 | PASS |
| 제안 수락 | 본인 제안 수락 시 `ACCEPTED` 처리 | PASS |
| 제안 수락 | 타인 제안 수락 차단 | PASS |
| 방어 로직 | 존재하지 않는 좌석 릴리즈 시 `matched=0`, `mode=NONE` | PASS |
| 방어 로직 | 대기자 없는 공연 릴리즈 시 `대기자가 없습니다` | PASS |
| 대량 매칭 | 6석 릴리즈 시 `BATCH` 모드, 6명 매칭 | PASS |
| 대량 매칭 | 대량 선정 사용자 `[2, 3, 4, 7, 8, 11]` | PASS |
| 대량 매칭 | AI 설명 호출 제거 후 템플릿 메시지 반환 | PASS |

핵심 확인:

- 순번 1번이 항상 무조건 받는 방식이 아니라, 필수 조건 불일치 시 다음 후보로 넘어간다.
- 단건 매칭은 `수락가능성 * 0.6 + 순번가점 * 0.4` 계산으로 선정된다.
- 대량 매칭은 만족 인원 최대화 기준으로 여러 명에게 제안을 만든다.
- 제안 문구와 대량 배분 reason은 AI 생성문이 아니라 프론트용 템플릿/규칙 문자열이다.
- 잘못된 좌석, 대기자 없는 공연, 타인 수락 같은 실패 케이스도 500 없이 처리된다.

### 4.1 빌드/컴파일

결과:

- `docker build -t inticket-recommend-check recommend-service`: 성공
- 컨테이너 내부 `python -m compileall /app`: 성공
- FastAPI 앱 import 성공
- waitlist 관련 라우터 등록 확인 성공

등록 확인된 라우트:

```text
/api/recommend/waitlists
/api/recommend/waitlists/my
/api/recommend/offers/my
/api/recommend/offers/{offer_id}/accept
/api/recommend/internal/released
/api/recommend/internal/waitlists/{course_id}
/api/recommend/internal/offers
```

### 4.2 단건 매칭 폴백 실행 결과

실행 조건:

```json
{
  "courseId": 1,
  "seats": ["S-Q-5"],
  "reason": "SINGLE"
}
```

결과 요약:

- `mode`: `SINGLE`
- `matched`: `1`
- 선정 사용자: `user_id=3`, 순번 2번
- 순번 1번은 `S등급 P열` 필수 조건이라 `S-Q-5`와 맞지 않아 제외
- LLM 비활성 상태라 모든 후보의 수락가능성은 `0.5`
- 최종 점수는 순번가점 차이로 결정

실제 reason:

```text
순번 2번 대기자에게 배정했습니다. 앞 순번(1번)은 필수 조건 불일치 또는 점수 미달로 제외됐습니다. (수락가능성 0.5 × 0.6 + 순번가점 0.9 × 0.4 = 0.66)
```

### 4.3 대량 매칭 폴백 실행 결과

실행 조건:

```json
{
  "courseId": 1,
  "seats": ["S-P-1", "S-P-2", "S-P-3", "S-P-4", "S-P-6", "S-Q-1"],
  "reason": "DEADLINE_BATCH"
}
```

결과 요약:

- `mode`: `BATCH`
- `matched`: `6`
- 선정 사용자: `user_id=2, 3, 4, 7, 8, 11`
- 대량 배분은 만족 인원 최대화, 순번합 최소화 기준으로 동작
- LLM 비활성 상태라 `plans[0]`을 선택

실제 reason:

```text
만족 인원 6명(최대), 순번합 29(동점 시 최소)인 배분안을 선택했습니다.
```

### 4.4 실제 LLM 모드 실행 결과

실행 조건:

- `LLM_ENABLED=true`
- `LLM_MODEL=gpt-4o-mini`
- `LLM_API_KEY`는 `.env`에서 읽음

LLM 사용 가능 여부:

```json
{
  "llm_available": true
}
```

현재 결과:

- LLM 설정 자체는 활성 상태로 인식됨
- OpenAI API가 `429 Too Many Requests`를 반환
- 조건 파싱은 규칙 폴백으로 전환
- 단건 수락가능성 평가는 전원 `0.5` 폴백 점수로 전환
- 그래도 매칭 API는 500 없이 정상 응답

429 로그:

```text
[AI] LLM 호출 실패 - 폴백 사용: HTTPStatusError: Client error '429 Too Many Requests'
```

조건 파싱 폴백 결과는 문장에 명시된 등급·인원을 보존한다. 예를 들어
`R석 두개 찾아줘`는 다음처럼 저장된다.

```json
{
  "required": {
    "count": 2,
    "grade": ["R"]
  },
  "preferred": {},
  "flexible": {}
}
```

해석:

- API 한도 문제 때문에 이번 실행에서는 LLM 파싱 품질을 평가하지 못했다.
- 다만 실패 시 기본 조건 `count=1`로 안전하게 내려가는 것은 확인했다.

단건 매칭 테스트:

```json
{
  "courseId": 1,
  "seats": ["S-Q-5"],
  "reason": "SINGLE"
}
```

실제 결과 요약:

- `mode`: `SINGLE`
- `matched`: `1`
- 선정 사용자: `user_id=3`, 순번 2번
- LLM 429 때문에 수락가능성은 전원 `0.5` 폴백
- 순번가점 기준으로 `user_id=3` 선정

실제 debug:

```json
[
  { "user_id": 3, "seq": 2, "acceptance": 0.5, "seq_bonus": 0.9, "score": 0.66 },
  { "user_id": 4, "seq": 3, "acceptance": 0.5, "seq_bonus": 0.8, "score": 0.62 },
  { "user_id": 7, "seq": 6, "acceptance": 0.5, "seq_bonus": 0.5, "score": 0.5 },
  { "user_id": 8, "seq": 7, "acceptance": 0.5, "seq_bonus": 0.4, "score": 0.46 },
  { "user_id": 11, "seq": 10, "acceptance": 0.5, "seq_bonus": 0.1, "score": 0.34 }
]
```

실제 reason:

```text
순번 2번 대기자에게 배정했습니다. 앞 순번(1번)은 필수 조건 불일치 또는 점수 미달로 제외됐습니다. (수락가능성 0.5 × 0.6 + 순번가점 0.9 × 0.4 = 0.66)
```

제안 메시지:

```text
요청하신 조건에 맞는 좌석 S등급 Q열 5번(S-Q-5, 102,000원)이(가) 나왔습니다. 10분 내 결제 시 확정됩니다.
```

대량 매칭 테스트:

```json
{
  "courseId": 1,
  "seats": ["S-P-1", "S-P-2", "S-P-3", "S-P-4", "S-P-6", "S-Q-1"],
  "reason": "DEADLINE_BATCH"
}
```

실제 결과 요약:

- `mode`: `BATCH`
- `matched`: `6`
- 선정 사용자: `user_id=2, 3, 4, 7, 8, 11`
- 대량 배분안 선택은 LLM 없이 규칙 기반 `plans[0]` 사용
- 제안 메시지도 LLM 없이 템플릿 사용

실제 reason:

```text
만족 인원 6명(최대), 순번합 29(동점 시 최소)인 배분안을 선택했습니다.
```

판단:

- LLM 설정은 활성화되어 있지만 현재 API 한도 문제로 실제 AI 품질 평가는 제한된다.
- 그래도 더미데이터 기반 취소표 매칭 기능은 정상 동작한다.
- 프론트에 필요한 결과는 `offers[].userId`, `offers[].seats`, `offers[].seatsText`, `offers[].status`로 충분하다.
- AI 설명문은 MVP 요구사항이 아니므로 생성하지 않는다.

## 5. 현재 상태 판단

구현 자체는 명세의 큰 구조와 잘 맞는다.

- DB 스키마 변경 없이 인메모리 저장소로 구현되어 제약을 지킨다.
- 좌석 계산은 규칙 코드가 담당하고 LLM은 자연어 조건 파싱/단건 수락가능성 점수에만 관여한다.
- LLM 장애 시에도 500으로 터지지 않고 기본값 또는 순번 중심 폴백으로 진행된다.
- 현재 키 상태에서는 `429 Too Many Requests`가 발생하지만, 폴백 경로로 단건/대량 매칭 모두 완료된다.
- AI 설명문 생성은 제거했고, 프론트용 메시지는 템플릿으로 고정했다.
- Dockerfile 기준 Python 3.12 환경에서는 의존성 설치와 앱 import가 정상이다.
- 라우터 등록 순서도 `/api/recommend/waitlists`가 기존 `/{user_id}`에 먹히지 않도록 되어 있다.

## 6. 확인된 주의점

### 6.1 로컬 Python 3.14에서는 requirements 설치 실패

로컬 기본 `python3`는 3.14.6이다.
이 환경에서 `pydantic==2.10.3`의 `pydantic-core==2.27.1` 빌드가 실패했다.

실패 이유:

```text
the configured Python interpreter version (3.14) is newer than PyO3's maximum supported version (3.13)
```

프로젝트 Dockerfile은 `python:3.12-slim`을 사용하므로 Docker 실행 기준으로는 정상이다.
로컬 직접 실행을 하려면 Python 3.12 가상환경을 쓰는 것이 안전하다.

### 6.2 `.env`가 Docker 이미지에 복사될 수 있음

현재 Dockerfile은 `COPY . .`를 사용한다.
`recommend-service/.env`가 존재하면 이미지 안에 포함될 수 있다.

권장:

- `.dockerignore`에 `.env`, `.omc`, `__pycache__`, `.codex_tmp` 등을 추가
- 운영/시연 환경에서는 환경변수 주입 방식 사용

### 6.3 `.omc` 파일이 미추적 상태

현재 로컬에 다음 미추적 파일/디렉터리가 있다.

```text
.omc/
recommend-service/.omc/
```

기능 코드와 관계없는 로컬 도구 상태로 보이며 커밋 대상에서 제외하는 것이 좋다.

### 6.4 테스트 코드 없음

현재 `recommend-service` 안에서 별도 테스트 디렉터리나 pytest 테스트 파일은 확인되지 않았다.
발표 전 최소한 다음 테스트가 있으면 좋다.

- 조건 파싱 normalize 단위 테스트
- `is_feasible`, `find_blocks`, `find_split_combos` 단위 테스트
- 단건 매칭에서 앞 순번 필수 조건 불일치 시 다음 후보 선정 테스트
- 대량 매칭에서 만족 인원 최대화 테스트
- LLM 실패 시 폴백 테스트

### 6.5 로컬 코드 정리 사항

점검 중 `recommend-service/app/service/ai_matching_service.py`의 docstring 한 줄이 어색하게 끝나는 것을 확인했다.

```python
"""LLM이 준 JSON을 검증·정규화한
```

동작에는 영향이 없었지만 문서/가독성상 다음처럼 수정했다.

```python
"""LLM이 준 JSON을 검증·정규화한다.
```

### 6.6 실제 LLM 사용 시 429 가능성

실제 검증 중 OpenAI API가 `429 Too Many Requests`를 반환했다.
현재 코드는 이 경우 폴백으로 잘 내려간다.
AI 설명문은 MVP에서 쓰지 않으므로 429가 나도 프론트 제안 메시지 생성에는 영향이 없다.
다만 자연어 조건 파싱과 단건 수락가능성 점수를 실제 AI로 보여주려면 다음을 확인해야 한다.

- API 키의 quota/credit 상태
- rate limit 상태
- 같은 시나리오를 짧은 시간에 반복 호출하지 않는지
- 필요하면 `LLM_MODEL`을 더 가벼운 모델로 바꿀지

## 7. 시연용 호출 순서

Swagger 또는 HTTP 클라이언트에서 다음 순서로 확인하면 된다.

1. `POST /api/recommend/internal/reset`
2. `GET /api/recommend/internal/waitlists/1`
3. 단건 시나리오:

```json
{
  "courseId": 1,
  "seats": ["S-Q-5"],
  "reason": "SINGLE"
}
```

4. `GET /api/recommend/internal/offers`
5. 다시 `POST /api/recommend/internal/reset`
6. 대량 시나리오:

```json
{
  "courseId": 1,
  "seats": ["S-P-1", "S-P-2", "S-P-3", "S-P-4", "S-P-6", "S-Q-1"],
  "reason": "DEADLINE_BATCH"
}
```

7. `GET /api/recommend/internal/offers`

LLM 키 없이도 위 시나리오는 정상 동작한다.
LLM 키가 있고 API 한도가 정상이라면 자연어 조건 파싱과 단건 수락가능성 점수만 AI가 보강한다.
제안 메시지와 대량 배분 reason은 프론트 연동을 위해 템플릿/규칙 문자열로 고정한다.
