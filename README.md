# INTicket

`develop` 브랜치의 Vue 화면을 계약으로 삼아 구성한 공연 예매 MSA입니다. 기존 포트와 Eureka, Gateway, Kafka, Docker Compose 구조를 유지하면서 8081~8084의 책임과 MariaDB 스키마를 공연 도메인에 맞게 분리했습니다.

## 서비스 구성

| 포트 | 서비스 | 책임 |
|---:|---|---|
| 3000 | Vue frontend | 공연 탐색, 회차·등급 선택, 예매, 취소표 대기, 마이페이지 |
| 8080 | API Gateway | 외부 API 단일 진입점, JWT 검증·사용자 헤더 전달 |
| 8081 | user-service | 회원가입, 사용자 프로필, 역할(`STUDENT`, `INSTRUCTOR`) |
| 8082 | course-service | 공연 카탈로그, 회차, 좌석 등급별 가격·재고, 판매 현황 |
| 8083 | enrollment-service | 10분 좌석 선점, 예매, 취소, 취소표 대기·자동 매칭 |
| 8084 | payment-service | 모의 결제, 결제 멱등성, 취소·환불 상태 |
| 8085 | 미사용 | AI 추천 기능 제외 |
| 8761 | Eureka | 서비스 디스커버리 |
| 9000 | Auth Server | 자체 회원용 OAuth2/OIDC 인증 서버 |
| 9092 | Kafka | `payment.completed`, `enrollment.completed` 이벤트 |
| 3379 | MariaDB | 호스트 접속 포트(컨테이너 내부 3306) |

상세한 데이터 구성, ERD, API 소유권은 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)를 참고합니다.

## 실행

Gateway와 Auth Server는 원본 프로젝트의 사전 빌드 이미지인 `msa-lecture/api-gateway:1.0`, `msa-lecture/auth-server:1.0`을 그대로 사용합니다. GitHub의 단일 파일 100MB 제한을 지키기 위해 루트의 이미지 파일을 `infra-images.tar.part.aa`~`ad`로 분할해 두었습니다. 최초 실행 전에 한 번만 결합하고 Docker에 불러옵니다.

```bash
cat infra-images.tar.part.* > infra-images.tar
shasum -a 256 infra-images.tar
docker load -i infra-images.tar
```

정상 체크섬은 `edb44b60e1069ac1a3557a75b188ec3ae76d410aa916bfcd0c400258dcc26568`입니다. 이후 루트의 단일 `docker-compose.yml`로 프론트엔드를 포함한 전체 애플리케이션을 빌드·실행합니다.

```bash
docker compose build && docker compose up -d
```

브라우저에서 `http://localhost:3000`에 접속합니다. `db-migration`이 매 실행마다 멱등 SQL을 적용하므로 기존 `lecture_db` 볼륨도 삭제하지 않고 `performance_db`, `booking_db`, `payment_db`와 권한을 자동 보완합니다. `docker compose down -v`는 더 이상 마이그레이션을 위해 필요하지 않습니다.

`--no-cache`는 Docker 레이어를 전부 다시 확인해야 하는 장애 분석 때만 사용합니다. Java 서비스는 하나의 공통 빌더에서 Gradle 의존성과 데몬을 공유하고 순차 컴파일해 병렬 빌드의 캐시 잠금·중복 다운로드를 없앴습니다. 평소 재빌드는 위 기본 명령이 가장 빠르며, 테스트는 이미지 생성 단계에서 명시적으로 제외하고 별도 검증 단계에서 실행합니다.

`down -v`는 DB 데이터를 삭제하므로 사용자가 전체 데이터를 초기화하려는 경우에만 사용합니다.

## MVP 계정과 데이터

첫 기동부터 화면을 발표할 수 있도록 공연 7개, 공연별 오리지널 포스터, 각 공연의 2개 회차, VIP/R/S/A 재고, 판매율, 확정·취소 예매, 결제, 취소표 대기 데이터를 제공합니다. 기존 데이터가 있으면 동일 PK/유일 키는 건너뛰므로 반복 기동해도 더미데이터가 중복되지 않습니다. 포스터의 생성 방식과 공연 ID 매핑은 `vue-frontend/src/assets/posters/README.md`에 정리했습니다.

| 역할 | 이메일 | 비밀번호 | 발표 화면 |
|---|---|---|---|
| 관람객 | `student@lecture.com` | `password1234` | 예매 내역, 취소 내역, 매진 공연 대기 |
| 공연기획사 | `instructor@lecture.com` | `password1234` | 등록 공연 7개, 회차별 판매율 |

GitHub `develop`의 실제 HEAD `2475aae`를 확인해 프론트 계약을 다시 대조했습니다. 해당 변경의 AI 수요분석·AI 좌석매칭은 요청 범위에서 제외하고, 비-AI 로그아웃/메뉴 개선과 공연·회차·예매 화면 계약만 반영했습니다. 따라서 8085 추천 서비스는 Compose 실행 대상에 포함하지 않습니다.

## 인증에 대한 결정

여기서 OAuth2/OIDC는 카카오·구글 같은 소셜 로그인을 뜻하지 않습니다. 현재 프론트와 기존 Gateway가 Authorization Code 및 JWT 계약을 이미 사용하므로 9000번 자체 인증 서버를 유지했습니다. 즉, 사용자는 INTicket의 이메일·비밀번호로 로그인하고 Auth Server는 토큰 발급 역할만 합니다. MSA 자체 때문에 OAuth가 필수인 것은 아니지만, 이 프로젝트에서는 Gateway 계약을 최소 변경으로 유지하기 위한 내부 인증 방식입니다.

## 주요 흐름

1. 공연 등록 시 기본 회차와 VIP/R/S/A 등급 재고가 생성됩니다.
2. 관람객이 등급과 1~4매를 고르면 8083이 8082 재고를 잠그고 10분 선점을 만듭니다.
3. 예매 요청은 8084에서 모의 결제를 멱등 처리하고 `payment.completed`를 발행합니다.
4. 8083이 이벤트를 소비해 예매를 `ACTIVE`로 전환하고 누적 판매 수량을 갱신합니다.
5. 취소 시 결제와 좌석이 복구되고, 대기자가 있으면 FIFO 순서로 자동 예매를 시도합니다.

동시 요청에 대해서는 좌석 재고와 예매 상태에 비관적 잠금을 사용하고, DB 생성형 유니크 키로 활성 중복 예매와 중복 대기 등록을 최종 차단합니다.
