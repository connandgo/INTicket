"""①③ LLM 호출 담당.

역할 분담이 핵심이다.
- 좌표 계산·연속성 판정·조합 열거는 matching_service.py(규칙)가 한다. LLM에 맡기면 틀린다.
- 여기서는 '사람의 의도를 읽는 일'과 '설명하는 일'만 한다.

**모든 LLM 호출은 try/except로 감싸고 폴백을 둔다.**
AI가 죽어도 매칭은 순번 기준으로 동작해야 한다(MSA 실패 격리의 실증).

의존성을 늘리지 않기 위해 OpenAI SDK 대신 이미 있는 httpx로 REST를 직접 호출한다.
"""

import json
import logging
import re
from typing import List, Optional

import httpx

from app.config.settings import settings
from app.data.seats import (
    ALL_GRADES,
    ALL_ROWS,
    describe_seats,
    grade_summary,
    is_consecutive,
    is_valid_grade_row,
    max_gap_within,
)

logger = logging.getLogger(__name__)

# 프롬프트는 튜닝이 잦으므로 파일 상단에 상수로 모아둔다.
# ---------------------------------------------------------------------------

PARSE_SYSTEM_PROMPT = """너는 공연 예매 취소표 대기 시스템의 조건 해석기다.
관람객이 자연어로 쓴 좌석 희망 조건을 읽고 JSON으로 변환한다.

이 공연장의 좌석 배치는 아래가 전부다. grade와 row는 반드시 여기 있는 값만 쓴다.
{seat_layout}

- grade는 "VIP", "R", "S", "A" 중 하나다. "VIP석"→"VIP", "R석"→"R", "S등급"→"S", "A등급"→"A".
- row는 열 알파벳 한 글자다. "P열"→"P", "A열"→"A".
- 등급마다 있는 열이 다르다. 없는 조합은 만들지 마라(VIP에는 K열이 없다).
- "앞쪽", "무대 가까이", "1층", "2층" 같은 표현은 위 배치도로 옮길 수 없으면 조건으로 넣지 않는다.
- 등급 없이 열만 말하면 row만 넣는다. 반대도 마찬가지다.

조건을 세 단계로 분류한다.
- required(필수): 어기면 절대 안 되는 조건. 위반하면 후보에서 제외된다.
- preferred(선호): 맞으면 좋지만 양보할 수 있는 조건.
- flexible(양보가능): 관람객이 명시적으로 "포기할 수 있다"고 말한 것.

판별 규칙(중요):
- "10만원 이하", "10만원까지만" → required.max_price = 100000
- "10만원 정도", "10만원쯤", "10만원 선에서" → preferred.max_price = 100000 그리고
  flexible.price_ceiling = 실제로 양보 가능해 보이는 상한선 추정치(보통 희망가의 10~20% 위).
  이 경우 required.max_price 는 절대 넣지 마라. "정도"는 하드캡이 아니다.
  "10만원 정도"인 사람에게 102,000원 좌석을 제안할 수 있어야 하는데,
  required.max_price를 넣으면 그 사람이 후보에서 즉시 탈락해 표가 그냥 풀린다.
- "무조건 S등급", "반드시 R석", "VIP A열 아니면 안 감" → required.grade (+ 열을 말했으면 required.row)
- "S등급이면 좋겠어요", "VIP나 R석이면 좋고" → preferred.grade (복수면 ["VIP", "R"])
- "정 안 되면 나눠 앉아도 돼요", "떨어져 앉아도 괜찮아요" → flexible.allow_split = true,
  flexible.max_split_gap = 문장에서 읽히는 허용 간격(언급 없으면 3)
- "붙어 앉고 싶어요", "연석이면 좋겠어요" → preferred.consecutive = true
- "무조건 붙어 앉아야 해요" → required.consecutive = true

인원수(count) 규칙:
- required.count 는 항상 넣는다.
- 인원 언급이 전혀 없으면 required.count = 1 로 간주한다.
- "친구 3명이랑" 처럼 본인이 빠진 표현은 문맥에 맞게 총 인원으로 해석한다.

출력 필드 값 형식:
- grade: 등급 배열. 예: ["S"] 또는 ["VIP", "R"]
- row: 열 알파벳 배열. 예: ["P"]
- count: 정수
- max_price / price_ceiling: 원 단위 정수
- consecutive / allow_split: 불리언
- max_split_gap: 정수

절대 규칙:
- 언급이 없는 항목은 출력에 넣지 마라. 없는 조건을 지어내면 매칭이 막힌다.
  특히 연석(consecutive)과 가격(max_price)은 문장에 실제로 나올 때만 넣는다.
- "아무 데나", "어디든", "상관없어요"는 조건이 없다는 뜻이다.
  이럴 때 등급이나 열을 전부 나열하지 마라. 그냥 넣지 않는다.
- required에는 관람객이 "무조건", "아니면 못 간다", "~이하"처럼 단호하게 말한 것만 넣는다.
  조금이라도 여지를 둔 표현은 전부 preferred다.
- JSON만 출력한다. markdown 코드펜스나 설명 문장을 붙이지 마라.

출력 스키마:
{"required": {...}, "preferred": {...}, "flexible": {...}}"""

