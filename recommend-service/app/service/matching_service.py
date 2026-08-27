"""② 후보 조합 생성 (순수 규칙, LLM 없음) + 배분 오케스트레이션.

좌표 계산과 조합 열거는 '계산'이므로 전부 코드로 한다.
LLM은 조합을 만들지 않는다. 만들어진 조합 중 무엇을 고를지 '판단'하고 '설명'만 한다.
"""

import itertools
import logging
from typing import List

from app.data.seats import is_consecutive, get_seat_info, max_gap_within, sort_seats
from app.service import ai_matching_service
from app.store import waitlist_store as store

logger = logging.getLogger(__name__)

# 대량 배분 국면으로 분기하는 좌석 수 기준 (명세 3.4)
BATCH_SEAT_THRESHOLD = 5
BATCH_REASON = "DEADLINE_BATCH"

# 국면 A(단건) 점수 가중치. 명세에 숫자가 고정된 두 곳 중 하나다.
ACCEPTANCE_WEIGHT = 0.6
SEQ_WEIGHT = 0.4

# 완전 탐색 안전장치. MVP 규모(좌석 <= 10, 대기자 <= 20)에서는 걸리지 않는다.
MAX_SEARCH_NODES = 200_000
MAX_COLLECTED_PLANS = 2_000

# 대량 배분에서 열거할 후보안 수와, 그중 LLM에 넘겨 최종 선택을 맡길 상위 개수
BATCH_PLAN_LIMIT = 20
BATCH_CANDIDATE_TOP_N = 5

# 대기자가 요청 인원을 명시하지 않았을 때의 기본값 (프롬프트 규칙과 동일)
DEFAULT_COUNT = 1


def _as_list(value) -> List[str]:
    """조건 값이 문자열 하나로 와도 리스트로 정규화한다.

    LLM이 grade를 "S"로 줄 때와 ["S"]로 줄 때가 섞이므로 여기서 흡수한다.
    """
    if value is None:
        return []
    if isinstance(value, (list, tuple, set)):
        return [str(v) for v in value]
    return [str(value)]


def _required_count(waiter: dict) -> int:
    """요청 인원. 언급이 없으면 1로 간주한다."""
    try:
        count = int(waiter.get("required", {}).get("count", DEFAULT_COUNT))
    except (TypeError, ValueError):
        return DEFAULT_COUNT
    return count if count > 0 else DEFAULT_COUNT


def _group_by_row(seats: List[str]) -> dict:
    """좌석을 (등급, 열)별로 묶는다. 연속·분리 판정은 같은 등급·열 안에서만 의미가 있다."""
    grouped: dict = {}
    for seat_id in seats:
        info = get_seat_info(seat_id)
        if info is None:
            continue  # 배치도에 없는 좌석은 조용히 무시한다
        grouped.setdefault((info["grade"], info["row"]), []).append(seat_id)
    for key in grouped:
        grouped[key] = sort_seats(grouped[key])
    return grouped


def find_blocks(seats: List[str], size: int) -> List[List[str]]:
    """풀린 좌석 중 연속 size개 묶음을 전부 반환한다."""
    if size <= 0:
        return []

    blocks: List[List[str]] = []
    for row_seats in _group_by_row(seats).values():
        if len(row_seats) < size:
            continue
        for start in range(len(row_seats) - size + 1):
            window = row_seats[start:start + size]
            if is_consecutive(window):
                blocks.append(window)
    return blocks


def find_split_combos(seats: List[str], size: int, max_gap: int) -> List[List[str]]:
    """분리 배정 가능 조합을 반환한다 (같은 열, 인접 간격 <= max_gap).

    간격 1(바로 옆자리)도 포함되므로 연석 묶음은 이 결과의 부분집합이다.
    """
    if size <= 0:
        return []

    combos: List[List[str]] = []
    for row_seats in _group_by_row(seats).values():
        if len(row_seats) < size:
            continue
        for combo in itertools.combinations(row_seats, size):
            gap = max_gap_within(list(combo))
            if gap is not None and gap <= max_gap:
                combos.append(list(combo))
    return combos


