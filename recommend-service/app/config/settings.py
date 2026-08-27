# /docker-compose.yml (운영 환경 : 컨테이너 실행용 - 실제 적용값)
# /recommend-service/app/config/setting.py (아무 설정도 없을 경우 이 셋팅으로 동작 - 기본값)
# /recommend-service/.env (개발 환경 : 로컬 직접 실행용)

from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # 서버 설정
    app_port: int = 8085
    app_name: str = "recommend-service"

    # Eureka 설정
    eureka_server_url: str = "http://localhost:8761/eureka"
    eureka_instance_host: str = "localhost"

    # Auth Server
    jwt_issuer_uri: str = "http://localhost:8080"
    jwk_set_uri: str = "http://auth-server:9000/oauth2/jwks"

    # 서비스 URL
    enrollment_service_url: str = "http://localhost:8083"
    course_service_url: str = "http://localhost:8082"

    # Kafka
    kafka_bootstrap_servers: str = "localhost:9092"
    kafka_consumer_group_id: str = "recommend-service"
    kafka_topic_enrollment_completed: str = "enrollment.completed"

    # LLM 설정 (AI 취소표 매칭)
    # llm_enabled=False 로 두면 LLM 호출 없이 전부 폴백 경로(순번 기준)로 동작한다.
    llm_api_key: str = ""
    llm_model: str = "gpt-4o-mini"
    llm_enabled: bool = True
    llm_timeout: int = 15
    llm_api_url: str = "https://api.openai.com/v1/chat/completions"

    # B2B 수요 분석 계산 상수. LLM이 아닌 코드 계산에서 사용한다.
    forecast_decay: float = 0.92
    conversion_retention: float = 0.5

    # 제안(offer) 유효시간. 이 시간 내 미응답이면 만료되고 다음 순번으로 승계된다.
    offer_ttl_seconds: int = 600

    class Config:
        env_file = ".env"


settings = Settings()