# 배치도는 GRADES 상수에서 생성해 주입한다(좌석표가 바뀌어도 프롬프트가 따라간다).
# .format()은 프롬프트 안의 JSON 예시 중괄호와 충돌하므로 쓰지 않는다.
PARSE_SYSTEM_PROMPT = PARSE_SYSTEM_PROMPT.replace("{seat_layout}", grade_summary())

PARSE_USER_TEMPLATE = """다음 문장을 위 규칙대로 JSON으로 변환하라.

문장: {text}"""

ACCEPTANCE_SYSTEM_PROMPT = """너는 공연 예매 취소표 매칭 시스템의 수락가능성 평가기다.
풀린 좌석 하나를 두고, 각 대기자가 그 좌석을 실제로 수락할 확률을 0~1로 평가한다.

이미 '필수 조건'은 코드가 검사해서 통과한 사람만 너에게 온다.
따라서 너는 가부를 다시 판정하지 않는다. **얼마나 기꺼이 받아들일지**만 본다.

판단 기준:
- 선호 조건 부합도: preferred에 적은 등급/열/연석/가격에 얼마나 가까운가
  (등급이 높을수록 비싸다: VIP 240,000원 > R 150,000원 > S 102,000원 > A 68,000원)
- 양보 범위 안인가: flexible에 적은 양보 상한(분리 간격, price_ceiling) 안에 드는가
- 원 문장의 어조: "아무 데나 좋아요"처럼 유연한가, "무조건 ~아니면 안 된다"처럼 까다로운가
  까다롭게 쓴 사람은 선호에서 벗어난 좌석을 거절할 확률이 높다

점수 기준선:
- 0.9~1.0: 선호까지 완전히 맞음. 거의 확실히 수락
- 0.6~0.8: 선호에서 조금 벗어나지만 어조가 유연해 받아들일 것으로 보임
- 0.3~0.5: 선호와 어긋나고 어조도 단호해 거절 가능성이 있음
- 0.0~0.2: 사실상 거절할 것으로 보임

JSON만 출력한다. 형식:
{"results": [{"user_id": 3, "score": 0.8}]}"""

ACCEPTANCE_USER_TEMPLATE = """제안 좌석: {seats_text}
좌석 구성: {seats_shape}

대기자 목록:
{waiters_text}

각 대기자의 수락가능성을 평가하라."""