def is_feasible(waiter: dict, seats: List[str]) -> bool:
    """필수 조건만 검사한다. 선호는 여기서 보지 않는다.

    선호까지 여기서 거르면 후보가 남지 않아 표가 그냥 풀린다(명세 3.3).
    가격은 required.max_price("~이하")만 하드 필터로 쓴다. 좌석 등급에서 가격을 직접 읽는다.
    """
    required = waiter.get("required") or {}
    flexible = waiter.get("flexible") or {}

    # 1. 인원 수가 정확히 맞아야 한다
    if len(seats) != _required_count(waiter):
        return False

    infos = [get_seat_info(s) for s in seats]
    if any(info is None for info in infos):
        return False

    # 2. 필수 등급
    req_grades = _as_list(required.get("grade"))
    if req_grades and any(info["grade"] not in req_grades for info in infos):
        return False

    # 3. 필수 열
    req_rows = _as_list(required.get("row"))
    if req_rows and any(info["row"] not in req_rows for info in infos):
        return False

    # 4. 가격 하드캡("~이하"). 좌석 등급의 실제 가격과 개별 비교한다.
    #    preferred.max_price("~정도")와 flexible.price_ceiling은 여기서 쓰지 않는다.
    max_price = required.get("max_price")
    if max_price is not None:
        try:
            cap = int(max_price)
            if any(info["price"] > cap for info in infos):
                return False
        except (TypeError, ValueError):
            pass  # 값이 이상하면 가격 조건은 없는 것으로 본다

    # 5~6. 연석이 아니면 분리 허용 + 간격 제한을 통과해야 한다
    if not is_consecutive(seats):
        if not flexible.get("allow_split"):
            return False
        gap = max_gap_within(seats)
        if gap is None:
            return False  # 등급·열이 갈리는 분리는 허용하지 않는다
        try:
            max_split_gap = int(flexible.get("max_split_gap", 1))
        except (TypeError, ValueError):
            max_split_gap = 1
        if gap > max_split_gap:
            return False

    return True


def candidate_seat_sets(waiter: dict, seats: List[str]) -> List[List[str]]:
    """한 대기자가 받을 수 있는 좌석 조합 전부. 필수 조건만 적용한다."""
    count = _required_count(waiter)
    flexible = waiter.get("flexible") or {}

    if flexible.get("allow_split"):
        try:
            max_gap = int(flexible.get("max_split_gap", 1))
        except (TypeError, ValueError):
            max_gap = 1
        raw = find_split_combos(seats, count, max_gap)
    else:
        raw = find_blocks(seats, count)

    # find_* 는 등급/열/가격 필수 조건을 모르므로 여기서 최종 가부 판정을 한 번 더 건다
    return [combo for combo in raw if is_feasible(waiter, combo)]


def enumerate_plans(seats: List[str], waiters: List[dict], limit: int = 20) -> List[dict]:
    """대량 배분용. 서로 겹치지 않는 배분안을 열거한다.

    반환: [{"assignments": [{"user_id":.., "seats":[..]}], "satisfied": 2, "seq_sum": 8}]
    정렬: 만족 인원 내림차순 → 순번합 오름차순 (명세 3.4 국면 B의 1·2순위)
    """
    ordered_waiters = sorted(waiters, key=lambda w: w["seq"])
    # 대기자별 후보를 미리 계산해 두면 백트래킹이 훨씬 얕아진다
    candidates = {
        w["user_id"]: candidate_seat_sets(w, seats) for w in ordered_waiters
    }

    seq_of = {w["user_id"]: w["seq"] for w in ordered_waiters}

    plans: List[dict] = []
    nodes = 0

    def backtrack(index: int, used: frozenset, assignments: list) -> None:
        nonlocal nodes

        if nodes >= MAX_SEARCH_NODES or len(plans) >= MAX_COLLECTED_PLANS:
            return
        nodes += 1

        if index >= len(ordered_waiters):
            if assignments:
                plans.append({
                    "assignments": [
                        {"user_id": uid, "seats": list(s)} for uid, s in assignments
                    ],
                    "satisfied": len(assignments),
                    "seq_sum": sum(seq_of[uid] for uid, _ in assignments),
                })
            return

        waiter = ordered_waiters[index]

        # 이 대기자에게 배정하는 가지
        for combo in candidates[waiter["user_id"]]:
            combo_set = frozenset(combo)
            if combo_set & used:
                continue
            assignments.append((waiter["user_id"], combo))
            backtrack(index + 1, used | combo_set, assignments)
            assignments.pop()

        # 이 대기자를 건너뛰는 가지 (전체 만족 인원이 더 커질 수 있다)
        backtrack(index + 1, used, assignments)

    backtrack(0, frozenset(), [])

    if nodes >= MAX_SEARCH_NODES:
        logger.warning(f"[Matching] 탐색 노드 상한 도달 - nodes: {nodes}, 부분 결과로 진행")

    # 좌석 집합이 같은 중복안 제거
    unique: dict = {}
    for plan in plans:
        key = tuple(sorted(
            (a["user_id"], tuple(sort_seats(a["seats"]))) for a in plan["assignments"]
        ))
        if key not in unique:
            unique[key] = plan

    result = sorted(unique.values(), key=lambda p: (-p["satisfied"], p["seq_sum"]))
    return result[:limit]


