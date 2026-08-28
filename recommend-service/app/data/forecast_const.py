"""B2B 수요 분석에서 쓰는 고정 상수와 데모 공연 프로필."""

# (요일 코드, 시간)별 추가 회차 선호도.
# 실서비스에서는 공연별 과거 판매 실적으로 대체할 값이다.
SLOT_WEIGHT = {
    ("SAT", "19:00"): 1.00,
    ("SAT", "14:00"): 0.90,
    ("SUN", "14:00"): 0.78,
    ("SUN", "19:00"): 0.72,
    ("FRI", "20:00"): 0.65,
    ("WED", "19:30"): 0.45,
}
DEFAULT_SLOT_WEIGHT = 0.50

DAY_LABELS = {
    "MON": "월",
    "TUE": "화",
    "WED": "수",
    "THU": "목",
    "FRI": "금",
    "SAT": "토",
    "SUN": "일",
}

# DB 스키마를 건드리지 않는 MVP라 공연 수요 분석에 필요한 최소 정보만 시드로 둔다.
# 현재 취소표 매칭 시드(course 1, 2)와 같은 공연 ID를 사용한다.
# 공연 목록은 init-db/02_dummy_data.sql 의 courses 와 같은 ID 를 쓴다.
# 여기 없는 ID 는 404 가 나고, 화면이 서버 분석 대신 추정치를 띄우게 된다.
# capacity 는 좌석 배치도 한 회차분(VIP 40 + R 120 + S 200 + A 160 = 520),
# sold 는 더미 enrollment_count 를 그 정원으로 자른 값이다.
FORECAST_COURSES = {
    1: {"title": "뮤지컬 오페라의 유령", "capacity": 520, "sold": 520},
    2: {"title": "연극 고도를 기다리며", "capacity": 520, "sold": 317},
    3: {"title": "말러 교향곡 제2번 부활", "capacity": 520, "sold": 520},
    4: {"title": "THE FIRST LIGHT 콘서트", "capacity": 520, "sold": 520},
    5: {"title": "뮤지컬 레미제라블", "capacity": 520, "sold": 520},
    6: {"title": "연극 한여름 밤의 꿈", "capacity": 520, "sold": 132},
    7: {"title": "베토벤 피아노 협주곡 전곡", "capacity": 520, "sold": 94},
}
