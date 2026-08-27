"""AI 취소표 매칭 기능의 pydantic 모델.

기존 app/model/schemas.py는 건드리지 않고 이 파일에 모은다.
API 응답 필드는 기존 서비스들과 맞춰 camelCase를 쓴다.
"""

from typing import Any, List, Optional

from pydantic import BaseModel, Field


class ParsedCondition(BaseModel):
    """자연어 조건을 필수/선호/양보가능 3단계로 분류한 결과.

    - required: 어기면 후보에서 제외되는 하드 조건 (count, grade, row, max_price)
    - preferred: 맞으면 좋지만 양보 가능. 필터링에 쓰지 않고 수락가능성 판단 재료로만 쓴다
    - flexible: 명시적으로 포기 가능하다고 말한 것 (allow_split, max_split_gap, price_ceiling)
    """

    required: dict = Field(default_factory=dict)
    preferred: dict = Field(default_factory=dict)
    flexible: dict = Field(default_factory=dict)


class WaitlistCreateRequest(BaseModel):
    """대기 등록 요청. 조건은 가공 없이 자연어 그대로 받는다."""

    courseId: int
    conditionText: str


class WaitlistCreateResponse(BaseModel):
    """대기 등록 결과. parsed로 시스템이 문장을 어떻게 이해했는지 확인할 수 있다."""

    waitlistId: int
    seq: int
    parsed: ParsedCondition


class WaitlistItem(BaseModel):
    """내 대기 목록 항목."""

    waitlistId: int
    courseId: int
    seq: int
    rawText: str
    parsed: ParsedCondition


class OfferItem(BaseModel):
    """프론트에 전달하는 좌석 제안 항목."""

    offerId: str
    userId: int
    courseId: int
    seats: List[str]
    seatsText: str
    expiresAt: float
    status: str


class AcceptResponse(BaseModel):
    """제안 수락 결과."""

    success: bool
    message: str


class ReleasedRequest(BaseModel):
    """취소 발생 시뮬레이션 요청(데모용 내부 엔드포인트).

    reason이 "DEADLINE_BATCH"이거나 좌석이 5개 이상이면 대량 배분 국면으로 분기한다.
    티켓 가격은 좌석 등급에서 바로 읽으므로 따로 받지 않는다.
    """

    courseId: int
    seats: List[str]
    reason: str = "SINGLE"


class ReleasedResponse(BaseModel):
    """데모용 취소표 매칭 결과."""

    matched: int
    offers: List[OfferItem] = Field(default_factory=list)
    reason: str = ""
    mode: str = ""
    debug: Optional[Any] = None


class ResetResponse(BaseModel):
    """데모 초기화 결과."""

    success: bool
    message: str
    waiters: int
