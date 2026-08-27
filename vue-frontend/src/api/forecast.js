import api from './index.js'
import * as model from '@/lib/demandModel.js'

// AI 수요 분석.
//
// 백엔드 엔드포인트는 이미 뚫려 있다:
//   GET /api/recommend/forecast/{courseId}
// 다만 아직 스텁이라 { courseId, message } 만 돌아온다.
// (recommend_router.py 주석: "응답 필드 구조도 AI 담당이 설계할 것")
//
// 그래서 화면이 기대하는 응답 모양을 프론트에서 먼저 정의하고,
// 스텁이 오면 로컬 추정치로 대체한다. AI 담당이 아래 모양대로 채워 주면
// 이 파일의 fallback 만 지워지고 화면은 그대로 동작한다.
//
// ── 기대하는 응답 모양 ──────────────────────────────────
// {
//   courseId, generatedAt,
//   excessDemand: {                       // ① 유효 초과수요
//     effectiveSeats,                     // 전환 가능성이 높은 수요(석)
//     level: { code, label },             // VERY_HIGH | HIGH | MEDIUM | LOW
//     waitingCount,                       // 취소표 대기자 수
//     requestedTickets,                   // 총 요청 티켓 수
//     ratioToSupply                       // 공급량 대비 배수 (1.92 = 192%)
//   },
//   extraShow: {                          // ② 추가 회차 전환수요
//     recommended: { weekday, time },
//     expectedAudience, expectedSeats, expectedRate,
//     verdict: { code, label }
//   },
//   momentum: {                           // ③ 수요 모멘텀·소멸
//     changeRate7d, direction,            // UP | DOWN | FLAT
//     current, forecast7d, state
//   },
//   trend: {                              // 차트
//     actual:   [{ date, value }],        // 실측
//     forecast: [{ date, value }]         // 예측 (첫 점은 actual 마지막과 동일)
//   },
//   candidates: [                         // 추가 회차 후보
//     { rank, weekday, time, expectedAudience, expectedSeats,
//       expectedRate, verdict: { code, label } }
//   ],
//   insights: [ "문장" ],
//   recommendation: "문장"
// }
// ────────────────────────────────────────────────────────

// 스텁 응답인지 판별한다. 실제 분석 결과에는 excessDemand 가 있다.
//
// aiEnabled 가 false 여도 서버가 폴백으로 계산한 정식 결과다. 오류가 아니므로
// 그대로 화면에 쓴다. 판단 기준은 오직 excessDemand 존재 여부다.
function isStub(d) {
  return !d || typeof d !== 'object' || !d.excessDemand
}

function unwrap(res) {
  const d = res?.data
  return d && typeof d === 'object' && 'data' in d ? d.data : d
}

export const forecastApi = {
  async analyze(course, waitingCount = null) {
    try {
      const res = await api.get(`/api/recommend/forecast/${course.id}`)
      const data = unwrap(res)
      if (!isStub(data)) return { ...data, source: 'AI_SERVICE' }
      // 스텁이면 로컬 추정으로 화면을 채운다
    } catch (e) {
      // recommend-service 가 죽어 있어도 이 화면은 떠야 한다(장애 격리).
      console.warn('[forecast] AI 분석을 받지 못해 로컬 추정으로 표시합니다:', e?.response?.status || e)
    }
    return model.analyze(course, waitingCount)
  },

  /**
   * 추가 회차 시뮬레이션.
   * POST /api/recommend/forecast/{courseId}/simulate  { date, time, capacity }
   *   → { day, dayLabel, time, expectedAudience, expectedSeats, capacity,
   *       expectedRate, conversionRate, verdict, comment, aiEnabled }
   */
  async simulate(course, analysis, { date, time, capacity }) {
    try {
      const res = await api.post(`/api/recommend/forecast/${course.id}/simulate`, {
        date,
        time,
        capacity: Number(capacity)
      })
      const d = unwrap(res)
      if (d && typeof d.expectedAudience === 'number') return { ...d, source: 'AI_SERVICE' }
    } catch (e) {
      console.warn('[forecast] 시뮬레이션 응답을 받지 못해 로컬 추정으로 표시합니다:', e?.response?.status || e)
    }
    return model.simulate(course, analysis, { seats: capacity })
  }
}
