"""기획사용 B2B AI 수요 분석 API."""

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from app.config.security import verify_token
from app.model.forecast_schemas import (
    ForecastResponse,
    ForecastSimulationRequest,
    ForecastSimulationResponse,
)
from app.service.forecast_service import ForecastCourseNotFound, build_forecast, simulate_forecast

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/recommend", tags=["forecast"])


@router.get("/forecast/{course_id}", response_model=ForecastResponse)
async def get_demand_forecast(
    course_id: int,
    token_payload: dict = Depends(verify_token),
):
    """공연별 취소표 대기 수요를 집계해 추가 회차 후보를 반환한다."""
    try:
        return await build_forecast(course_id)
    except ForecastCourseNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="공연을 찾을 수 없습니다")


@router.post("/forecast/{course_id}/simulate", response_model=ForecastSimulationResponse)
async def simulate_extra_show(
    course_id: int,
    payload: ForecastSimulationRequest,
    token_payload: dict = Depends(verify_token),
):
    """입력한 날짜·시간·좌석 수로 추가 회차 판매량을 시뮬레이션한다."""
    try:
        return await simulate_forecast(course_id, payload.date, payload.time, payload.capacity)
    except ForecastCourseNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="공연을 찾을 수 없습니다")
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error))
