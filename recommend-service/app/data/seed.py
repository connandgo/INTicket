"""데모용 대기자 시드.

서버 시작 시 메모리에 주입한다. 이미 파싱된 상태로 박아두므로 LLM 호출이 없다
(발표 리허설마다 LLM을 호출하면 느리고 결과가 흔들린다).

raw_text는 estimate_acceptance가 '어조'를 읽는 재료이므로 사람이 실제로 쓸 법한
자연스러운 한국어 문장으로 채워둔다. 까다로운 어조와 유연한 어조를 일부러 섞었다.

데모 릴리즈 시나리오(직접 호출할 좌석 목록):
  courseId=1 (콘서트, 완전매진)
    - 단건:      POST /internal/released {"courseId":1,"seats":["S-Q-5"],"reason":"SINGLE"}
    - 대량(6석): POST /internal/released {"courseId":1,
                   "seats":["S-P-1","S-P-2","S-P-3","S-P-4","S-P-6","S-Q-1"],
                   "reason":"DEADLINE_BATCH"}
  courseId=2 (뮤지컬, 좋은 자리만 매진)
    - 단건:      POST /internal/released {"courseId":2,"seats":["R-D-5"],"reason":"SINGLE"}
    - 대량(5석): POST /internal/released {"courseId":2,
                   "seats":["R-D-1","R-D-2","R-D-3","R-D-4","R-D-6"],
                   "reason":"DEADLINE_BATCH"}
"""

import logging

from app.store import waitlist_store as store

logger = logging.getLogger(__name__)

# 콘서트(완전매진) / 뮤지컬(좋은 자리만 매진)
CONCERT_COURSE_ID = 1
MUSICAL_COURSE_ID = 2

# courseId=1 콘서트. S등급(102,000원) 기준이며 P열은 제외 대상, Q열이 실제 릴리즈되는 열이다.
CONCERT_WAITERS = [
    {
        # B(순번 1) — 순번 1인데 밀리는 케이스. "왜 순번대로 안 갔는지" 설명용
        "user_id": 2,
        "seq": 1,
        "raw_text": "저 혼자 가는데 S등급 P열 아니면 못 가요.",
        "parsed": {
            "required": {"grade": ["S"], "row": "P", "count": 1},
            "preferred": {},
            "flexible": {},
        },
    },
    {
        # C(순번 2) — 유연한 조건 → 단건 매칭 성사
        "user_id": 3,
        "seq": 2,
        "raw_text": "그냥 자리 있으면 아무 데나 좋은데, S등급이면 더 좋을 것 같아요.",
        "parsed": {
            "required": {"count": 1},
            "preferred": {"grade": ["S"]},
            "flexible": {},
        },
    },
    {
        # D(순번 3) — 1석 쪼개기 배정 대상
        "user_id": 4,
        "seq": 3,
        "raw_text": "혼자 가는데 무조건 S등급으로 부탁드려요.",
        "parsed": {
            "required": {"grade": ["S"], "count": 1},
            "preferred": {},
            "flexible": {},
        },
    },
    {
        # E(순번 4) — 분리 배정 케이스(간격 3까지 허용)
        "user_id": 5,
        "seq": 4,
        "raw_text": (
            "친구 3명이랑 같이 가는데 S등급으로 부탁드려요. "
            "붙어 앉으면 제일 좋지만 정 안 되면 3칸까지는 떨어져도 괜찮아요."
        ),
        "parsed": {
            "required": {"grade": ["S"], "count": 3},
            "preferred": {},
            "flexible": {"allow_split": True, "max_split_gap": 3},
        },
    },
    {
        # F(순번 5) — 2연석 요청. 대량 배분에서 연석 묶음을 차지하는 경쟁자
        "user_id": 6,
        "seq": 5,
        "raw_text": "친구랑 둘이 가는데 S등급 붙어있는 자리로 부탁드려요.",
        "parsed": {
            "required": {"grade": ["S"], "count": 2},
            "preferred": {"consecutive": True},
            "flexible": {},
        },
    },
    {
        # G(순번 6) — "10만원 정도"가 하드캡이 아니라 선호 + 양보 상한이라는 판별의 실증
        # S등급이 102,000원이라 희망가를 살짝 넘는다. "정도"라서 후보에 남아야 한다.
        "user_id": 7,
        "seq": 6,
        "raw_text": "S등급이면 좋겠고 10만원 정도 생각하고 있어요.",
        "parsed": {
            "required": {"count": 1},
            "preferred": {"grade": ["S"], "max_price": 100000},
            "flexible": {"price_ceiling": 110000},
        },
    },
    {
        # H(순번 7) — D와 같은 프로필의 경쟁자. 어조는 더 단정적이다
        "user_id": 8,
        "seq": 7,
        "raw_text": "무조건 S등급으로 주세요.",
        "parsed": {
            "required": {"grade": ["S"], "count": 1},
            "preferred": {},
            "flexible": {},
        },
    },
    {
        # I(순번 8) — 4석 분리 배정 케이스. E보다 간격 허용치가 좁다
        "user_id": 9,
        "seq": 8,
        "raw_text": (
            "친구 넷이서 같이 가는데 S등급으로 부탁드려요. "
            "다 붙어있으면 제일 좋지만 두 칸까지는 떨어져도 괜찮아요."
        ),
        "parsed": {
            "required": {"grade": ["S"], "count": 4},
            "preferred": {"consecutive": True},
            "flexible": {"allow_split": True, "max_split_gap": 2},
        },
    },
    {
        # J(순번 9) — A등급 전용. S등급 좌석이 풀려도 매칭되지 않는다
        "user_id": 10,
        "seq": 9,
        "raw_text": "A등급도 괜찮아요, 딱 한 자리만 있으면 돼요.",
        "parsed": {
            "required": {"grade": ["A"], "count": 1},
            "preferred": {},
            "flexible": {},
        },
    },
    {
        # K(순번 10) — 가장 유연한 어조. 순번은 꼴찌지만 수락가능성은 높다
        "user_id": 11,
        "seq": 10,
        "raw_text": "그냥 표만 구할 수 있으면 어디든 감사합니다. S등급이면 더 좋고요.",
        "parsed": {
            "required": {"count": 1},
            "preferred": {"grade": ["S"]},
            "flexible": {},
        },
    },
]