def seq_bonus(waiter: dict, total_waiters: int) -> float:
    """순번가점 = 1 - (내순번 - 1) / 전체대기자수.

    수락가능성만으로 뽑으면 조건을 느슨하게 쓴 사람이 항상 이기고 까다롭게 쓴 사람은
    영원히 못 받는다. 공정성 보정이다(명세 3.4).
    """
    if total_waiters <= 0:
        return 1.0
    bonus = 1.0 - (waiter["seq"] - 1) / total_waiters
    return max(0.0, min(1.0, bonus))


# ---------------------------------------------------------------------------
# 오케스트레이션 (명세 4.6)
# ---------------------------------------------------------------------------

async def on_seats_released(course_id: int, seats: List[str], reason: str = "SINGLE") -> dict:
    """취소로 좌석이 풀렸을 때의 진입점.

    좌석 규모에 따라 두 국면으로 분기한다. 우선순위 규칙이 서로 다르기 때문이다.
    - 단건 산발(좌석 < 5): 한 자리를 '누구에게' 줄지 선택하는 문제
    - 대량 일괄(좌석 >= 5 또는 DEADLINE_BATCH): 여러 자리를 '어떻게 나눌지' 배분하는 문제
    """
    seats = sort_seats([s for s in seats if get_seat_info(s) is not None])
    if not seats:
        logger.warning("[Matching] 배치도에 없는 좌석만 들어와 매칭을 건너뜁니다")
        return {"matched": 0, "offers": [], "reason": "유효한 좌석이 없습니다", "mode": "NONE"}

    waiters = store.get_waiters(course_id)
    if not waiters:
        return {"matched": 0, "offers": [], "reason": "대기자가 없습니다", "mode": "NONE"}

    # 이미 제안을 받아 응답을 기다리는 사람은 중복 배정하지 않는다
    waiters = [w for w in waiters if not store.has_pending_offer(course_id, w["user_id"])]
    if not waiters:
        return {"matched": 0, "offers": [], "reason": "모든 대기자가 이미 제안을 받았습니다", "mode": "NONE"}

    if reason == BATCH_REASON or len(seats) >= BATCH_SEAT_THRESHOLD:
        return await _batch_allocate(course_id, seats, waiters)
    return await _single_offer(course_id, seats, waiters)


