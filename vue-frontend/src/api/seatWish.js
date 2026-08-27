import api from './index.js'
import * as local from '@/lib/wishParser.js'

// 좌석 희망사항 AI 파싱.
//
// 관람객이 "3명이서 붙어 앉고 싶고 앞쪽이면 좋겠어요. 15만원 이하로요" 같은
// 줄글을 쓰면, LLM 이 그걸 구조화된 조건으로 바꿔 준다.
//
// 팀 기능명세서 Sprint2 완료 기준:
//   자연어 입력이 필수 / 선호 / 양보가능 3단계로 분류된다
//   파싱 결과가 화면에 표시되고 사용자가 수정할 수 있다
//
// ── 백엔드에 요청할 계약 ─────────────────────────────────
// POST /api/recommend/seat-wish
//   { courseId, scheduleId, text }
//
// 응답:
// {
//   quantity: 3,                       // 매수. 못 읽었으면 null
//   grades: ["VIP","R"],               // 후보 등급. 언급 없으면 전체
//   maxPrice: 150000,                  // 1매 상한. 없으면 null
//   together: true,                    // 연석 희망. 언급 없으면 null
//   frontPreferred: true,              // 앞쪽 선호(true) / 뒤도 무방(false) / 미언급(null)
//   centerPreferred: true,
//   buckets: {                         // 화면에 그대로 뿌리는 3단계 분류
//     must:     [{ key, label, value }],   // 양보 불가
//     prefer:   [{ key, label, value }],   // 되도록
//     flexible: [{ key, label, value }]    // 양보 가능
//   },
//   unparsed: ["읽지 못한 문장"]        // 사용자가 직접 고치도록 노출
// }
// ────────────────────────────────────────────────────────
//
// LLM 이 붙기 전까지는 lib/wishParser.js 의 규칙 기반 파서가 같은 모양을 만든다.
// 백엔드가 위 계약대로 응답하면 이 파일의 fallback 만 지워진다.

const USE_REMOTE = import.meta.env.VITE_AI_SEAT_WISH === 'true'

// 파싱 결과로 보이는지 확인. 스텁이면 buckets 가 없다.
function looksParsed(d) {
  return d && typeof d === 'object' && d.buckets && Array.isArray(d.buckets.must)
}

function unwrap(res) {
  const d = res?.data
  return d && typeof d === 'object' && 'data' in d ? d.data : d
}

export const seatWishApi = {
  /** 자연어 → 조건. 실패하면 로컬 파서로 넘어간다. */
  async parse({ courseId, scheduleId, text }) {
    if (USE_REMOTE) {
      try {
        const data = unwrap(await api.post('/api/recommend/seat-wish', { courseId, scheduleId, text }))
        if (looksParsed(data)) return { ...data, source: 'AI_SERVICE' }
      } catch (e) {
        // AI 가 죽어도 예매 자체는 막히면 안 된다(장애 격리).
        console.warn('[seat-wish] AI 파싱 실패, 로컬 파서로 처리합니다:', e?.response?.status || e)
      }
    }
    // 살짝 기다려 분석 중이라는 느낌을 준다
    await new Promise((r) => setTimeout(r, 450))
    return { ...local.parseWish(text), source: 'LOCAL_PARSER' }
  },

  /** 조건에 맞는 좌석 등급 제안. 개별 좌석은 백엔드에 없어 등급 단위로 낸다. */
  match(round, wish) {
    return local.matchGrades(round, wish)
  }
}