MESSAGE_SYSTEM_PROMPT = """너는 공연 예매 취소표 배정 안내문을 쓰는 작성자다.
대기자에게 보낼 안내문을 한국어 2~3문장으로 쓴다.

포함할 것:
1. 어떤 좌석이 배정됐는지
2. 원 요청과 다른 점이 있으면 무엇이 다른지 (예: 요청한 연석이 아니라 두 칸 떨어짐)
3. 그럼에도 받을 만한 이유
4. 10분 내 결제 시 확정된다는 안내

금지:
- 과장 금지. "명당", "최고의 자리" 같은 데이터에 없는 사실을 지어내지 마라.
- 가격, 시야, 공연명 등 아래 정보에 없는 내용을 쓰지 마라.
- 순번은 언급하지 마라.
- 좌석 구성은 아래 "좌석 구성"에 적힌 그대로만 말한다.
  "단일 좌석"이면 연석·분리·간격 이야기를 절대 꺼내지 마라. 한 자리는 떨어질 것이 없다.
  간격을 말할 때도 아래에 적힌 칸 수만 쓰고 임의로 지어내지 마라.
- 대기자가 요청하지 않은 항목을 "요청과 다른 점"으로 쓰지 마라.

안내문 본문만 출력한다. 따옴표나 제목을 붙이지 마라."""

MESSAGE_USER_TEMPLATE = """배정 좌석: {seats_text}
좌석 구성: {seats_shape}
요청 인원: {count}명 (1명이면 연석·분리·간격은 아예 해당 사항이 없다)

대기자가 처음 적은 요청 원문: {raw_text}
파싱된 조건: 필수={required} / 선호={preferred} / 양보가능={flexible}

안내문을 써라."""

BATCH_SYSTEM_PROMPT = """너는 공연 예매 취소표 대량 배분의 최종 선택자다.
코드가 이미 가능한 배분안을 전부 만들어 우선순위대로 정렬해 줬다.
너는 새 조합을 만들지 않는다. 주어진 안 중 하나를 고르고 이유를 쓴다.

선택 우선순위(이 순서를 어기지 마라):
1순위: 만족 인원(satisfied)이 가장 많은 안
2순위: 동점이면 순번 합(seq_sum)이 작은 안
3순위: 그래도 동점이면 대기자들의 선호(연석 희망 등)에 더 잘 맞는 안

이유(reason)는 한국어 2~3문장으로 쓴다.
특히 앞 순번 대기자가 밀린 경우 왜 밀렸는지(전체 만족 인원을 늘리기 위한 트레이드오프)를 밝혀라.

JSON만 출력한다. 형식:
{"plan_index": 0, "reason": "..."}"""

BATCH_USER_TEMPLATE = """풀린 좌석: {seats_text}

대기자 정보:
{waiters_text}

후보 배분안:
{plans_text}

하나를 골라라."""

# ---------------------------------------------------------------------------

# 파싱 완전 실패 시 최소 폴백. 실제 폴백 경로에서는 아래 fallback_parse_condition으로
# 문장에 명시된 등급·인원도 보존한다.
PARSE_FALLBACK = {"required": {"count": 1}, "preferred": {}, "flexible": {}}

# 수락가능성 폴백값. 전원 같은 값이면 결국 순번만으로 결정된다.
ACCEPTANCE_FALLBACK_SCORE = 0.5

# LLM 호출이 막혔을 때도 가장 중요한 하드 조건은 잃지 않기 위한 최소 규칙이다.
# "R석 두개"처럼 명확한 요청이 조건 없이 1석으로 저장되면 다른 등급 좌석이
# 배정될 수 있으므로, 이 경우만큼은 LLM 없이도 결정적으로 읽어 낸다.
_KOREAN_COUNT = {
    "한": 1, "두": 2, "세": 3, "네": 4, "다섯": 5,
    "여섯": 6, "일곱": 7, "여덟": 8, "아홉": 9, "열": 10,
}
_COUNT_UNIT_PATTERN = r"(?:명|매|장|개|석|연석)"