def _build_forecast_demo_waiters() -> list:
    """B2B 수요 분석 시연용 추가 대기자 75명을 만든다.

    기존 10명은 단건·대량 매칭 시나리오를 보존한다. 뒤에 붙는 75명은 실제
    waitlist_store에 같은 방식으로 주입되어 B2C 대기 데이터가 B2B 미충족
    수요 분석으로 이어지는 흐름을 보여준다.

    추가 요청 좌석 수는 115석(1석 40명, 2석 30명, 3석 5명)이다.
    기존 16석과 합쳐 courseId=1은 85명, 총 131석이 된다.
    """
    counts = [1] * 40 + [2] * 30 + [3] * 5
    texts = (
        "주말 저녁이면 좋고 자리는 어디든 괜찮아요.",
        "가능하면 S등급으로 보고 싶어요. 일정은 유연합니다.",
        "친구와 함께 갈 예정인데 붙어 있으면 좋겠습니다.",
        "공연만 볼 수 있으면 괜찮아요. 취소표 기다릴게요.",
        "토요일 오후나 저녁 회차를 선호합니다.",
    )
    waiters = []
    for index, count in enumerate(counts, start=11):
        preferred = {"grade": ["S"]} if index % 3 else {}
        flexible = {"allow_split": True, "max_split_gap": 3} if count > 1 else {}
        waiters.append({
            "user_id": 100 + index,
            "seq": index,
            "raw_text": texts[(index - 11) % len(texts)],
            "parsed": {
                "required": {"count": count},
                "preferred": preferred,
                "flexible": flexible,
            },
        })
    return waiters


CONCERT_WAITERS.extend(_build_forecast_demo_waiters())

# courseId=2 뮤지컬. VIP(240,000원)·R(150,000원) 등 좋은 자리만 매진된 상황이다.
MUSICAL_WAITERS = [
    {
        # L(순번 1) — 여기서도 순번 1이 밀린다. VIP A열 필수라 R석 릴리즈에 걸리지 않는다
        "user_id": 12,
        "seq": 1,
        "raw_text": "무조건 VIP A열이어야만 볼 의미가 있어요.",
        "parsed": {
            "required": {"grade": ["VIP"], "row": "A", "count": 1},
            "preferred": {},
            "flexible": {},
        },
    },
    {
        # M(순번 2) — 복수 등급 선호. 필수 조건이 없어 어떤 좌석이든 후보가 된다
        "user_id": 13,
        "seq": 2,
        "raw_text": "VIP나 R석이면 좋겠지만 안 되면 다른 자리도 괜찮아요.",
        "parsed": {
            "required": {"count": 1},
            "preferred": {"grade": ["VIP", "R"]},
            "flexible": {},
        },
    },
    {
        # N(순번 3) — 2연석. 분리 허용을 안 했으므로 반드시 붙은 자리여야 한다
        "user_id": 14,
        "seq": 3,
        "raw_text": "친구랑 둘이 가는데 R석으로 붙어서 보고 싶어요.",
        "parsed": {
            "required": {"grade": ["R"], "count": 2},
            "preferred": {"consecutive": True},
            "flexible": {},
        },
    },
    {
        # O(순번 4) — R석이 150,000원이라 희망가 140,000원을 넘는다.
        # "정도"이므로 하드캡이 아니고, price_ceiling 155,000 안에 들어 수락 가능하다
        "user_id": 15,
        "seq": 4,
        "raw_text": "R석으로 보고 싶은데 14만원 정도면 좋겠어요.",
        "parsed": {
            "required": {"grade": ["R"], "count": 1},
            "preferred": {"max_price": 140000},
            "flexible": {"price_ceiling": 155000},
        },
    },
    {
        # P(순번 5) — 가장 단호한 어조. 조건은 맞지만 수락가능성 평가에서 어조가 반영된다
        "user_id": 16,
        "seq": 5,
        "raw_text": "저 혼자 가는데 R석 아니면 그냥 안 갈래요, 무조건요.",
        "parsed": {
            "required": {"grade": ["R"], "count": 1},
            "preferred": {},
            "flexible": {},
        },
    },
]

