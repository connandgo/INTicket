# syntax=docker/dockerfile:1.7

# 1단계: Gradle로 JAR 빌드
FROM eclipse-temurin:21-jdk-alpine AS builder
WORKDIR /app

# 모든 Java 서비스가 같은 BuildKit 캐시를 공유하도록 고정한다.
ENV GRADLE_USER_HOME=/root/.gradle

# 빌드 설정과 Wrapper를 먼저 복사한다.
COPY gradlew .
COPY gradle gradle
COPY build.gradle .
COPY settings.gradle .
RUN chmod +x gradlew

# `gradle dependencies`는 실제 compileClasspath JAR 전체를 받지 않으므로
# 별도 실행하지 않고 bootJar 한 번으로 필요한 의존성과 소스를 처리한다.
COPY src src

# sharing=locked:
# - Compose가 여러 Java 이미지를 동시에 빌드해도 Gradle 다운로드 구간을 직렬화
# - 서비스 사이에서 Wrapper와 Maven/Gradle 의존성 캐시를 재사용
# - 429가 발생한 경우에만 캐시를 유지한 채 최대 5회 재시도
RUN --mount=type=cache,id=inticket-gradle-cache,target=/root/.gradle,sharing=locked \
    set -eu; \
    attempt=1; \
    while :; do \
      if ./gradlew bootJar -x test --no-daemon --max-workers=1 > /tmp/gradle-build.log 2>&1; then \
        cat /tmp/gradle-build.log; \
        break; \
      else \
        status=$?; \
        cat /tmp/gradle-build.log >&2; \
        if ! grep -q "Too Many Requests" /tmp/gradle-build.log || [ "$attempt" -ge 5 ]; then \
          exit "$status"; \
        fi; \
        delay=$((attempt * 30)); \
        echo "Maven Central HTTP 429: ${delay}초 후 재시도 ($((attempt + 1))/5)" >&2; \
        sleep "$delay"; \
        attempt=$((attempt + 1)); \
      fi; \
    done

# 2단계: 실행 환경 (JRE만 포함 - 이미지 경량화)
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=builder /app/build/libs/*.jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]