def _fallback_count(text: str) -> int:
    """LLM 없이 문장에 직접 적힌 인원만 읽는다."""
    numeric = re.search(rf"(\d+)\s*{_COUNT_UNIT_PATTERN}", text)
    if numeric:
        return max(1, int(numeric.group(1)))

    korean = re.search(rf"({'|'.join(_KOREAN_COUNT)})\s*{_COUNT_UNIT_PATTERN}", text)
    if korean:
        return _KOREAN_COUNT[korean.group(1)]

    if "둘이" in text:
        return 2
    if "셋이" in text or "세명이" in text:
        return 3
    if "넷이" in text or "네명이" in text:
        return 4
    return DEFAULT_COUNT


def fallback_parse_condition(text: str) -> dict:
    """LLM 실패 시 명시적인 등급·인원·분리 허용만 보존하는 파서.

    선호의 뉘앙스까지 추측하지 않는다. 대신 사용자가 확실히 말한 R석, 2장 같은
    하드 조건을 지켜서 엉뚱한 등급으로 매칭되는 것을 막는다.
    """
    required = {"count": _fallback_count(text)}
    grades = []
    if re.search(r"VIP(?:\s*(?:등급|석))?", text, re.IGNORECASE):
        grades.append("VIP")
    for grade in ("R", "S", "A"):
        if re.search(rf"(?<![A-Za-z]){grade}\s*(?:등급|석)", text, re.IGNORECASE):
            grades.append(grade)
    if grades:
        required["grade"] = grades

    flexible = {}
    if any(phrase in text for phrase in ("떨어져 앉", "나눠 앉", "따로 앉")):
        flexible = {"allow_split": True, "max_split_gap": DEFAULT_SPLIT_GAP}

    return {"required": required, "preferred": {}, "flexible": flexible}


def fallback_message(seats: List[str]) -> str:
    """LLM 없이 쓰는 안내문 템플릿."""
    return (
        f"요청하신 조건에 맞는 좌석 {describe_seats(seats)}이(가) 나왔습니다. "
        f"10분 내 결제 시 확정됩니다."
    )


def fallback_batch_reason(plan: dict) -> str:
    """LLM 없이 쓰는 규칙 기반 배분 이유."""
    return (
        f"만족 인원 {plan['satisfied']}명(최대), 순번합 {plan['seq_sum']}(동점 시 최소)인 "
        f"배분안을 선택했습니다."
    )

# 파싱 결과에서 허용하는 키. LLM이 지어낸 키는 여기서 걸러낸다.
ALLOWED_REQUIRED_KEYS = {"count", "grade", "row", "max_price", "consecutive"}
ALLOWED_PREFERRED_KEYS = {"grade", "row", "max_price", "consecutive"}
ALLOWED_FLEXIBLE_KEYS = {"allow_split", "max_split_gap", "price_ceiling"}

# 배치도에 실재하는 등급·열 이름. LLM이 "1층" 같은 값을 주면 여기서 걸러낸다.
VALID_GRADES = ALL_GRADES
VALID_ROWS = ALL_ROWS

# 분리 허용 의사만 밝히고 간격을 말하지 않았을 때의 기본 간격
DEFAULT_SPLIT_GAP = 3
# 인원 언급이 없을 때의 기본 인원
DEFAULT_COUNT = 1

_FENCE_PATTERN = re.compile(r"^\s*```(?:json)?\s*|\s*```\s*$", re.IGNORECASE)


def strip_fence(text: str) -> str:
    """LLM 응답에 붙은 markdown 코드펜스를 제거한다.

    JSON만 출력하라고 지시해도 모델이 ```json 을 붙이는 경우가 있다.
    """
    if not text:
        return ""
    cleaned = _FENCE_PATTERN.sub("", text.strip())
    # 앞뒤에 잡설이 붙은 경우를 대비해 가장 바깥 중괄호 구간만 취한다
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end != -1 and end > start:
        return cleaned[start:end + 1]
    return cleaned.strip()


def is_llm_available() -> bool:
    """LLM 호출이 가능한 상태인지. False면 전부 폴백 경로로 동작한다."""
    return bool(settings.llm_enabled and settings.llm_api_key)


