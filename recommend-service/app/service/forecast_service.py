"""B2B 공연 수요 분석의 숫자 계산.

수요·증가율·회차별 예상 관객은 이 모듈에서 결정한다. LLM은 전환확률과
문장 생성만 보조하며, 실패해도 계산 결과는 항상 반환된다.
"""

from datetime import date, datetime, timedelta
import logging

from app.config.settings import settings
from app.data.demand_history import HISTORY_RATIOS
from app.data.forecast_const import DAY_LABELS, DEFAULT_SLOT_WEIGHT, FORECAST_COURSES, SLOT_WEIGHT
from app.client.course_client import course_client
from app.service import ai_forecast_service
from app.store import waitlist_store as store

logger = logging.getLogger(__name__)

WEEKDAY_CODES = ("MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN")


class ForecastCourseNotFound(Exception):
    """B2B 데모 공연 프로필에 없는 courseId 요청."""


def get_course_profile(course_id: int) -> dict:
    profile = FORECAST_COURSES.get(course_id)
    if profile is None:
        raise ForecastCourseNotFound(course_id)
    return profile


def _requested_count(waiter: dict) -> int:
    try:
        return max(1, int((waiter.get("required") or {}).get("count", 1)))
    except (TypeError, ValueError):
        return 1


def _level(ratio: float) -> dict:
    if ratio >= 0.30:
        return {"code": "HIGH", "label": "높음"}
    if ratio >= 0.10:
        return {"code": "MEDIUM", "label": "보통"}
    return {"code": "LOW", "label": "낮음"}


def _verdict(rate: float, rank: int | None = None) -> dict:
    if rank == 1:
        return {"code": "RECOMMEND", "label": "추가 회차 추천"}
    if rate >= 0.50:
        return {"code": "HIGH", "label": "높음"}
    if rate >= 0.20:
        return {"code": "MEDIUM", "label": "보통"}
    return {"code": "LOW", "label": "낮음"}


def _history(effective_seats: int) -> list[dict]:
    today = date.today()
    points = []
    for index, ratio in enumerate(HISTORY_RATIOS):
        day = today - timedelta(days=6 - index)
        points.append({"date": day.isoformat(), "value": round(effective_seats * ratio)})
    points.append({"date": today.isoformat(), "value": effective_seats})
    return points


def _forecast_from_history(actual: list[dict]) -> list[dict]:
    last = actual[-1]["value"]
    first = actual[0]["value"]
    daily_delta = (last - first) / max(1, len(actual) - 1)
    value = float(last)
    forecast = [dict(actual[-1])]
    current_day = date.fromisoformat(actual[-1]["date"])
    for offset in range(1, 8):
        value += daily_delta * (settings.forecast_decay ** offset)
        forecast.append({"date": (current_day + timedelta(days=offset)).isoformat(), "value": round(max(0, value))})
    return forecast


def _schedule_candidates(effective_seats: int, capacity: int) -> list[dict]:
    candidates = []
    for (day, time), weight in SLOT_WEIGHT.items():
        expected = min(capacity, round(effective_seats * weight * settings.conversion_retention))
        candidates.append({
            "weekday": DAY_LABELS[day],
            "day": day,
            "time": time,
            "expectedAudience": expected,
            "expectedSeats": capacity,
            "expectedRate": round(expected / capacity, 4) if capacity else 0.0,
        })
    # dict 선언 순서를 보존한다. 같은 예상 관객이면 토요일 19:00을 우선한다.
    candidates.sort(key=lambda item: -item["expectedAudience"])
    result = []
    for rank, candidate in enumerate(candidates[:4], start=1):
        candidate["rank"] = rank
        candidate["verdict"] = _verdict(candidate["expectedRate"], rank)
        result.append(candidate)
    return result


def _momentum_state(change_rate: float) -> tuple[str, str, str]:
    if change_rate > 0.05:
        return "UP", "상승", "상승 추세 지속 예상"
    if change_rate < -0.05:
        return "DOWN", "하락", "수요 감소 예상"
    return "FLAT", "보합", "보합 예상"


async def _live_profile(course_id: int) -> dict:
    """공연 제목·정원·예매수를 course-service 에서 읽는다.

    상수 표에 박아 두면 실제 예매가 늘어난 뒤부터 값이 어긋난다. 목록에는
    '2석 남음'인데 수요 분석은 매진이라고 말하는 일이 생긴다.
    조회에 실패하면 상수 표로 돌아간다(장애 격리).
    """
    fallback = get_course_profile(course_id)
    try:
        for course in await course_client.get_all_courses():
            if course.id != course_id:
                continue
            # 정원이 없는 공연은 매진이 없다. 분석은 한 회차 정원을 기준으로 한다.
            capacity = course.capacity or fallback["capacity"]
            return {
                "title": course.title,
                "capacity": capacity,
                "sold": min(course.enrollmentCount, capacity),
            }
    except Exception as error:  # noqa: BLE001 - 조회 실패는 분석을 막지 않는다
        logger.warning("[Forecast] 공연 정보 조회 실패 - 상수 표를 사용합니다: %s", error)
    return fallback


