"""대기자·제안 인메모리 저장소.

DB 스키마를 변경하지 않기 위한 의도적 선택이다(신규 테이블 추가 금지 제약).
프로세스를 재시작하면 데이터가 사라지지만 MVP 데모 목적상 문제없다.
실 서비스에서는 별도 테이블 또는 Redis가 필요하다.

단일 워커(uvicorn 1 프로세스) 가정이므로 lock을 쓰지 않는다.
"""

import logging
import time
from typing import Optional

from app.config.settings import settings

logger = logging.getLogger(__name__)

# 공연(course)별 대기자 목록
_waitlists: dict = {}
# offer_id -> offer
_offers: dict = {}
# 공연별 대기 순번 카운터. 등록 순서로 자동 부여한다(별도 정책 없음).
# 공연마다 따로 매긴다 — 콘서트 3번 대기자와 뮤지컬 3번 대기자는 서로 무관하다.
_seq_by_course: dict = {}
# offer_id 카운터
_offer_seq: int = 0

OFFER_PENDING = "PENDING"
OFFER_ACCEPTED = "ACCEPTED"
OFFER_EXPIRED = "EXPIRED"


def add_waiter(
    user_id: int,
    course_id: int,
    raw_text: str,
    parsed: dict,
    seq: Optional[int] = None,
) -> dict:
    """대기자를 등록하고 순번을 자동 부여한다.

    seq를 직접 넘기는 건 시드 주입용 경로다(데모 순번을 고정하기 위함).
    """
    current = _seq_by_course.get(course_id, 0)

    # seq를 직접 받으면 그 값을 쓰고, 카운터는 뒤로 밀어 이후 자동 순번이 겹치지 않게 한다
    assigned_seq = current + 1 if seq is None else seq
    _seq_by_course[course_id] = max(current, assigned_seq)

    waiter = {
        "user_id": user_id,
        "course_id": course_id,
        "seq": assigned_seq,
        "raw_text": raw_text,
        "required": parsed.get("required") or {},
        "preferred": parsed.get("preferred") or {},
        "flexible": parsed.get("flexible") or {},
        "registered_at": time.time(),
    }
    _waitlists.setdefault(course_id, []).append(waiter)
    logger.info(f"[Store] 대기 등록 - courseId: {course_id}, userId: {user_id}, seq: {assigned_seq}")
    return waiter


def get_waiters(course_id: int) -> list:
    """해당 공연의 대기자 목록을 순번 오름차순으로 반환."""
    return sorted(_waitlists.get(course_id, []), key=lambda w: w["seq"])


def get_waiters_by_user(user_id: int) -> list:
    """한 사용자가 등록한 모든 대기 건."""
    result = []
    for waiters in _waitlists.values():
        result.extend(w for w in waiters if w["user_id"] == user_id)
    return sorted(result, key=lambda w: w["seq"])


def find_waiter(course_id: int, user_id: int) -> Optional[dict]:
    """공연+사용자로 대기자 1건 조회."""
    for waiter in _waitlists.get(course_id, []):
        if waiter["user_id"] == user_id:
            return waiter
    return None


def remove_waiter(course_id: int, user_id: int) -> bool:
    """대기 목록에서 제거. 제안을 수락해 예매가 확정되면 호출된다."""
    waiters = _waitlists.get(course_id)
    if not waiters:
        return False

    before = len(waiters)
    _waitlists[course_id] = [w for w in waiters if w["user_id"] != user_id]
    removed = len(_waitlists[course_id]) != before
    if removed:
        logger.info(f"[Store] 대기 해제 - courseId: {course_id}, userId: {user_id}")
    return removed


def create_offer(
    user_id: int,
    course_id: int,
    seats: list,
    message: str,
    reason: str = "",
) -> dict:
    """좌석 제안을 발행한다. TTL 경과 후에는 만료 처리되어 다음 순번으로 승계된다."""
    global _offer_seq

    _offer_seq += 1
    now = time.time()
    offer = {
        "offer_id": f"of_{_offer_seq}",
        "user_id": user_id,
        "course_id": course_id,
        "seats": list(seats),
        "message": message,
        "reason": reason,
        "created_at": now,
        "expires_at": now + settings.offer_ttl_seconds,
        "status": OFFER_PENDING,
    }
    _offers[offer["offer_id"]] = offer
    logger.info(
        f"[Store] 제안 발행 - offerId: {offer['offer_id']}, userId: {user_id}, seats: {seats}"
    )
    return offer


def expire_stale_offers() -> int:
    """만료 시각이 지난 PENDING 제안을 EXPIRED로 바꾸고 개수를 반환.

    별도 스케줄러를 두지 않고 조회 시점에 lazy하게 처리한다.
    """
    now = time.time()
    expired = 0
    for offer in _offers.values():
        if offer["status"] == OFFER_PENDING and offer["expires_at"] <= now:
            offer["status"] = OFFER_EXPIRED
            expired += 1
    if expired:
        logger.info(f"[Store] 만료 제안 정리 - {expired}건")
    return expired


def get_offer(offer_id: str) -> Optional[dict]:
    """제안 1건 조회(만료 정리 후)."""
    expire_stale_offers()
    return _offers.get(offer_id)


def get_offers_by_user(user_id: int, only_pending: bool = True) -> list:
    """사용자에게 발행된 제안 목록. 조회 시점에 만료분을 먼저 정리한다."""
    expire_stale_offers()
    offers = [o for o in _offers.values() if o["user_id"] == user_id]
    if only_pending:
        offers = [o for o in offers if o["status"] == OFFER_PENDING]
    return sorted(offers, key=lambda o: o["created_at"])


def get_all_offers() -> list:
    """전체 제안 목록(데모/디버깅용)."""
    expire_stale_offers()
    return sorted(_offers.values(), key=lambda o: o["created_at"])


def accept_offer(offer_id: str, user_id: int) -> dict:
    """제안 수락. 성공 시 대기 목록에서 해당 사용자를 제거한다.

    반환: {"success": bool, "message": str, "offer": dict | None}
    """
    expire_stale_offers()
    offer = _offers.get(offer_id)

    if offer is None:
        return {"success": False, "message": "존재하지 않는 제안입니다", "offer": None}
    if offer["user_id"] != user_id:
        return {"success": False, "message": "본인에게 발행된 제안이 아닙니다", "offer": None}
    if offer["status"] == OFFER_ACCEPTED:
        return {"success": False, "message": "이미 수락된 제안입니다", "offer": offer}
    if offer["status"] == OFFER_EXPIRED:
        return {"success": False, "message": "제안이 만료되었습니다", "offer": offer}

    offer["status"] = OFFER_ACCEPTED
    remove_waiter(offer["course_id"], user_id)
    logger.info(f"[Store] 제안 수락 - offerId: {offer_id}, userId: {user_id}")
    return {"success": True, "message": "예매가 확정되었습니다", "offer": offer}


def has_pending_offer(course_id: int, user_id: int) -> bool:
    """이미 대기 중인 제안이 있는지. 한 사람에게 중복 배정하지 않기 위해 쓴다."""
    expire_stale_offers()
    return any(
        o["status"] == OFFER_PENDING and o["course_id"] == course_id and o["user_id"] == user_id
        for o in _offers.values()
    )


def reset() -> None:
    """전체 초기화. 발표 리허설용(/internal/reset)."""
    global _waitlists, _offers, _seq_by_course, _offer_seq
    _waitlists = {}
    _offers = {}
    _seq_by_course = {}
    _offer_seq = 0
    logger.info("[Store] 저장소 초기화 완료")