async def _call_llm(
    system_prompt: str,
    user_prompt: str,
    json_mode: bool = True,
    max_tokens: int = 800,
) -> Optional[str]:
    """OpenAI Chat Completions REST 호출. 실패하면 None을 반환한다(예외를 위로 던지지 않는다)."""
    if not is_llm_available():
        logger.info("[AI] LLM 비활성 상태 - 폴백 경로로 동작")
        return None

    body = {
        "model": settings.llm_model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0,  # 발표 리허설마다 결과가 흔들리면 안 된다
        "max_tokens": max_tokens,
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
            data = response.json()
            return data["choices"][0]["message"]["content"]
    except Exception as e:
        # 키·응답 본문이 로그에 남지 않도록 예외 타입과 메시지만 남긴다
        logger.warning(f"[AI] LLM 호출 실패 - 폴백 사용: {type(e).__name__}: {e}")
        return None


def _as_str_list(value, allowed: set = None) -> Optional[List[str]]:
    """grade/row 값을 문자열 리스트로 정규화. 빈 값이면 None.

    allowed를 주면 배치도에 없는 값은 버린다. 조건을 지어내는 것보다
    조건을 빠뜨리는 쪽이 안전하다(없는 조건은 매칭을 아예 막아버린다).
    """
    if value is None:
        return None
    if isinstance(value, str):
        value = [value]
    if not isinstance(value, (list, tuple, set)):
        return None
    items = [str(v).strip() for v in value if str(v).strip()]
    if allowed is not None:
        dropped = [i for i in items if i not in allowed]
        if dropped:
            logger.warning(f"[AI] 배치도에 없는 조건 값 무시: {dropped}")
        items = [i for i in items if i in allowed]
        # 가능한 값을 전부 나열한 건 조건이 아니라 "아무거나"라는 뜻이다.
        # 그대로 두면 선호 점수 계산에 잡음만 준다.
        if items and set(items) >= set(allowed):
            logger.warning("[AI] 전체 값을 나열한 조건은 무조건 아님으로 간주해 무시")
            return None
    return items or None


def _drop_impossible_grade_row(section: dict) -> None:
    """등급과 열의 조합이 실재하지 않으면 row를 버린다(제자리 수정).

    예: grade=["VIP"], row=["K"] 는 VIP에 K열이 없으므로 성립하지 않는다.
    조건을 지어내는 것보다 빠뜨리는 쪽이 안전하므로 더 좁은 쪽인 row를 버린다.
    """
    grades = section.get("grade")
    rows = section.get("row")
    if not grades or not rows:
        return

    valid_rows = [r for r in rows if any(is_valid_grade_row(g, r) for g in grades)]
    if valid_rows == rows:
        return

    dropped = [r for r in rows if r not in valid_rows]
    logger.warning(f"[AI] 등급 {grades}에 없는 열 조건 무시: {dropped}")
    if valid_rows:
        section["row"] = valid_rows
    else:
        section.pop("row", None)


def _as_int(value) -> Optional[int]:
    """정수로 변환 가능하면 정수, 아니면 None."""
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def normalize_parsed(raw: dict) -> dict:
    """LLM이 준 JSON을 검증·정규화한다.

    프롬프트 결과를 그대로 믿으면 필드 누락·타입 불일치로 매칭 로직이 터진다.
    허용 키만 남기고, 값 타입을 강제하고, count 기본값을 채운다.
    """
    if not isinstance(raw, dict):
        return dict(PARSE_FALLBACK)

    required_in = raw.get("required") if isinstance(raw.get("required"), dict) else {}
    preferred_in = raw.get("preferred") if isinstance(raw.get("preferred"), dict) else {}
    flexible_in = raw.get("flexible") if isinstance(raw.get("flexible"), dict) else {}

    required: dict = {}
    preferred: dict = {}
    flexible: dict = {}

    # required — 하드 조건. 잘못 들어가면 매칭이 막히므로 가장 엄격하게 거른다
    count = _as_int(required_in.get("count"))
    required["count"] = count if count and count > 0 else DEFAULT_COUNT

    for key, allowed in (("grade", VALID_GRADES), ("row", VALID_ROWS)):
        value = _as_str_list(required_in.get(key), allowed)
        if value:
            required[key] = value
    _drop_impossible_grade_row(required)

    max_price = _as_int(required_in.get("max_price"))
    if max_price is not None:
        required["max_price"] = max_price

    if isinstance(required_in.get("consecutive"), bool) and required_in["consecutive"]:
        required["consecutive"] = True

    # preferred — 필터링에 쓰지 않고 수락가능성 판단 재료로만 넘긴다
    for key, allowed in (("grade", VALID_GRADES), ("row", VALID_ROWS)):
        value = _as_str_list(preferred_in.get(key), allowed)
        if value:
            preferred[key] = value
    _drop_impossible_grade_row(preferred)

    pref_price = _as_int(preferred_in.get("max_price"))
    if pref_price is not None:
        preferred["max_price"] = pref_price

    if isinstance(preferred_in.get("consecutive"), bool):
        preferred["consecutive"] = preferred_in["consecutive"]

    # flexible — 필수 조건을 완화하는 근거
    if flexible_in.get("allow_split") is True:
        flexible["allow_split"] = True
        gap = _as_int(flexible_in.get("max_split_gap"))
        flexible["max_split_gap"] = gap if gap and gap > 0 else DEFAULT_SPLIT_GAP

    ceiling = _as_int(flexible_in.get("price_ceiling"))
    if ceiling is not None:
        flexible["price_ceiling"] = ceiling

    # 허용 키 밖의 것은 버린다
    required = {k: v for k, v in required.items() if k in ALLOWED_REQUIRED_KEYS}
    preferred = {k: v for k, v in preferred.items() if k in ALLOWED_PREFERRED_KEYS}
    flexible = {k: v for k, v in flexible.items() if k in ALLOWED_FLEXIBLE_KEYS}

    return {"required": required, "preferred": preferred, "flexible": flexible}


async def parse_condition(text: str) -> dict:
    """① 자연어 조건을 필수/선호/양보가능 3단계로 분류한다.

    폴백: 문장에 직접 적힌 등급·인원·분리 허용은 규칙으로 보존한다.
    """
    if not text or not text.strip():
        return dict(PARSE_FALLBACK)

    content = await _call_llm(
        PARSE_SYSTEM_PROMPT,
        PARSE_USER_TEMPLATE.format(text=text.strip()),
    )
    if content is None:
        result = fallback_parse_condition(text.strip())
        logger.info(f"[AI] 조건 파싱 LLM 폴백 - required: {result['required']}")
        return result

    try:
        parsed = json.loads(strip_fence(content))
    except (json.JSONDecodeError, TypeError) as e:
        logger.warning(f"[AI] 조건 파싱 JSON 디코드 실패 - 폴백 사용: {e}")
        result = fallback_parse_condition(text.strip())
        logger.info(f"[AI] 조건 파싱 규칙 폴백 - required: {result['required']}")
        return result

    result = normalize_parsed(parsed)
    logger.info(f"[AI] 조건 파싱 완료 - required: {result['required']}")
    return result


def _seats_shape(seats: List[str]) -> str:
    """좌석 구성을 한 줄로 설명. 연속/분리 판정은 코드가 한 결과를 넘겨줄 뿐이다."""
    if len(seats) <= 1:
        return "단일 좌석"
    if is_consecutive(seats):
        return f"{len(seats)}연석(모두 붙어 있음)"
    gap = max_gap_within(seats)
    if gap is None:
        return f"{len(seats)}석(열이 나뉜 분리 배정)"
    return f"{len(seats)}석 분리 배정(같은 열, 최대 {gap}칸 간격)"


def _waiter_brief(waiter: dict) -> str:
    """LLM 프롬프트에 넣을 대기자 한 명의 요약."""
    return (
        f"- user_id={waiter['user_id']}\n"
        f"  원문: \"{waiter.get('raw_text', '')}\"\n"
        f"  필수: {waiter.get('required') or {}}\n"
        f"  선호: {waiter.get('preferred') or {}}\n"
        f"  양보가능: {waiter.get('flexible') or {}}"
    )


async def estimate_acceptance(seats: List[str], waiters: List[dict]) -> dict:
    """③-a 각 대기자가 이 좌석을 실제로 수락할 확률을 0~1로 평가한다.

    반환: {user_id: {"score": float, "reason": str}}
    (명세의 dict[int, float]을 확장했다. 선정 이유를 사람이 읽을 수 있어야 하기 때문이다.)

    선호 항목 사이의 가중치는 일부러 두지 않는다. 등급 선호냐 가격 선호냐 연석 선호냐를
    규칙으로 채점하면 뉘앙스가 죽는다. 원문 전체를 통째로 넘겨 한 번에 판단하게 한다.

    폴백: 전원 0.5 (→ 순번만으로 결정된다)
    """
    fallback = {
        w["user_id"]: {"score": ACCEPTANCE_FALLBACK_SCORE, "reason": ""} for w in waiters
    }
    if not waiters:
        return {}

    content = await _call_llm(
        ACCEPTANCE_SYSTEM_PROMPT,
        ACCEPTANCE_USER_TEMPLATE.format(
            seats_text=describe_seats(seats),
            seats_shape=_seats_shape(seats),
            waiters_text="\n".join(_waiter_brief(w) for w in waiters),
        ),
    )
    if content is None:
        return fallback

    try:
        data = json.loads(strip_fence(content))
        results = data.get("results") if isinstance(data, dict) else None
        if not isinstance(results, list):
            raise ValueError("results 배열이 없습니다")
    except (json.JSONDecodeError, TypeError, ValueError) as e:
        logger.warning(f"[AI] 수락가능성 응답 해석 실패 - 폴백 사용: {e}")
        return fallback

    scores = dict(fallback)
    for item in results:
        if not isinstance(item, dict):
            continue
        user_id = _as_int(item.get("user_id"))
        if user_id is None or user_id not in scores:
            continue  # 대기자 목록에 없는 id를 지어낸 경우는 버린다
        try:
            score = float(item.get("score"))
        except (TypeError, ValueError):
            continue
        scores[user_id] = {
            "score": max(0.0, min(1.0, score)),  # 0~1 범위를 강제한다
            "reason": str(item.get("reason") or ""),
        }

    logger.info(
        f"[AI] 수락가능성 평가 완료 - {{uid: score}}: "
        f"{ {uid: v['score'] for uid, v in scores.items()} }"
    )
    return scores


async def compose_offer_message(seats: List[str], waiter: dict) -> str:
    """대기자에게 보낼 안내문.

    MVP 프론트에는 AI 설명문이 필요하지 않으므로 LLM을 호출하지 않는다.
    좌석 배정 결과와 결제 제한 시간만 담은 고정 템플릿을 내려준다.
    """
    return fallback_message(seats)


async def decide_batch_plan(plans: List[dict], waiters: List[dict]) -> tuple:
    """③-c 대량 배분에서 최종 배분안을 고른다.

    plans는 이미 만족인원·순번합으로 정렬돼 있다.
    MVP에서는 AI 설명이 필요하지 않으므로 LLM을 호출하지 않고 plans[0]을 사용한다.
    반환: (선택된 plan, 이유 문자열)
    """
    if not plans:
        return None, ""

    chosen = plans[0]
    logger.info(
        f"[Matching] 규칙 기반 대량 배분안 선택 - satisfied: {chosen['satisfied']}, "
        f"seq_sum: {chosen['seq_sum']}"
    )
    return chosen, fallback_batch_reason(chosen)
