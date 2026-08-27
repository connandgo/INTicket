<template>
  <div>
    <AppHeader />

    <main class="wrap page" v-if="course">
      <!-- 표제 -->
      <header class="head">
        <div>
          <h1 class="h-t">
            AI 수요 분석 결과
                      </h1>
          <p class="h-d">AI가 취소표 대기 및 사용자 행동 데이터를 기반으로 미충족 수요를 분석했습니다.</p>
        </div>
        <router-link to="/mypage" class="close" aria-label="닫기">✕</router-link>
      </header>

      <!-- 기획사는 자사 공연만 볼 수 있다. 주소로 남의 공연 id 를 넣어도 막는다. -->
      <div v-if="!loading && !isMine" class="blank">
        <h3>다른 기획사의 공연입니다</h3>
        <p>자사가 등록한 공연의 수요 분석만 확인할 수 있습니다.</p>
        <router-link to="/mypage" class="btn btn-line btn-sm" style="margin-top:14px">내 공연 목록으로</router-link>
      </div>

      <div v-else-if="loading" class="load"><span class="spin"></span>분석하는 중입니다</div>

      <template v-else-if="a && isMine">
        <!-- 서버가 응답하면(aiEnabled 가 false 여도 폴백 계산 결과) 이 안내는 뜨지 않는다 -->
        <p v-if="a.source !== 'AI_SERVICE'" class="alert alert-info src">
          <b>대기·판매 데이터</b>를 기준으로 산출한 결과입니다.
        </p>

        <!-- 상단 4칸 -->
        <section class="top">
          <!-- 분석 대상 -->
          <article class="card tgt">
            <h2 class="c-t">분석 대상 공연</h2>
            <div class="tgt-b">
              <div class="tgt-p"><PosterArt :id="course.id" :title="course.title" :genre="genre" /></div>
              <div>
                <p class="tgt-n">{{ a.courseTitle || course.title }}</p>
                <p class="tgt-m">{{ firstLine }}</p>
              </div>
            </div>
            <dl class="tgt-s">
              <div>
                <dt>예매 상태</dt>
                <dd>
                  <span class="bdg" :class="a.target.soldOut ? 'bdg-red' : 'bdg-ok'">
                    {{ a.target.soldOut ? 'SOLD OUT' : '판매 중' }}
                  </span>
                </dd>
              </div>
              <div><dt>전체 좌석</dt><dd class="num">{{ a.target.capacity ? a.target.capacity.toLocaleString() + '석' : '무제한' }}</dd></div>
              <div>
                <dt>판매 좌석</dt>
                <dd class="num">
                  {{ a.target.sold.toLocaleString() }}석
                  <span v-if="a.target.sellRate !== null" class="muted">({{ Math.round(a.target.sellRate * 100) }}%)</span>
                </dd>
              </div>
            </dl>
          </article>

          <!-- ① 유효 초과수요 -->
          <article class="card metric m-ai">
            <h2 class="m-t"><span class="m-n">①</span> 유효 초과수요 예측</h2>
            <p class="m-l">AI 추정 유효 초과수요</p>
            <p class="m-v">
              <b class="num">{{ a.excessDemand.effectiveSeats.toLocaleString() }}</b><em>석</em>
              <span class="bdg bdg-ai-solid m-b">{{ a.excessDemand.level.label }}</span>
            </p>
            <dl class="m-d">
              <div><dt>취소표 대기자</dt><dd class="num">{{ a.excessDemand.waitingCount.toLocaleString() }}명</dd></div>
              <div><dt>총 요청 티켓</dt><dd class="num">{{ a.excessDemand.requestedTickets.toLocaleString() }}석</dd></div>
              <div><dt>공급량 대비 추가수요</dt><dd class="num hi">{{ Math.round(a.excessDemand.ratioToSupply * 100) }}%</dd></div>
            </dl>
            <p class="m-f">＊ 실제 전환 가능성이 높은 유효 수요만 추정</p>
          </article>

          <!-- ② 추가 회차 전환수요 -->
          <article class="card metric m-blue">
            <h2 class="m-t"><span class="m-n">②</span> 추가 회차 전환수요 예측</h2>
            <p class="m-l">추천 회차 (AI)</p>
            <p class="m-v">
              <b>{{ a.extraShow.recommended.weekday }}요일</b>
              <span class="num rec-t">{{ a.extraShow.recommended.time }}</span>
              <span class="bdg bdg-blue m-b">추천</span>
            </p>
            <dl class="m-d">
              <div><dt>예상 판매량</dt><dd class="num">{{ a.extraShow.expectedAudience.toLocaleString() }} / {{ a.extraShow.expectedSeats.toLocaleString() }}석</dd></div>
              <div><dt>예상 판매율</dt><dd class="num">{{ Math.round(a.extraShow.expectedRate * 100) }}%</dd></div>
              <div><dt>AI 판단</dt><dd class="verdict">{{ a.extraShow.verdict.label }}</dd></div>
            </dl>
            <p class="m-f">＊ 현재 미충족 수요가 해당 회차에 전환될 확률</p>
          </article>

          <!-- ③ 수요 모멘텀 -->
          <article class="card metric m-green">
            <h2 class="m-t"><span class="m-n">③</span> 수요 모멘텀·소멸 예측</h2>
            <p class="m-l">최근 7일 유효수요 변화</p>
            <p class="m-v">
              <b class="num">{{ a.momentum.changeRate7d >= 0 ? '+' : '' }}{{ Math.round(a.momentum.changeRate7d * 100) }}%</b>
              <span class="arrow">{{ a.momentum.direction === 'UP' ? '↗' : a.momentum.direction === 'DOWN' ? '↘' : '→' }}</span>
              <span class="bdg bdg-ok m-b">{{ a.momentum.direction === 'UP' ? '상승 중' : a.momentum.direction === 'DOWN' ? '하락 중' : '보합' }}</span>
            </p>
            <dl class="m-d">
              <div><dt>현재 유효수요</dt><dd class="num">{{ a.momentum.current.toLocaleString() }}석</dd></div>
              <div><dt>7일 후 예상</dt><dd class="num">{{ a.momentum.forecast7d.toLocaleString() }}석</dd></div>
              <div><dt>수요 상태</dt><dd class="verdict ok">{{ a.momentum.state }}</dd></div>
            </dl>
            <p class="m-f">＊ 수요 증가/유지/감소 및 소멸 시점 예측</p>
          </article>
        </section>

        <!-- 중단: 차트 + 시뮬레이션 -->
        <section class="mid">
          <article class="card card-pad">
            <h2 class="s-t">수요 추세 및 AI 예측</h2>
            <DemandTrendChart :actual="a.trend.actual" :forecast="a.trend.forecast" />
            <p class="chart-note">
              최근 7일간 유효 잠재수요가
              <b>{{ a.momentum.changeRate7d >= 0 ? '' : '' }}{{ Math.round(a.momentum.changeRate7d * 100) }}%</b>
              {{ a.momentum.changeRate7d >= 0 ? '증가했습니다' : '감소했습니다' }}.
            </p>
          </article>

          <article class="card card-pad sim">
            <h2 class="s-t">추가 회차 시뮬레이션</h2>
            <p class="s-d">추가 회차 조건을 입력하면 AI가 예상 판매량을 분석합니다.</p>

            <div class="s-form">
              <div class="fld">
                <label class="flabel" for="s-date">날짜</label>
                <input id="s-date" v-model="sim.date" type="date" class="inp" />
              </div>
              <div class="fld">
                <label class="flabel" for="s-time">시간</label>
                <select id="s-time" v-model="sim.time" class="sel">
                  <option v-for="t in TIMES" :key="t" :value="t">{{ t }}</option>
                </select>
              </div>
              <div class="fld">
                <label class="flabel" for="s-seats">좌석 수</label>
                <div class="unit-wrap">
                  <input id="s-seats" v-model.number="sim.seats" type="number" min="1" step="100" class="inp" />
                  <span class="unit">석</span>
                </div>
              </div>
            </div>

            <button class="btn btn-ai btn-wide" :disabled="simming" @click="runSim">
              <span v-if="simming" class="spin spin-w"></span>{{ simming ? '분석 중' : 'AI 수요 예측' }}
            </button>

            <div v-if="simResult" class="s-out">
              <p class="s-o-t">예측 결과</p>
              <dl class="s-o-d">
                <div><dt>예상 관객</dt><dd class="num">{{ simResult.expectedAudience.toLocaleString() }}명</dd></div>
                <div><dt>예상 판매율</dt><dd class="num">{{ (simResult.expectedRate * 100).toFixed(1) }}%</dd></div>
                <div><dt>현재 유효수요 중 예상 전환율</dt><dd class="num">{{ (simResult.conversionRate * 100).toFixed(1) }}%</dd></div>
              </dl>
              <p v-if="simResult.comment" class="s-o-c">{{ simResult.comment }}</p>
              <p class="s-o-v"><span class="bdg bdg-ai">{{ simResult.verdict.label }}</span></p>
            </div>
          </article>
        </section>

        <!-- 하단: 후보 비교 + 인사이트 -->
        <section class="bot">
          <article class="card card-pad">
            <h2 class="s-t">추가 회차 후보 비교 <span class="s-sub">(AI 추천 순)</span></h2>
            <table class="cand">
              <thead>
                <tr><th>순위</th><th>회차</th><th class="r">예상 관객</th><th>예상 판매율</th><th class="r">종합 판단</th></tr>
              </thead>
              <tbody>
                <tr v-for="c in a.candidates" :key="c.rank">
                  <td class="rk" :class="{ top: c.rank === 1 }">{{ c.rank }}</td>
                  <td><b>{{ c.weekday }}요일</b> <span class="num">{{ c.time }}</span></td>
                  <td class="r num">{{ c.expectedAudience.toLocaleString() }}명</td>
                  <td>
                    <span class="bar"><i :style="{ width: c.expectedRate * 100 + '%' }"></i></span>
                    <span class="num br">{{ Math.round(c.expectedRate * 100) }}%</span>
                  </td>
                  <td class="r">
                    <span class="bdg" :class="c.rank === 1 ? 'bdg-ai-solid' : 'bdg-ai'">
                      {{ c.rank === 1 ? 'AI 추천' : c.verdict.label }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </article>

          <article class="card card-pad ins">
            <h2 class="s-t">AI 인사이트</h2>
            <ul class="ins-l">
              <li v-for="(t, i) in a.insights" :key="i">{{ t }}</li>
            </ul>
            <p class="ins-r">{{ a.recommendation }}</p>
          </article>
        </section>
      </template>
    </main>

    <main class="wrap page" v-else>
      <div class="blank">
        <h3>공연을 찾을 수 없습니다</h3>
        <router-link to="/mypage" class="btn btn-line btn-sm" style="margin-top:14px">마이페이지로</router-link>
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import PosterArt from '@/components/PosterArt.vue'
import DemandTrendChart from '@/components/DemandTrendChart.vue'
import { useCourseStore } from '@/store/course.js'
import { forecastApi } from '@/api/forecast.js'
import { genreLabel } from '@/domain/genre.js'
import { useAuthStore } from '@/store/auth.js'

const route = useRoute()
const store = useCourseStore()
const auth = useAuthStore()

const course = computed(() => store.current)
const genre = computed(() => genreLabel(course.value?.category))
// 자사 공연인지. 기획사 = 회사 단위라 남의 공연 데이터를 보면 안 된다.
const isMine = computed(
  () => !!course.value && String(course.value.instructorId) === String(auth.user?.id)
)
const firstLine = computed(() => (course.value?.description || '').split('\n')[0] || '일시·장소 미등록')

const a = ref(null)
const loading = ref(true)

const TIMES = ['14:00', '15:00', '17:00', '19:00', '19:30', '20:00']
const sim = reactive({ date: '', time: '19:00', seats: 1000 })
const simResult = ref(null)
const simming = ref(false)

onMounted(async () => {
  await store.fetchCourse(route.params.id)
  if (!course.value || !isMine.value) { loading.value = false; return }

  a.value = await forecastApi.analyze(course.value)

  // 시뮬레이션 기본값을 AI 추천값으로 채워 둔다
  const d = new Date()
  d.setDate(d.getDate() + 26)
  sim.date = d.toISOString().slice(0, 10)
  sim.time = a.value.extraShow.recommended.time
  sim.seats = a.value.extraShow.expectedSeats
  loading.value = false
})

async function runSim() {
  simming.value = true
  try {
    simResult.value = await forecastApi.simulate(course.value, a.value, {
      date: sim.date,
      time: sim.time,
      capacity: sim.seats
    })
  } finally {
    simming.value = false
  }
}
</script>

<style scoped>
.head { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; margin-bottom: 20px; }
.h-t { font-size: 24px; font-weight: 800; letter-spacing: -0.045em; display: flex; align-items: center; gap: 9px; }
.h-d { font-size: 13.5px; color: var(--t2); margin-top: 6px; }
.close { font-size: 20px; color: var(--t3); line-height: 1; padding: 4px; }
.close:hover { color: var(--t1); }
.src { margin-bottom: 18px; }
.src code { font-family: var(--num); font-size: 12px; }

/* 상단 4칸 */
.top { display: grid; grid-template-columns: 1.05fr 1fr 1fr 1fr; gap: 12px; margin-bottom: 16px; }
.card { background: #fff; }
.tgt { padding: 16px 18px; display: flex; flex-direction: column; gap: 12px; }
.c-t { font-size: 14px; font-weight: 700; letter-spacing: -0.03em; }
.tgt-b { display: flex; gap: 12px; align-items: flex-start; }
.tgt-p { width: 62px; border-radius: var(--r); overflow: hidden; flex-shrink: 0; }
.tgt-n { font-size: 15px; font-weight: 700; letter-spacing: -0.04em; line-height: 1.35; }
.tgt-m { font-size: 11.5px; color: var(--t3); margin-top: 4px; line-height: 1.5; }
.tgt-s { display: flex; gap: 0; border-top: 1px solid var(--line); padding-top: 10px; margin-top: auto; }
.tgt-s > div { flex: 1; padding-right: 8px; }
.tgt-s > div + div { border-left: 1px solid var(--line); padding-left: 10px; }
.tgt-s dt { font-size: 10.5px; color: var(--t3); margin-bottom: 4px; }
.tgt-s dd { font-size: 12.5px; font-weight: 600; }

.metric { padding: 16px 18px; display: flex; flex-direction: column; gap: 8px; border-width: 1px; }
.m-ai    { border-color: var(--ai-line); background: linear-gradient(180deg, var(--ai-wash) 0%, #fff 42%); }
.m-blue  { border-color: #D3E0FB; background: linear-gradient(180deg, var(--blue-wash) 0%, #fff 42%); }
.m-green { border-color: #C9E7D7; background: linear-gradient(180deg, var(--ok-wash) 0%, #fff 42%); }
.m-t { font-size: 13.5px; font-weight: 700; letter-spacing: -0.03em; display: flex; align-items: center; gap: 5px; }
.m-ai .m-t, .m-ai .m-n { color: var(--ai); }
.m-blue .m-t, .m-blue .m-n { color: var(--blue); }
.m-green .m-t, .m-green .m-n { color: var(--ok); }
.m-l { font-size: 11.5px; color: var(--t3); margin-top: 2px; }
.m-v { display: flex; align-items: baseline; gap: 7px; flex-wrap: wrap; }
.m-v b { font-size: 30px; font-weight: 800; letter-spacing: -0.05em; line-height: 1.1; }
.m-v em { font-style: normal; font-size: 14px; font-weight: 600; }
.m-ai .m-v b { color: var(--ai); }
.m-blue .m-v b { color: var(--blue); }
.m-green .m-v b { color: var(--ok); }
.rec-t { font-size: 26px; font-weight: 800; color: var(--blue); letter-spacing: -0.04em; }
.arrow { font-size: 18px; color: var(--ok); }
.m-b { align-self: center; }
.m-d { display: flex; flex-direction: column; gap: 5px; margin-top: 4px; padding-top: 9px; border-top: 1px solid var(--line); }
.m-d > div { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
.m-d dt { font-size: 11.5px; color: var(--t3); }
.m-d dd { font-size: 12.5px; font-weight: 600; }
.m-d dd.hi { color: var(--ai); font-weight: 700; }
.verdict { color: var(--blue); font-weight: 700; }
.verdict.ok { color: var(--ok); }
.m-f { font-size: 10.5px; color: var(--t4); margin-top: auto; padding-top: 6px; }

/* 중단 */
.mid { display: grid; grid-template-columns: 1.6fr 1fr; gap: 12px; margin-bottom: 16px; align-items: start; }
.s-t { font-size: 15px; font-weight: 700; letter-spacing: -0.035em; margin-bottom: 12px; }
.s-sub { font-size: 12px; font-weight: 500; color: var(--t3); }
.chart-note {
  margin-top: 12px; padding: 10px 12px;
  background: var(--ai-wash); border-radius: var(--r);
  font-size: 12.5px; color: var(--t2);
}
.chart-note b { color: var(--ai); font-weight: 700; }

.sim { display: flex; flex-direction: column; gap: 10px; }
.s-d { font-size: 12.5px; color: var(--t3); margin-top: -4px; }
.s-form { display: flex; flex-direction: column; gap: 10px; }
.unit-wrap { position: relative; }
.unit-wrap .unit { position: absolute; right: 11px; top: 50%; transform: translateY(-50%); font-size: 12px; color: var(--t3); }
.unit-wrap .inp { padding-right: 30px; }
.btn-ai { background: var(--ai); color: #fff; border-color: var(--ai); }
.btn-ai:hover:not(:disabled) { background: #5A38CC; border-color: #5A38CC; }
.spin-w { border-color: rgba(255,255,255,.4); border-top-color: #fff; width: 14px; height: 14px; }

.s-out { border: 1px solid var(--ai-line); border-radius: var(--r); padding: 13px 14px; background: var(--ai-wash); }
.s-o-t { font-size: 12.5px; font-weight: 700; color: var(--ai); margin-bottom: 9px; }
.s-o-d { display: flex; flex-direction: column; gap: 6px; }
.s-o-d > div { display: flex; justify-content: space-between; gap: 10px; align-items: baseline; }
.s-o-d dt { font-size: 11.5px; color: var(--t2); }
.s-o-d dd { font-size: 13px; font-weight: 700; }
.s-o-c {
  margin-top: 10px; padding-top: 9px;
  border-top: 1px solid var(--ai-line);
  font-size: 12.5px; color: var(--t2); line-height: 1.6;
}
.s-o-v { margin-top: 10px; text-align: center; }

/* 하단 */
.bot { display: grid; grid-template-columns: 1.6fr 1fr; gap: 12px; align-items: start; }
.cand { width: 100%; border-collapse: collapse; }
.cand th, .cand td { padding: 11px 8px; border-bottom: 1px solid var(--line); font-size: 13px; text-align: left; }
.cand th { font-size: 11.5px; color: var(--t3); font-weight: 600; border-bottom-color: var(--line-dark); }
.cand .r { text-align: right; }
.rk { font-size: 13px; color: var(--t3); font-family: var(--num); }
/* 1위는 이모지 대신 색과 굵기로 구분한다 */
.rk.top {
  color: var(--ai); font-weight: 800;
  position: relative; padding-left: 9px;
}
.rk.top::before {
  content: ''; position: absolute; left: 0; top: 50%;
  width: 3px; height: 13px; transform: translateY(-50%);
  background: var(--ai); border-radius: 1px;
}
.bar { display: inline-block; width: 130px; height: 8px; background: var(--bg-dim); border-radius: 5px; overflow: hidden; vertical-align: middle; }
.bar i { display: block; height: 100%; background: var(--ai); }
.br { font-size: 12px; margin-left: 8px; color: var(--t2); }

.ins { display: flex; flex-direction: column; }
.ins-l { display: flex; flex-direction: column; gap: 9px; }
.ins-l li { position: relative; padding-left: 13px; font-size: 12.5px; color: var(--t2); line-height: 1.65; }
.ins-l li::before { content: ''; position: absolute; left: 0; top: 8px; width: 4px; height: 4px; border-radius: 50%; background: var(--ai); }
.ins-r {
  margin-top: 14px; padding: 12px 14px;
  background: var(--ai-wash); border: 1px solid var(--ai-line); border-radius: var(--r);
  font-size: 13px; font-weight: 700; color: var(--ai); text-align: center; line-height: 1.6;
}

@media (max-width: 1100px) {
  .top { grid-template-columns: repeat(2, 1fr); }
  .mid, .bot { grid-template-columns: 1fr; }
}
@media (max-width: 620px) {
  .top { grid-template-columns: 1fr; }
  .cand .bar { width: 70px; }
}
</style>