SEED_WAITERS_BY_COURSE = {
    CONCERT_COURSE_ID: CONCERT_WAITERS,
    MUSICAL_COURSE_ID: MUSICAL_WAITERS,
}


# ---------------------------------------------------------------------------
# 나머지 공연 대기자
#
# 시드가 공연 1, 2 에만 있어서 다른 공연은 수요 분석이 전부 0 으로 나왔다.
# 매진된 공연에 대기자가 한 명도 없는 화면은 설명이 안 된다.
#
# 대기자 수는 판매율에서 만든다. 매진일수록 못 산 사람이 많이 남는다.
# 문장은 아래 표에서 돌려 쓰고 파싱 결과를 함께 박아 둔다.
# 시드 단계에서 LLM 을 부르지 않으려는 것이다(느리고 결과가 흔들린다).
# ---------------------------------------------------------------------------

# (정원, 판매) — course-service /api/courses 기준
OTHER_COURSES = {
    3: (250, 250),
    4: (200, 143),
    5: (180, 61),
    6: (500, 500),
    7: (400, 212),
    8: (220, 219),
    9: (300, 47),
}

PATTERNS = [
    ("혼자 가는데 자리만 나면 어디든 좋아요.", {"count": 1}, {}, {}),
    ("둘이 같이 갈 건데 붙어 앉고 싶어요.", {"count": 2}, {"consecutive": True}, {}),
    ("S석으로 한 자리만 부탁드립니다.", {"grade": ["S"], "count": 1}, {}, {}),
    ("R석이면 좋겠는데 예산은 15만원까지예요.",
     {"count": 1}, {"grade": ["R"]}, {"price_ceiling": 150000}),
    ("가족 세 명이서 갑니다. 정 안 되면 나눠 앉아도 괜찮아요.",
     {"count": 3}, {}, {"allow_split": True, "max_split_gap": 3}),
    ("앞쪽 자리면 좋겠어요. 뒤쪽이면 안 갈래요.", {"grade": ["VIP", "R"], "count": 1}, {}, {}),
    ("A석 두 장이요. 저렴한 자리면 됩니다.", {"grade": ["A"], "count": 2}, {}, {}),
    ("네 명인데 같은 열로 붙여 주세요.", {"count": 4}, {"consecutive": True}, {}),
]


def _waiter_count(capacity: int, sold: int) -> int:
    """판매율에서 대기자 수를 만든다.

    대기자는 거의 다 팔린 뒤부터 급격히 쌓인다. 자리가 남아 있으면 굳이
    대기를 걸지 않는다. 그래서 판매율을 6제곱해 곡선을 세운다.

    분석은 대기자 수에서 추가 회차 예상 관객을 만드는데(유효수요의 절반),
    대기자가 적으면 매진 공연인데도 추가 회차 예상이 몇 석으로 떨어진다.
    매진이면 정원의 1.4배가 대기로 남는 것으로 잡아 그 구간을 메운다.

      정원 250 매진      → 350명  → 추가 회차 예상 판매율 약 80%
      정원 220 · 219석 판매 → 300명  → 거의 매진이라 대기가 많다
      정원 300 ·  47석 판매 →   2명  → 자리가 남아 대기가 없다
    """
    rate = min(1.0, sold / capacity) if capacity else 0
    return max(2, round(capacity * 1.4 * (rate ** 6)))


def load_other_courses() -> int:
    """공연 3~9 의 대기자를 판매율에 맞춰 주입한다."""
    total = 0
    user_id = 1000
    for course_id, (capacity, sold) in OTHER_COURSES.items():
        count = _waiter_count(capacity, sold)
        for i in range(count):
            raw, required, preferred, flexible = PATTERNS[i % len(PATTERNS)]
            store.add_waiter(
                user_id=user_id,
                course_id=course_id,
                raw_text=raw,
                parsed={"required": required, "preferred": preferred, "flexible": flexible},
                seq=i + 1,
            )
            user_id += 1
        total += count
        logger.info(f"[Seed] 대기자 {count}명 주입 - courseId: {course_id}")
    return total


def load_seed() -> int:
    """시드 대기자를 저장소에 주입하고 총 주입 건수를 반환.

    대기 순번은 공연별로 따로 매긴다(콘서트 1~10번, 뮤지컬 1~5번).
    """
    total = 0
    for course_id, entries in SEED_WAITERS_BY_COURSE.items():
        for entry in entries:
            store.add_waiter(
                user_id=entry["user_id"],
                course_id=course_id,
                raw_text=entry["raw_text"],
                parsed=entry["parsed"],
                seq=entry["seq"],
            )
        total += len(entries)
        logger.info(f"[Seed] 대기자 {len(entries)}명 주입 - courseId: {course_id}")
    return total + load_other_courses()


def reset_to_seed() -> int:
    """저장소를 비우고 시드 상태로 되돌린다. 발표 리허설용."""
    store.reset()
    return load_seed()
