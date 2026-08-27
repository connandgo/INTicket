// Gateway가 비로그인 공연 조회를 401로 막는 동안 사용하는 공개 카탈로그입니다.
// 로그인하면 course-service의 실시간 데이터로 전환됩니다. 아래 값은 MariaDB MVP
// 시드(init-db/01_init.sql)와 맞춰 로그인 전후에 공연 정보가 달라지지 않게 합니다.

const makeCourse = (id, title, category, price, count, capacity, description) => ({
  id,
  title,
  category,
  price,
  enrollmentCount: count,
  capacity,
  description,
  instructorId: 2,
  status: 'ACTIVE',
  createdAt: `2026-08-${String(19 + id).padStart(2, '0')}T04:00:00`
})

export const SHOWCASE = [
  makeCourse(1, '뮤지컬 오페라의 유령', 'BACKEND', 150000, 842, 842,
    '일시 2026.09.12(토) 19:30\n장소 블루스퀘어 신한카드홀\n관람시간 160분(인터미션 20분 포함)\n관람등급 14세 이상\n\n파리 오페라 하우스 지하에 사는 유령과 젊은 소프라노의 이야기.'),
  makeCourse(2, '연극 고도를 기다리며', 'FRONTEND', 60000, 317, 320,
    '일시 2026.09.19(토) 20:00\n장소 LG아트센터 서울\n관람시간 120분(인터미션 없음)\n관람등급 14세 이상\n\n나무 한 그루와 돌 하나, 네 명의 배우가 기다림으로 채우는 무대.'),
  makeCourse(3, '말러 교향곡 제2번 부활', 'DATA_SCIENCE', 100000, 521, 900,
    '일시 2026.09.26(토) 20:00\n장소 롯데콘서트홀\n관람시간 95분(인터미션 없음)\n관람등급 초등학생 이상\n\n대편성 오케스트라와 합창단, 오르간이 함께하는 장대한 피날레.'),
  makeCourse(4, 'THE FIRST LIGHT 콘서트', 'DEVOPS', 132000, 1204, 1204,
    '일시 2026.10.03(토) 18:00\n장소 KSPO DOME\n관람시간 150분\n관람등급 8세 이상\n\n빛과 밴드 사운드가 어우러지는 단독 콘서트.'),
  makeCourse(5, '뮤지컬 레미제라블', 'BACKEND', 140000, 678, 1000,
    '일시 2026.09.13(일) 14:00\n장소 샤롯데씨어터\n관람시간 175분(인터미션 20분 포함)\n관람등급 8세 이상\n\n바리케이드 회전 무대와 웅장한 라이브 오케스트라가 함께합니다.'),
  makeCourse(6, '연극 한여름 밤의 꿈', 'FRONTEND', 45000, 132, 400,
    '일시 2026.09.13(일) 15:00\n장소 예술의전당 자유소극장\n관람시간 145분\n관람등급 8세 이상\n\n셰익스피어의 숲을 현대적으로 재해석한 로맨틱 코미디.'),
  makeCourse(7, '베토벤 피아노 협주곡 전곡', 'DATA_SCIENCE', 88000, 94, 500,
    '일시 2026.10.10(토) 17:00\n장소 예술의전당 콘서트홀\n관람시간 130분(인터미션 20분 포함)\n관람등급 초등학생 이상\n\n한 무대에서 만나는 베토벤 피아노 협주곡의 정수.')
]

const grade = (name, price, capacity, sold) => ({ grade: name, price, capacity, sold })
const round = (id, date, weekday, time, grades) => ({ id, date, weekday, time, grades })

const SHOWCASE_ROUNDS = {
  1: [
    round(101, '2026-09-12', '토', '19:30:00', [grade('VIP', 240000, 106, 106), grade('R', 150000, 105, 105), grade('S', 102000, 105, 105), grade('A', 68000, 105, 105)]),
    round(102, '2026-09-13', '일', '14:00:00', [grade('VIP', 240000, 106, 106), grade('R', 150000, 105, 105), grade('S', 102000, 105, 105), grade('A', 68000, 105, 105)])
  ],
  2: [
    round(201, '2026-09-19', '토', '20:00:00', [grade('VIP', 96000, 40, 40), grade('R', 60000, 40, 40), grade('S', 41000, 40, 40), grade('A', 27000, 40, 40)]),
    round(202, '2026-09-20', '일', '15:00:00', [grade('VIP', 96000, 40, 40), grade('R', 60000, 40, 40), grade('S', 41000, 40, 39), grade('A', 27000, 40, 38)])
  ],
  3: [
    round(301, '2026-09-26', '토', '20:00:00', [grade('VIP', 160000, 113, 90), grade('R', 100000, 112, 75), grade('S', 68000, 112, 60), grade('A', 45000, 113, 45)]),
    round(302, '2026-09-27', '일', '17:00:00', [grade('VIP', 160000, 113, 82), grade('R', 100000, 112, 68), grade('S', 68000, 112, 56), grade('A', 45000, 113, 45)])
  ],
  4: [
    round(401, '2026-10-03', '토', '18:00:00', [grade('VIP', 211000, 151, 151), grade('R', 132000, 150, 150), grade('S', 90000, 150, 150), grade('A', 59000, 151, 151)]),
    round(402, '2026-10-04', '일', '17:00:00', [grade('VIP', 211000, 151, 151), grade('R', 132000, 150, 150), grade('S', 90000, 150, 150), grade('A', 59000, 151, 151)])
  ],
  5: [
    round(501, '2026-09-13', '일', '14:00:00', [grade('VIP', 224000, 125, 112), grade('R', 140000, 125, 97), grade('S', 95000, 125, 79), grade('A', 63000, 125, 51)]),
    round(502, '2026-09-15', '화', '19:30:00', [grade('VIP', 224000, 125, 109), grade('R', 140000, 125, 94), grade('S', 95000, 125, 76), grade('A', 63000, 125, 60)])
  ],
  6: [
    round(601, '2026-09-13', '일', '15:00:00', [grade('VIP', 72000, 50, 28), grade('R', 45000, 50, 21), grade('S', 31000, 50, 11), grade('A', 20000, 50, 6)]),
    round(602, '2026-09-20', '일', '15:00:00', [grade('VIP', 72000, 50, 27), grade('R', 45000, 50, 20), grade('S', 31000, 50, 11), grade('A', 20000, 50, 8)])
  ],
  7: [
    round(701, '2026-10-10', '토', '17:00:00', [grade('VIP', 141000, 63, 20), grade('R', 88000, 62, 15), grade('S', 60000, 62, 8), grade('A', 40000, 63, 4)]),
    round(702, '2026-10-11', '일', '17:00:00', [grade('VIP', 141000, 63, 18), grade('R', 88000, 62, 14), grade('S', 60000, 62, 10), grade('A', 40000, 63, 5)])
  ]
}

export function findShowcase(id) {
  return SHOWCASE.find((course) => String(course.id) === String(id)) || null
}

export function showcaseRounds(id) {
  return (SHOWCASE_ROUNDS[String(id)] || []).map((item) => ({
    ...item,
    grades: item.grades.map((itemGrade) => ({ ...itemGrade }))
  }))
}
