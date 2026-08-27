"""AI 취소표 매칭 API.

⚠️ 라우팅 충돌 주의: 기존 recommend_router는 같은 prefix("/api/recommend")에
@router.get("/{user_id}") 를 갖고 있다. main.py에서 이 라우터를 recommend_router보다
먼저 등록해야 "/api/recommend/waitlists" 가 "/{user_id}"에 먹히지 않는다.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from app.config.security import current_user_id
from app.data import seed
from app.data.seats import SEAT_MAP, describe_seats
from app.model.matching_schemas import (
    AcceptResponse,
    OfferItem,
    ParsedCondition,
    ReleasedRequest,
    ReleasedResponse,
    ResetResponse,
    WaitlistCreateRequest,
    WaitlistCreateResponse,
    WaitlistItem,
)
from app.service import ai_matching_service, matching_service
from app.store import waitlist_store as store

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/recommend", tags=["waitlist"])


def _to_offer_item(offer: dict) -> OfferItem:
    """저장소 offer dict를 응답 모델로 변환."""
    return OfferItem(
        offerId=offer["offer_id"],
        userId=offer["user_id"],
        courseId=offer["course_id"],
        seats=offer["seats"],
        seatsText=describe_seats(offer["seats"]),
        message=offer["message"],
        reason=offer.get("reason", ""),
        expiresAt=offer["expires_at"],
        status=offer["status"],
    )


def _to_parsed(waiter: dict) -> ParsedCondition:
    """저장소 waiter dict에서 파싱 결과 부분만 뽑아 응답 모델로 변환."""
    return ParsedCondition(
        required=waiter.get("required") or {},
        preferred=waiter.get("preferred") or {},
        flexible=waiter.get("flexible") or {},
    )


@router.post("/waitlists", response_model=WaitlistCreateResponse)
async def create_waitlist(
    payload: WaitlistCreateRequest,
    user_id: int = Depends(current_user_id),
):
    """POST /api/recommend/waitlists - 자연어 조건으로 취소표 대기 등록

    conditionText를 LLM이 필수/선호/양보가능 3단계로 분류해 저장한다.
    - 필수: 어기면 후보에서 제외 (예: "무조건 1층", "15만원 이하")
    - 선호: 맞으면 좋지만 양보 가능 (예: "1층이면 좋겠어요", "15만원 정도")
    - 양보가능: 명시적으로 포기 가능하다고 말한 것 (예: "정 안 되면 나눠 앉아도 돼요")

    대기 순번은 등록 순서로 자동 부여된다.
    LLM 호출이 실패해도 500을 내지 않고 기본값({"count": 1})으로 폴백한다.
    """
    logger.info(f"[Waitlist] 대기 등록 요청 - userId: {user_id}, courseId: {payload.courseId}")

    parsed = await ai_matching_service.parse_condition(payload.conditionText)
    waiter = store.add_waiter(
        user_id=user_id,
        course_id=payload.courseId,
        raw_text=payload.conditionText,
        parsed=parsed,
    )

    return WaitlistCreateResponse(
        waitlistId=waiter["seq"],
        seq=waiter["seq"],
        parsed=_to_parsed(waiter),
    )


@router.get("/waitlists/my", response_model=list[WaitlistItem])
async def get_my_waitlists(user_id: int = Depends(current_user_id)):
    """GET /api/recommend/waitlists/my - 내 대기 목록

    내가 등록한 모든 공연의 대기 건을 순번 오름차순으로 반환한다.
    parsed로 시스템이 내 문장을 어떻게 이해했는지 확인할 수 있다.
    """
    waiters = store.get_waiters_by_user(user_id)
    return [
        WaitlistItem(
            waitlistId=w["seq"],
            courseId=w["course_id"],
            seq=w["seq"],
            rawText=w["raw_text"],
            parsed=_to_parsed(w),
        )
        for w in waiters
    ]


@router.get("/offers/my", response_model=list[OfferItem])
async def get_my_offers(user_id: int = Depends(current_user_id)):
    """GET /api/recommend/offers/my - 내게 온 좌석 제안 목록

    조회 시점에 만료된 제안을 먼저 정리하므로, 10분이 지난 제안은 여기서 사라진다.
    (별도 스케줄러 없이 lazy하게 처리)
    """
    offers = store.get_offers_by_user(user_id, only_pending=True)
    return [_to_offer_item(o) for o in offers]


@router.post("/offers/{offer_id}/accept", response_model=AcceptResponse)
async def accept_offer(offer_id: str, user_id: int = Depends(current_user_id)):
    """POST /api/recommend/offers/{offer_id}/accept - 제안 수락

    수락하면 대기 목록에서 빠진다. 만료됐거나 남의 제안이면 400을 반환한다.
    """
    result = store.accept_offer(offer_id, user_id)
    if not result["success"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result["message"])
    return AcceptResponse(success=True, message=result["message"])


# ---------------------------------------------------------------------------
# 데모용 내부 엔드포인트 (인증 없음)
# 향후 Kafka 취소 이벤트로 대체될 자리. 현재는 Swagger에서 직접 눌러 시뮬레이션한다.
# ---------------------------------------------------------------------------

@router.post("/internal/released", response_model=ReleasedResponse)
async def seats_released(payload: ReleasedRequest):
    """POST /api/recommend/internal/released - 취소 발생 시뮬레이션 (데모의 핵심 트리거)

    좌석 규모에 따라 두 국면으로 분기한다.
    - 좌석 < 5개, reason="SINGLE": 단건 산발. 점수 = 수락가능성×0.6 + 순번가점×0.4
    - 좌석 >= 5개 또는 reason="DEADLINE_BATCH": 대량 일괄.
      1순위 만족 인원 최대화, 2순위 순번합 최소 (순번 1번이 밀릴 수 있다)

    응답의 reason에 "왜 이 사람/이 배분안인지"에 대한 AI 설명이 담긴다.
    "10만원 이하" 같은 하드캡은 좌석 등급의 실제 가격과 비교해 초과자를 걸러낸다.
    """
    logger.info(
        f"[Waitlist] 취소 좌석 해제 - courseId: {payload.courseId}, "
        f"seats: {payload.seats}, reason: {payload.reason}"
    )
    result = await matching_service.on_seats_released(
        course_id=payload.courseId,
        seats=payload.seats,
        reason=payload.reason,
    )
    return ReleasedResponse(
        matched=result.get("matched", 0),
        offers=[_to_offer_item(o) for o in result.get("offers", [])],
        reason=result.get("reason", ""),
        mode=result.get("mode", ""),
        debug=result.get("debug"),
    )


@router.post("/internal/reset", response_model=ResetResponse)
async def reset_demo():
    """POST /api/recommend/internal/reset - 시드 상태로 초기화 (발표 리허설용)

    대기자·제안을 모두 비우고 데모용 대기자(콘서트 10명 + 뮤지컬 5명)를 다시 주입한다.
    시드는 이미 파싱된 상태로 박혀 있어 LLM을 호출하지 않는다.
    """
    count = seed.reset_to_seed()
    logger.info(f"[Waitlist] 데모 초기화 완료 - 대기자 {count}명")
    return ResetResponse(success=True, message="시드 상태로 초기화했습니다", waiters=count)


@router.get("/internal/seats", include_in_schema=True)
async def get_seat_map():
    """GET /api/recommend/internal/seats - 좌석 배치도 조회 (데모/디버깅용)

    좌석 배치도는 시드 데이터이며 실제 공연장과 연동되어 있지 않다.
    """
    return {"seatMap": SEAT_MAP}


@router.get("/internal/waitlists/{course_id}", include_in_schema=True)
async def get_waitlist_of_course(course_id: int):
    """GET /api/recommend/internal/waitlists/{course_id} - 대기자 전원 조회 (데모/디버깅용)"""
    return [
        {
            "userId": w["user_id"],
            "seq": w["seq"],
            "rawText": w["raw_text"],
            "parsed": _to_parsed(w).model_dump(),
        }
        for w in store.get_waiters(course_id)
    ]


@router.get("/internal/offers", include_in_schema=True)
async def get_all_offers():
    """GET /api/recommend/internal/offers - 발행된 제안 전체 조회 (데모/디버깅용)"""
    return [_to_offer_item(o).model_dump() for o in store.get_all_offers()]
