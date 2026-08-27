"""B2B 수요 분석에서 LLM이 맡는 해석 작업.

숫자 계산은 forecast_service.py에서 끝낸 뒤 이 모듈에는 전환 가능성 평가와
문장 생성만 맡긴다. 모든 호출은 실패 시 폴백으로 끝나므로 분석 API가 500을
반환하지 않는다.
"""

import json
import logging
from typing import List, Tuple

import httpx

from app.config.settings import settings
from app.service.ai_matching_service import strip_fence

logger = logging.getLogger(__name__)

CONVERSION_SYSTEM_PROMPT = """너는 공연 취소표 대기 수요를 분석하는 데이터 분석가다.
각 대기자가 좌석을 제안받았을 때 실제 구매할 전환 가능성을 0~1로 평가한다.

판단 기준:
- 필수 조건이 많고 표현이 단호할수록 낮게 평가한다.
- 양보 가능 항목이 많고 유연한 표현일수록 높게 평가한다.
- 등록 후 경과일이 길수록 약간 낮게 평가한다.

JSON 객체만 출력한다. 키는 user_id 문자열, 값은 0~1 숫자다.
예: {"12": 0.82, "13": 0.35}"""

INSIGHT_SYSTEM_PROMPT = """너는 공연 예매 플랫폼의 데이터 분석가다.
아래 지표를 보고 기획사가 바로 실행할 수 있는 인사이트를 정확히 3개 작성하라.

규칙:
- 주어진 숫자만 사용하고 새로운 숫자를 만들지 말 것
- 미래 판매량을 단정하지 말고 '~로 추정됩니다' 형태를 사용할 것
- 데이터에 없는 사실을 지어내지 말 것
- 각 항목은 한 문장, 60자 이내
- JSON 문자열 배열만 출력할 것
"""

RECOMMENDATION_SYSTEM_PROMPT = """너는 공연 기획사의 수요 분석가다.
주어진 지표만 근거로 추가 회차 편성 권고를 한국어 한 문장으로 작성하라.
과장하거나 새로운 숫자를 만들지 마라. 문장만 출력하라."""

SIMULATION_SYSTEM_PROMPT = """너는 공연 추가 회차 수요 분석가다.
주어진 날짜, 시간, 예상 관객, 판매율만 근거로 한국어 한 문장 의견을 작성하라.
확정 표현 대신 '추정됩니다'를 사용하고 새로운 숫자는 만들지 마라."""


def is_llm_available() -> bool:
    return bool(settings.llm_enabled and settings.llm_api_key)


async def _call_llm(system_prompt: str, user_prompt: str, json_mode: bool = True) -> str | None:
    if not is_llm_available():
        return None

    body = {
        "model": settings.llm_model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0,
        "max_tokens": 600,
    }
    if json_mode:
        body["response_format"] = {"type": "json_object"}

    try:
        async with httpx.AsyncClient(timeout=settings.llm_timeout) as client:
            response = await client.post(
                settings.llm_api_url,
                headers={
                    "Authorization": f"Bearer {settings.llm_api_key}",
                    "Content-Type": "application/json",
                },
                json=body,
            )
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]
    except Exception as error:
        logger.warning("[ForecastAI] LLM 호출 실패 - 폴백 사용: %s: %s", type(error).__name__, error)
        return None


def _fallback_conversion(waiters: List[dict]) -> dict[int, float]:
    return {waiter["user_id"]: 0.5 for waiter in waiters}


async def estimate_conversion(waiters: List[dict]) -> Tuple[dict[int, float], bool]:
    """대기자별 실제 구매 전환 가능성을 평가한다."""
    fallback = _fallback_conversion(waiters)
    if not waiters:
        return fallback, is_llm_available()

    lines = []
    now = __import__("time").time()
    for waiter in waiters:
        elapsed_days = max(0, round((now - waiter.get("registered_at", now)) / 86400, 1))
        lines.append(
            f"user_id={waiter['user_id']}; 경과일={elapsed_days}; 원문={waiter.get('raw_text', '')}; "
            f"필수={waiter.get('required') or {}}; 선호={waiter.get('preferred') or {}}; "
            f"양보가능={waiter.get('flexible') or {}}"
        )

    content = await _call_llm(CONVERSION_SYSTEM_PROMPT, "\n".join(lines))
    if content is None:
        return fallback, False

    try:
        raw = json.loads(strip_fence(content))
        if not isinstance(raw, dict):
            raise ValueError("객체 응답이 아닙니다")
        scores = dict(fallback)
        for user_id in scores:
            value = raw.get(str(user_id), raw.get(user_id))
            scores[user_id] = max(0.0, min(1.0, float(value)))
        return scores, True
    except (TypeError, ValueError, json.JSONDecodeError) as error:
        logger.warning("[ForecastAI] 전환확률 응답 해석 실패 - 폴백 사용: %s", error)
        return fallback, False


def fallback_insights(metrics: dict) -> list[str]:
    return [
        f"최근 7일간 잠재수요가 {metrics['change_rate']:+.0%} 변했으며 {metrics['trend_label']} 추세입니다.",
        f"{metrics['best_weekday']}요일 {metrics['best_time']} 회차의 예상 판매율이 {metrics['best_rate']:.0%}로 가장 높게 추정됩니다.",
        f"현재 대기자 {metrics['waiting_count']}명이 총 {metrics['requested_tickets']}석을 요청하고 있습니다.",
    ]


async def generate_insights(metrics: dict) -> Tuple[list[str], bool]:
    fallback = fallback_insights(metrics)
    content = await _call_llm(
        INSIGHT_SYSTEM_PROMPT,
        "[지표]\n" + json.dumps(metrics, ensure_ascii=False),
        json_mode=False,
    )
    if content is None:
        return fallback, False
    try:
        items = json.loads(strip_fence(content))
        if not isinstance(items, list) or len(items) != 3 or not all(isinstance(item, str) for item in items):
            raise ValueError("문장 3개 배열이 아닙니다")
        return [item.strip()[:120] for item in items], True
    except (TypeError, ValueError, json.JSONDecodeError) as error:
        logger.warning("[ForecastAI] 인사이트 응답 해석 실패 - 폴백 사용: %s", error)
        return fallback, False


async def generate_recommendation(metrics: dict) -> Tuple[str, bool]:
    fallback = f"{metrics['best_weekday']}요일 {metrics['best_time']} 추가 회차 편성을 검토하는 것을 추천합니다."
    content = await _call_llm(
        RECOMMENDATION_SYSTEM_PROMPT,
        json.dumps(metrics, ensure_ascii=False),
        json_mode=False,
    )
    if not content or not content.strip():
        return fallback, False
    return content.strip().replace("\n", " ")[:160], True


async def generate_simulation_comment(metrics: dict) -> Tuple[str, bool]:
    fallback = (
        f"{metrics['day_label']}요일 {metrics['time']} 회차는 예상 판매율 "
        f"{metrics['expected_rate']:.0%} 수준으로 추정됩니다."
    )
    content = await _call_llm(
        SIMULATION_SYSTEM_PROMPT,
        json.dumps(metrics, ensure_ascii=False),
        json_mode=False,
    )
    if not content or not content.strip():
        return fallback, False
    return content.strip().replace("\n", " ")[:160], True
