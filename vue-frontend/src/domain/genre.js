// 장르 매핑.
//
// 명세서 4.2 / R6: Course.Category enum(BACKEND, FRONTEND, …)은 Java·FastAPI·DB가
// 함께 쓰고 있어 건드리지 않는다. 화면에 보이는 장르 이름만 여기서 갈아끼운다.
// 기존 Vue가 쓰던 'DATA', 'AI' 같은 값은 백엔드에 없던 값이라 여기서 정리한다.

// MVP 등록 화면에 노출하는 4개
export const GENRES = [
  { code: 'BACKEND',      label: '뮤지컬' },
  { code: 'FRONTEND',     label: '연극' },
  { code: 'DEVOPS',       label: '콘서트' },
  { code: 'DATA_SCIENCE', label: '클래식' }
]

// 노출하지는 않지만 이미 저장된 데이터가 있을 수 있어 표시는 해 준다
const LEGACY = {
  MOBILE:   '기타',
  SECURITY: '기타',
  DATABASE: '기타',
  OTHER:    '기타'
}

const LABEL = Object.fromEntries(GENRES.map((g) => [g.code, g.label]))

export function genreLabel(code) {
  if (!code) return '기타'
  return LABEL[code] || LEGACY[code] || '기타'
}

export const GENRE_CODES = GENRES.map((g) => g.code)

// 필터 탭에 쓸 목록
export const GENRE_TABS = [{ code: 'ALL', label: '전체' }, ...GENRES]
