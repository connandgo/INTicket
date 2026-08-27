"""좌석 배치도 상수와 좌석 좌표 헬퍼.

⚠️ 열 이름은 등급 사이에서 겹친다(예: G열은 R등급에도 S등급에도 있다).
그래서 좌석 ID에 반드시 등급을 접두어로 넣어 유일성을 보장한다: "{등급}-{열}-{번호}" (예: "S-P-3")
"""

from typing import Optional

# 등급별 가격과 열 구성. rows의 값은 그 열의 좌석 수다.
GRADES = {
    "VIP": {"price": 240000, "rows": {"A": 20, "B": 20}},
    "R": {"price": 150000, "rows": {"D": 20, "E": 20, "F": 20, "G": 20, "H": 20, "J": 20}},
    "S": {
        "price": 102000,
        "rows": {
            "G": 20, "H": 20, "J": 20, "K": 20, "L": 20,
            "M": 20, "N": 20, "P": 20, "Q": 20, "R": 20,
        },
    },
    "A": {
        "price": 68000,
        "rows": {"K": 20, "L": 20, "M": 20, "N": 20, "P": 20, "Q": 20, "R": 20, "S": 20},
    },
}


def make_seat_id(grade: str, row: str, no: int) -> str:
    """좌석 ID 조립. 번호는 0을 채우지 않는다(S-P-3이지 S-P-03이 아니다)."""
    return f"{grade}-{row}-{no}"


def _build_seat_map() -> dict:
    """GRADES로부터 {등급: {열: [좌석ID, ...]}} 배치도를 생성한다."""
    seat_map: dict = {}
    for grade, info in GRADES.items():
        seat_map[grade] = {
            row: [make_seat_id(grade, row, no) for no in range(1, count + 1)]
            for row, count in info["rows"].items()
        }
    return seat_map


SEAT_MAP = _build_seat_map()


def _build_index() -> dict:
    """모듈 로드 시 1회만 만들어 두는 역인덱스. 좌석 조회를 O(1)"""
    index = {}
    for grade, rows in SEAT_MAP.items():
        price = GRADES[grade]["price"]
        for row, seats in rows.items():
            for position, seat_id in enumerate(seats, start=1):
                index[seat_id] = {
                    "grade": grade,
                    "row": row,
                    "no": position,  # 같은 열 안에서의 좌석 번호(1-based). 연속/간격 계산용
                    "price": price,
                    "seat_id": seat_id,
                }
    return index


SEAT_INDEX = _build_index()

# 등급별 유효한 열 이름. 조건 검증에 쓴다(VIP에는 K열이 없다).
ROWS_BY_GRADE = {grade: set(info["rows"].keys()) for grade, info in GRADES.items()}
# 어느 등급에든 존재하는 열 이름 전체
ALL_ROWS = {row for rows in ROWS_BY_GRADE.values() for row in rows}
ALL_GRADES = set(GRADES.keys())


def get_seat_info(seat_id: str) -> Optional[dict]:
    """좌석 ID로 {grade, row, no, price, seat_id} 조회. 배치도에 없으면 None."""
    return SEAT_INDEX.get(seat_id)


def is_valid_seat(seat_id: str) -> bool:
    """배치도에 존재하는 좌석인지 확인."""
    return seat_id in SEAT_INDEX


def get_price(seat_id: str) -> Optional[int]:
    """좌석이 속한 등급의 티켓 가격."""
    info = get_seat_info(seat_id)
    return info["price"] if info else None


def is_valid_grade_row(grade: str, row: str) -> bool:
    """등급과 열의 조합이 실재하는지. 예: ("VIP","K")는 없는 조합이다."""
    return row in ROWS_BY_GRADE.get(grade, set())


def _same_block(infos: list) -> bool:
    """모두 같은 등급 + 같은 열인지.

    등급이 다르면 열 이름이 같아도 다른 좌석이다(R-G-5와 S-G-6은 인접이 아니다).
    """
    return len({(i["grade"], i["row"]) for i in infos}) == 1


def is_consecutive(seats: list) -> bool:
    """같은 등급·같은 열이면서 번호가 빈틈없이 이어지는지 판정.

    좌석 0~1개는 연속으로 본다(단일 좌석에 '연석' 조건을 걸 이유가 없다).
    """
    if len(seats) <= 1:
        return True

    infos = [get_seat_info(s) for s in seats]
    if any(info is None for info in infos):
        return False
    if not _same_block(infos):
        return False

    numbers = sorted(i["no"] for i in infos)
    return all(numbers[k + 1] - numbers[k] == 1 for k in range(len(numbers) - 1))


def gap_between(seat_a: str, seat_b: str) -> Optional[int]:
    """같은 등급·같은 열이면 번호 차이(절댓값), 아니면 None.

    바로 옆자리는 1이다. '최대 분리 거리'는 이 값으로 비교한다.
    """
    info_a = get_seat_info(seat_a)
    info_b = get_seat_info(seat_b)
    if info_a is None or info_b is None:
        return None
    if not _same_block([info_a, info_b]):
        return None
    return abs(info_a["no"] - info_b["no"])


def max_gap_within(seats: list) -> Optional[int]:
    """정렬된 좌석들의 인접 간격 중 최댓값. 같은 등급·열이 아니면 None.

    is_feasible에서 flexible.max_split_gap 과 비교하는 값이다.
    """
    if len(seats) <= 1:
        return 0

    infos = [get_seat_info(s) for s in seats]
    if any(info is None for info in infos):
        return None
    if not _same_block(infos):
        return None

    numbers = sorted(i["no"] for i in infos)
    return max(numbers[k + 1] - numbers[k] for k in range(len(numbers) - 1))


def describe_seats(seats: list) -> str:
    """LLM 프롬프트와 안내문에 넣을 사람이 읽는 좌석 설명 문자열."""
    parts = []
    for seat_id in seats:
        info = get_seat_info(seat_id)
        if info is None:
            parts.append(seat_id)
        else:
            parts.append(
                f"{info['grade']}등급 {info['row']}열 {info['no']}번({seat_id}, "
                f"{info['price']:,}원)"
            )
    return ", ".join(parts)


def sort_seats(seats: list) -> list:
    """등급 → 열 → 번호 순 정렬. 조합 열거 결과를 안정적으로 만들기 위함."""
    grade_order = {grade: index for index, grade in enumerate(GRADES)}

    def key(seat_id: str):
        info = get_seat_info(seat_id)
        if info is None:
            return (len(grade_order), "~", 0)  # 배치도에 없는 좌석은 뒤로
        return (grade_order[info["grade"]], info["row"], info["no"])

    return sorted(seats, key=key)


def grade_summary() -> str:
    """LLM 프롬프트에 넣을 배치도 요약. 등급·가격·열 목록을 한 줄씩."""
    lines = []
    for grade, info in GRADES.items():
        rows = ", ".join(f"{row}열" for row in info["rows"])
        lines.append(f"- {grade}등급 ({info['price']:,}원): {rows} (각 열 1~20번)")
    return "\n".join(lines)
