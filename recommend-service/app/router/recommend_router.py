import logging
from fastapi import APIRouter, Depends
from app.config.security import verify_token
from app.model.schemas import RecommendResponse
from app.service.recommend_service import recommend_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/recommend", tags=["recommend"])


@router.get("/{user_id}", response_model=RecommendResponse)
async def get_recommendations(
    user_id: int,
    token_payload: dict = Depends(verify_token)
):
    """
    GET /recommend/{userId} - 사용자 기반 강의 추천

    추천 규칙:
    - 수강 이력 있음: 최빈 카테고리 기반 미수강 강의 추천 (수강생 수 기준 정렬)
    - 수강 이력 없음: 전체 인기 강의 추천
    """
    logger.info(f"[Router] 추천 요청 - userId: {user_id}")
    return await recommend_service.get_recommendations(user_id)


@router.get("/forecast/{course_id}")
async def get_demand_forecast(
    course_id: int,
    token_payload: dict = Depends(verify_token)
):
    """
    GET /recommend/forecast/{courseId} - 공연 수요예측 (스텁)

    TODO(AI 담당): 실제 예측 로직 구현. 응답 필드 구조도 AI 담당이 설계할 것 -
    아래는 라우팅 확인용 placeholder임.

    새 서비스로 안 만들고 여기 얹은 이유: API Gateway 라우트가
    /api/recommend/** 로 고정돼있어서(5개 라우트뿐, 미등록 경로는 게이트웨이가
    바로 404 던짐 - 실측 확인함), 독립 서비스로 만들면 프론트가 호출할 방법이
    없음. course-service의 GET /api/courses/{id} 호출하면 capacity(정원),
    enrollmentCount(현재 예매 수) 받아올 수 있음 - 판매율 계산 등에 활용 가능.
    """
    logger.info(f"[Router] 수요예측 요청(스텁) - courseId: {course_id}")
    return {"courseId": course_id, "message": "TODO: AI 담당 구현 예정"}


@router.get("/health", include_in_schema=False)
async def health_check():
    return {"status": "UP", "service": "recommend-service"}