async def build_forecast(course_id: int) -> dict:
    """공연 하나의 B2B 수요 분석 결과를 조립한다."""
    profile = await _live_profile(course_id)
    capacity = profile["capacity"]
    sold = min(profile["sold"], capacity)
    waiters = store.get_waiters(course_id)
    conversion, conversion_ai = await ai_forecast_service.estimate_conversion(waiters)

    requested_tickets = sum(_requested_count(waiter) for waiter in waiters)
    effective_seats = round(sum(_requested_count(waiter) * conversion.get(waiter["user_id"], 0.5) for waiter in waiters))
    ratio = round(effective_seats / capacity, 4) if capacity else 0.0

    actual = _history(effective_seats)
    forecast = _forecast_from_history(actual)
    first = actual[0]["value"]
    change_rate = ((effective_seats - first) / first) if first else 0.0
    direction, trend_label, state = _momentum_state(change_rate)
    candidates = _schedule_candidates(effective_seats, capacity)
    best = candidates[0]

    metrics = {
        "effective_seats": effective_seats,
        "waiting_count": len(waiters),
        "requested_tickets": requested_tickets,
        "ratio_to_supply": ratio,
        "change_rate": change_rate,
        "trend_label": trend_label,
        "forecast_7d": forecast[-1]["value"],
        "best_weekday": best["weekday"],
        "best_time": best["time"],
        "best_rate": best["expectedRate"],
    }
    insights, insights_ai = await ai_forecast_service.generate_insights(metrics)
    recommendation, recommendation_ai = await ai_forecast_service.generate_recommendation(metrics)

    logger.info(
        "[Forecast] 분석 완료 - courseId: %s, waiters: %s, effective: %s",
        course_id, len(waiters), effective_seats,
    )
    return {
        "courseId": course_id,
        "courseTitle": profile["title"],
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "aiEnabled": conversion_ai and insights_ai and recommendation_ai,
        "target": {
            "capacity": capacity,
            "sold": sold,
            "sellRate": round(sold / capacity, 4) if capacity else None,
            "soldOut": sold >= capacity,
        },
        "excessDemand": {
            "effectiveSeats": effective_seats,
            "level": _level(ratio),
            "waitingCount": len(waiters),
            "requestedTickets": requested_tickets,
            "ratioToSupply": ratio,
        },
        "extraShow": {
            "recommended": {"weekday": best["weekday"], "time": best["time"]},
            "expectedAudience": best["expectedAudience"],
            "expectedSeats": capacity,
            "expectedRate": best["expectedRate"],
            "verdict": best["verdict"],
        },
        "momentum": {
            "changeRate7d": round(change_rate, 4),
            "direction": direction,
            "current": effective_seats,
            "forecast7d": forecast[-1]["value"],
            "state": state,
        },
        "trend": {"actual": actual, "forecast": forecast},
        "candidates": [
            {
                "rank": candidate["rank"],
                "weekday": candidate["weekday"],
                "time": candidate["time"],
                "expectedAudience": candidate["expectedAudience"],
                "expectedSeats": candidate["expectedSeats"],
                "expectedRate": candidate["expectedRate"],
                "verdict": candidate["verdict"],
            }
            for candidate in candidates
        ],
        "insights": insights,
        "recommendation": recommendation,
    }


async def simulate_forecast(course_id: int, simulation_date: str, time: str, capacity: int) -> dict:
    """기획사가 입력한 추가 회차 조건의 예상 판매량을 계산한다."""
    forecast = await build_forecast(course_id)
    try:
        parsed_date = date.fromisoformat(simulation_date)
    except ValueError:
        raise ValueError("date는 YYYY-MM-DD 형식이어야 합니다")

    day = WEEKDAY_CODES[parsed_date.weekday()]
    weight = SLOT_WEIGHT.get((day, time), DEFAULT_SLOT_WEIGHT)
    effective = forecast["excessDemand"]["effectiveSeats"]
    expected = min(capacity, round(effective * weight * settings.conversion_retention))
    expected_rate = round(expected / capacity, 4)
    comment_metrics = {
        "day_label": DAY_LABELS[day],
        "time": time,
        "expected_audience": expected,
        "expected_rate": expected_rate,
    }
    comment, comment_ai = await ai_forecast_service.generate_simulation_comment(comment_metrics)
    return {
        "day": day,
        "dayLabel": DAY_LABELS[day],
        "time": time,
        "expectedAudience": expected,
        "expectedSeats": capacity,
        "capacity": capacity,
        "expectedRate": expected_rate,
        "conversionRate": round(expected / effective, 4) if effective else 0.0,
        "verdict": _verdict(expected_rate),
        "comment": comment,
        "aiEnabled": forecast["aiEnabled"] and comment_ai,
    }
