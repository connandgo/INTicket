// 로그인 전에 보여주는 공연 카탈로그.
//
// 게이트웨이 정책상 GET /api/courses 도 인증을 요구해서(API_SPEC 2절),
// 로그인하지 않으면 목록이 통째로 비어 "로그인하세요" 안내만 뜬다.
// 예매 사이트는 둘러보는 것까지는 로그인 없이 되어야 하므로,
// 비로그인 상태에서는 이 내장 목록을 보여준다.
//
// 로그인하면 곧바로 서버 데이터로 교체된다. 그래서 여기 값은 실제 DB에
// 넣어 둔 공연과 같게 맞춰 두었다 — 로그인 전후로 목록이 달라 보이면
// 사용자가 혼란스럽기 때문이다.
//
// 근본 해결은 공연 조회를 공개 경로로 여는 것이고, 그건 백엔드 몫이다.

export const SHOWCASE = [
  {
    id: 2,
    title: '뮤지컬 오페라의 유령',
    category: 'BACKEND',
    price: 150000,
    capacity: 300,
    enrollmentCount: 298,
    instructorId: 3,
    status: 'ACTIVE',
    description:
      '일시  2026.09.12(금) 19:30\n장소  블루스퀘어 신한카드홀\n관람시간  160분 (인터미션 20분 포함)\n관람등급  14세 이상'
  },
  {
    id: 3,
    title: '뮤지컬 레미제라블',
    category: 'BACKEND',
    price: 140000,
    capacity: 250,
    enrollmentCount: 250,
    instructorId: 3,
    status: 'ACTIVE',
    description:
      '일시  2026.09.13(토) 14:00\n장소  샤롯데씨어터\n관람시간  175분 (인터미션 20분 포함)\n관람등급  8세 이상'
  },
  {
    id: 4,
    title: '연극 고도를 기다리며',
    category: 'FRONTEND',
    price: 60000,
    capacity: 200,
    enrollmentCount: 143,
    instructorId: 3,
    status: 'ACTIVE',
    description:
      '일시  2026.09.19(금) 20:00\n장소  LG아트센터 서울\n관람시간  120분 (인터미션 없음)\n관람등급  14세 이상'
  },
  {
    id: 5,
    title: '연극 한여름 밤의 꿈',
    category: 'FRONTEND',
    price: 45000,
    capacity: 180,
    enrollmentCount: 61,
    instructorId: 3,
    status: 'ACTIVE',
    description:
      '일시  2026.09.13(토) 15:00\n장소  예술의전당 자유소극장\n관람시간  145분\n관람등급  8세 이상'
  },
  {
    id: 6,
    title: 'THE FIRST LIGHT 콘서트',
    category: 'DEVOPS',
    price: 132000,
    capacity: 500,
    enrollmentCount: 500,
    instructorId: 3,
    status: 'ACTIVE',
    description:
      '일시  2026.10.03(토) 18:00\n장소  KSPO DOME\n관람시간  150분\n관람등급  8세 이상'
  },
  {
    id: 7,
    title: '한여름 밤의 재즈 페스티벌',
    category: 'DEVOPS',
    price: 88000,
    capacity: 400,
    enrollmentCount: 212,
    instructorId: 3,
    status: 'ACTIVE',
    description:
      '일시  2026.09.27(일) 17:00\n장소  올림픽공원 88잔디마당\n관람시간  240분\n관람등급  전체 관람가'
  },
  {
    id: 8,
    title: '말러 교향곡 제2번 부활',
    category: 'DATA_SCIENCE',
    price: 100000,
    capacity: 220,
    enrollmentCount: 219,
    instructorId: 3,
    status: 'ACTIVE',
    description:
      '일시  2026.09.26(토) 20:00\n장소  롯데콘서트홀\n관람시간  95분 (인터미션 없음)\n관람등급  초등학생 이상'
  },
  {
    id: 9,
    title: '베토벤 피아노 협주곡 전곡',
    category: 'DATA_SCIENCE',
    price: 88000,
    capacity: 300,
    enrollmentCount: 47,
    instructorId: 3,
    status: 'ACTIVE',
    description:
      '일시  2026.10.10(토) 17:00\n장소  예술의전당 콘서트홀\n관람시간  130분 (인터미션 20분 포함)\n관람등급  초등학생 이상'
  }
]

export function findShowcase(id) {
  return SHOWCASE.find((c) => String(c.id) === String(id)) || null
}
