"""B2B AI 수요 분석 API의 요청·응답 모델."""

from typing import List, Optional

from pydantic import BaseModel, Field


class LabelValue(BaseModel):
    """프론트 배지에 쓰는 코드와 표시 문구."""

    code: str
    label: str


class ForecastTarget(BaseModel):
    capacity: Optional[int] = None
    sold: int = 0
    sellRate: Optional[float] = None
    soldOut: bool = False


class ExcessDemand(BaseModel):
    effectiveSeats: int
    level: LabelValue
    waitingCount: int
    requestedTickets: int
    ratioToSupply: float


class ExtraShow(BaseModel):
    recommended: dict
    expectedAudience: int
    expectedSeats: int
    expectedRate: float
    verdict: LabelValue


class Momentum(BaseModel):
    changeRate7d: float
    direction: str
    current: int
    forecast7d: int
    state: str


class TrendPoint(BaseModel):
    date: str
    value: int


class Trend(BaseModel):
    actual: List[TrendPoint]
    forecast: List[TrendPoint]


class ScheduleCandidate(BaseModel):
    rank: int
    weekday: str
    time: str
    expectedAudience: int
    expectedSeats: int
    expectedRate: float
    verdict: LabelValue


class ForecastResponse(BaseModel):
    """DemandInsightView가 바로 소비하는 수요 분석 결과."""

    courseId: int
    courseTitle: str
    generatedAt: str
    aiEnabled: bool
    target: ForecastTarget
    excessDemand: ExcessDemand
    extraShow: ExtraShow
    momentum: Momentum
    trend: Trend
    candidates: List[ScheduleCandidate]
    insights: List[str] = Field(min_length=3, max_length=3)
    recommendation: str


class ForecastSimulationRequest(BaseModel):
    date: str
    time: str
    capacity: int = Field(gt=0)


class ForecastSimulationResponse(BaseModel):
    day: str
    dayLabel: str
    time: str
    expectedAudience: int
    expectedSeats: int
    capacity: int
    expectedRate: float
    conversionRate: float
    verdict: LabelValue
    comment: str
    aiEnabled: bool