async def _single_offer(course_id: int, seats: List[str], waiters: List[dict]) -> dict:
    """국면 A — 단건 산발. 점수 = 수락가능성 * 0.6 + 순번가점 * 0.4"""
    feasible = [w for w in waiters if is_feasible(w, seats)]
    if not feasible:
        # 좌석은 그냥 풀린 상태로 남는다. 없는 조건을 완화해서 억지로 밀어넣지 않는다.
        logger.info(f"[Matching] 필수 조건 통과자 없음 - seats: {seats}")
        return {
            "matched": 0,
            "offers": [],
            "reason": "필수 조건을 만족하는 대기자가 없습니다",
            "mode": "SINGLE",
        }

    # 선호 항목별 가중치는 두지 않는다. 원문 전체를 LLM에 넘겨 한 번에 판단하게 한다.
    acceptance = await ai_matching_service.estimate_acceptance(seats, feasible)

    total = len(waiters)
    scored = []
    for waiter in feasible:
        entry = acceptance.get(waiter["user_id"]) or {}
        accept_score = entry.get("score", ai_matching_service.ACCEPTANCE_FALLBACK_SCORE)
        bonus = seq_bonus(waiter, total)
        score = accept_score * ACCEPTANCE_WEIGHT + bonus * SEQ_WEIGHT
        scored.append({
            "waiter": waiter,
            "acceptance": round(accept_score, 3),
            "acceptance_reason": entry.get("reason", ""),
            "seq_bonus": round(bonus, 3),
            "score": round(score, 4),
        })

    # 동점이면 순번이 빠른 사람이 앞
    scored.sort(key=lambda s: (-s["score"], s["waiter"]["seq"]))
    winner = scored[0]
    waiter = winner["waiter"]

    message = await ai_matching_service.compose_offer_message(seats, waiter)
    pick_reason = _explain_single_pick(waiter, winner, waiters)

    offer = store.create_offer(
        user_id=waiter["user_id"],
        course_id=course_id,
        seats=seats,
        message=message,
        reason=pick_reason,
    )

    logger.info(
        f"[Matching] 단건 배정 - userId: {waiter['user_id']}, seq: {waiter['seq']}, "
        f"score: {winner['score']}"
    )
    return {
        "matched": 1,
        "offers": [offer],
        "reason": pick_reason,
        "mode": "SINGLE",
        "debug": [
            {
                "user_id": s["waiter"]["user_id"],
                "seq": s["waiter"]["seq"],
                "acceptance": s["acceptance"],
                "seq_bonus": s["seq_bonus"],
                "score": s["score"],
            }
            for s in scored
        ],
    }


def _explain_single_pick(waiter: dict, scored_entry: dict, all_waiters: List[dict]) -> str:
    """선정 이유. AI가 준 수락가능성 근거에 점수 계산 내역을 붙인다.

    "왜 순번 1번이 아닌가"가 이 기능의 핵심이므로 밀린 순번을 반드시 언급한다.
    """
    skipped = [w["seq"] for w in all_waiters if w["seq"] < waiter["seq"]]
    head = f"순번 {waiter['seq']}번 대기자에게 배정했습니다."
    if skipped:
        head += (
            f" 앞 순번({', '.join(str(s) for s in skipped)}번)은 "
            f"필수 조건 불일치 또는 점수 미달로 제외됐습니다."
        )

    ai_reason = (scored_entry.get("acceptance_reason") or "").strip()
    if ai_reason:
        head += f" {ai_reason}"

    return (
        f"{head} (수락가능성 {scored_entry['acceptance']} × {ACCEPTANCE_WEIGHT} + "
        f"순번가점 {scored_entry['seq_bonus']} × {SEQ_WEIGHT} = {scored_entry['score']})"
    )


async def _batch_allocate(course_id: int, seats: List[str], waiters: List[dict]) -> dict:
    """국면 B — 대량 일괄. 1순위 만족 인원 최대화, 2순위 순번합 최소."""
    plans = enumerate_plans(seats, waiters, limit=BATCH_PLAN_LIMIT)
    if not plans:
        logger.info(f"[Matching] 배분 가능한 안이 없음 - seats: {seats}")
        return {
            "matched": 0,
            "offers": [],
            "reason": "필수 조건을 만족하는 배분안이 없습니다",
            "mode": "BATCH",
        }

    chosen, plan_reason = await ai_matching_service.decide_batch_plan(
        plans[:BATCH_CANDIDATE_TOP_N], waiters
    )

    by_id = {w["user_id"]: w for w in waiters}
    offers = []
    for assignment in chosen["assignments"]:
        waiter = by_id.get(assignment["user_id"])
        if waiter is None:
            continue
        assigned = sort_seats(assignment["seats"])
        message = await ai_matching_service.compose_offer_message(assigned, waiter)
        offers.append(
            store.create_offer(
                user_id=waiter["user_id"],
                course_id=course_id,
                seats=assigned,
                message=message,
                reason=plan_reason,
            )
        )

    logger.info(
        f"[Matching] 대량 배정 - 만족 인원: {chosen['satisfied']}, 순번합: {chosen['seq_sum']}"
    )
    return {
        "matched": len(offers),
        "offers": offers,
        "reason": plan_reason,
        "mode": "BATCH",
        "debug": [
            {"satisfied": p["satisfied"], "seq_sum": p["seq_sum"], "assignments": p["assignments"]}
            for p in plans[:BATCH_CANDIDATE_TOP_N]
        ],
    }


