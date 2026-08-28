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

# 실제 DB(course-service /api/courses)의 ID·제목·정원·예매수와 같은 값을 쓴다.
# init-db 의 더미 SQL 은 볼륨이 비어 있을 때만 실행돼서 지금 DB 와 다르다.
# 값이 어긋나면 목록의 매진 표시, 좌석 배치도 잔여석, 수요 분석 좌석 수가
# 서로 다른 숫자를 말하게 된다.
#
# id 1 코르티스는 취소표 매칭 데모용 공연이라 DB 에 정원이 없다(무제한).
# 수요 분석에서는 한 회차 정원 520석을 매진으로 두고 쓴다.
FORECAST_COURSES = {
    1: {"title": "코르티스", "capacity": 520, "sold": 520},
    2: {"title": "뮤지컬 오페라의 유령", "capacity": 300, "sold": 298},
    3: {"title": "뮤지컬 레미제라블", "capacity": 250, "sold": 250},
    4: {"title": "연극 고도를 기다리며", "capacity": 200, "sold": 143},
    5: {"title": "연극 한여름 밤의 꿈", "capacity": 180, "sold": 61},
    6: {"title": "THE FIRST LIGHT 콘서트", "capacity": 500, "sold": 500},
    7: {"title": "한여름 밤의 재즈 페스티벌", "capacity": 400, "sold": 212},
    8: {"title": "말러 교향곡 제2번 부활", "capacity": 220, "sold": 219},
    9: {"title": "베토벤 피아노 협주곡 전곡", "capacity": 300, "sold": 47},
}
