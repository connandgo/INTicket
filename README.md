# INTicket

`develop` 브랜치의 Vue 화면을 계약으로 삼아 구성한 공연 예매 MSA입니다. 기존 포트와 Eureka, Gateway, Kafka, Docker Compose 구조를 유지하면서 8081~8085의 책임과 MariaDB 스키마를 공연 도메인에 맞게 분리했습니다.

## 서비스 구성

| 포트 | 서비스 | 책임 |
|---:|---|---|
| 3000 | Vue frontend | 공연 탐색, 회차·등급 선택, 예매, 취소표 대기, 마이페이지 |
| 8080 | API Gateway | 외부 API 단일 진입점, JWT 검증·사용자 헤더 전달 |
| 8081 | user-service | 회원가입, 사용자 프로필, 역할(`STUDENT`, `INSTRUCTOR`) |
| 8082 | course-service | 공연 카탈로그, 회차, 좌석 등급별 가격·재고, 판매 현황 |
| 8083 | enrollment-service | 10분 좌석 선점, 예매, 취소, 취소표 대기·자동 매칭 |
| 8084 | payment-service | 모의 결제, 결제 멱등성, 취소·환불 상태 |
| 8085 | recommend-service | 예매 이력·장르 기반 규칙 추천 |
| 8761 | Eureka | 서비스 디스커버리 |
| 9000 | Auth Server | 자체 회원용 OAuth2/OIDC 인증 서버 |
| 9092 | Kafka | `payment.completed`, `enrollment.completed` 이벤트 |
| 3379 | MariaDB | 호스트 접속 포트(컨테이너 내부 3306) |

상세한 데이터 구성, ERD, API 소유권은 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)를 참고합니다.

## 실행

Gateway와 Auth Server는 원본 프로젝트의 사전 빌드 이미지인 `msa-lecture/api-gateway:1.0`, `msa-lecture/auth-server:1.0`을 그대로 사용합니다. 해당 이미지가 로컬에 준비된 환경에서 다음 명령으로 전체 애플리케이션을 빌드·실행합니다.

```bash
docker compose -f docker-compose.build.yml up --build -d
```

브라우저에서 `http://localhost:3000`에 접속합니다. MariaDB 초기화 SQL은 새 볼륨을 처음 만들 때 자동 실행됩니다. 기존의 단일 `lecture_db` 볼륨을 새 스키마로 전환할 때만, 필요한 데이터를 백업한 뒤 기존 볼륨을 명시적으로 제거하고 다시 실행해야 합니다.

```bash
docker compose -f docker-compose.build.yml down -v
docker compose -f docker-compose.build.yml up --build -d
```

`down -v`는 DB 데이터를 삭제하므로 초기화가 필요한 경우에만 사용합니다.

## 인증에 대한 결정

여기서 OAuth2/OIDC는 카카오·구글 같은 소셜 로그인을 뜻하지 않습니다. 현재 프론트와 기존 Gateway가 Authorization Code 및 JWT 계약을 이미 사용하므로 9000번 자체 인증 서버를 유지했습니다. 즉, 사용자는 INTicket의 이메일·비밀번호로 로그인하고 Auth Server는 토큰 발급 역할만 합니다. MSA 자체 때문에 OAuth가 필수인 것은 아니지만, 이 프로젝트에서는 Gateway 계약을 최소 변경으로 유지하기 위한 내부 인증 방식입니다.

## 주요 흐름

1. 공연 등록 시 기본 회차와 VIP/R/S/A 등급 재고가 생성됩니다.
2. 관람객이 등급과 1~4매를 고르면 8083이 8082 재고를 잠그고 10분 선점을 만듭니다.
3. 예매 요청은 8084에서 모의 결제를 멱등 처리하고 `payment.completed`를 발행합니다.
4. 8083이 이벤트를 소비해 예매를 `ACTIVE`로 전환하고 누적 판매 수량을 갱신합니다.
5. 취소 시 결제와 좌석이 복구되고, 대기자가 있으면 FIFO 순서로 자동 예매를 시도합니다.

동시 요청에 대해서는 좌석 재고와 예매 상태에 비관적 잠금을 사용하고, DB 생성형 유니크 키로 활성 중복 예매와 중복 대기 등록을 최종 차단합니다.
