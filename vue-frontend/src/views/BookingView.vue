<template>
  <div>
    <AppHeader />

    <main class="narrow page">
      <div v-if="loading" class="load"><span class="spin"></span>예매 정보를 불러오는 중입니다</div>

      <div v-else-if="!c || !round" class="blank">
        <h3>회차를 찾을 수 없습니다</h3>
        <p>이미 종료되었거나 잘못된 주소입니다.</p>
        <router-link to="/courses" class="btn btn-line btn-sm" style="margin-top:14px">공연 목록으로</router-link>
      </div>

      <template v-else>
        <!-- 단계 -->
        <ol class="steps">
          <li :class="{ on: step === 1, done: step > 1 }">
            <span class="num">1</span>{{ fromOffer ? '좌석 배정' : '좌석 등급' }}
          </li>
          <li :class="{ on: step === 2, done: step > 2 }"><span class="num">2</span>선점 · 결제</li>
          <li :class="{ on: step === 3 }"><span class="num">3</span>완료</li>
        </ol>

        <!-- 공연 요약 -->
        <section class="summary">
          <div class="sm-poster"><PosterArt :id="c.id" :title="c.title" :genre="label" /></div>
          <div>
            <span class="bdg bdg-gray">{{ label }}</span>
            <h1 class="sm-ttl">{{ c.title }}</h1>
            <p class="sm-when num">{{ round.date.replaceAll('-', '.') }} ({{ round.weekday }}) {{ round.time }}</p>
          </div>
        </section>

        <!-- 1단계 · 등급/매수 -->
        <section v-if="step === 1" class="card-sec">
          <h2 class="stitle">좌석 배치</h2>
          <SeatMap
            :round="round"
            :grade="grade"
            :quantity="qty"
            :max="4"
            :selected-seats="selectedSeats"
            @pick="onSeatPick"
          />

          <h2 class="stitle mt">좌석 등급</h2>
          <ul class="grades">
            <li v-for="g in round.grades" :key="g.grade">
              <button
                type="button"
                class="gcard"
                :class="{ on: grade === g.grade, out: remaining(g) === 0 }"
                :disabled="remaining(g) === 0"
                @click="pick(g)"
              >
                <span class="gname">{{ g.grade }}석</span>
                <span class="gprice num">{{ g.price.toLocaleString() }}원</span>
                <span class="gleft num" :class="{ few: remaining(g) > 0 && remaining(g) <= 10 }">
                  {{ remaining(g) === 0 ? '매진' : `잔여 ${remaining(g)}석` }}
                </span>
              </button>
            </li>
          </ul>

          <h2 class="stitle mt">매수</h2>
          <div class="qty">
            <button
              v-for="n in 4" :key="n"
              type="button"
              class="qbtn"
              :class="{ on: qty === n }"
              :disabled="!picked || n > remaining(picked)"
              @click="setQuantity(n)"
            >{{ n }}매</button>
          </div>
          <p class="fhint">1회 최대 4매까지 예매할 수 있습니다.</p>

          <p v-if="err" class="alert alert-err">{{ err }}</p>

          <div class="total" v-if="picked">
            <span>결제 예정 금액</span>
            <b class="num">{{ (picked.price * qty).toLocaleString() }}원</b>
          </div>

          <button class="btn btn-red btn-lg btn-wide" :disabled="!picked || holding" @click="doHold">
            <span v-if="holding" class="spin spin-w"></span>{{ holding ? '선점 중' : '좌석 선점하기' }}
          </button>
          <p class="fhint">선점하면 잔여 수량이 즉시 줄어들고, {{ HOLD_MINUTES }}분 안에 결제해야 확정됩니다.</p>
        </section>

        <!-- 2단계 · 결제 -->
        <section v-else-if="step === 2" class="card-sec">
          <div class="timer" :class="{ urgent: left < 60 }">
            <span class="t-l">결제 마감까지</span>
            <span class="t-v num">{{ mmss }}</span>
          </div>

          <p v-if="fromOffer" class="alert alert-ok">
            취소표 매칭으로 <b>배정된 좌석</b>입니다. 등급을 다시 고를 필요 없이 결제만 하시면 됩니다.
          </p>

          <h2 class="stitle">결제 내역</h2>
          <dl class="dl">
            <div><dt>좌석 등급</dt><dd>{{ held.grade }}석</dd></div>
            <div v-if="held.seats?.length"><dt>선택 좌석</dt><dd>{{ held.seats.map(seatName).join(', ') }}</dd></div>
            <div><dt>매수</dt><dd class="num">{{ held.quantity }}매</dd></div>
            <div><dt>1매 가격</dt><dd class="num">{{ held.unitPrice.toLocaleString() }}원</dd></div>
            <div><dt>결제 금액</dt><dd><b class="amt num">{{ held.amount.toLocaleString() }}원</b></dd></div>
            <div><dt>결제 수단</dt><dd>모의 결제 <span class="small muted">실제 청구되지 않습니다</span></dd></div>
          </dl>

          <p v-if="err" class="alert alert-err">{{ err }}</p>

          <button class="btn btn-red btn-lg btn-wide" :disabled="paying" @click="doPay">
            <span v-if="paying" class="spin spin-w"></span>{{ paying ? '결제 처리 중' : `${held.amount.toLocaleString()}원 결제하기` }}
          </button>
          <button class="btn btn-ghost btn-wide" :disabled="paying" @click="cancelHold">선점 취소</button>
        </section>

        <!-- 3단계 · 완료 -->
        <section v-else class="card-sec done-sec">
          <div class="ok-mark">✓</div>
          <h2 class="done-h">예매가 접수되었습니다</h2>
          <p class="done-p">
            결제가 완료되면 예매 확정으로 바뀝니다. 상태는 내 예매에서 확인할 수 있습니다.
          </p>
          <dl class="dl">
            <div><dt>공연</dt><dd>{{ c.title }}</dd></div>
            <div><dt>회차</dt><dd class="num">{{ round.date.replaceAll('-', '.') }} ({{ round.weekday }}) {{ round.time }}</dd></div>
            <div><dt>좌석</dt><dd>{{ held.seats?.length ? held.seats.map(seatName).join(', ') : `${held.grade}석 ${held.quantity}매` }}</dd></div>
            <div><dt>결제 금액</dt><dd class="num">{{ held.amount.toLocaleString() }}원</dd></div>
          </dl>
          <div class="done-acts">
            <router-link to="/enrollments" class="btn btn-navy btn-lg">내 예매 확인</router-link>
            <router-link to="/courses" class="btn btn-line btn-lg">공연 더 보기</router-link>
          </div>
        </section>
      </template>
    </main>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import PosterArt from '@/components/PosterArt.vue'
import SeatMap from '@/components/SeatMap.vue'
import { useCourseStore } from '@/store/course.js'
import { performanceApi, remaining } from '@/api/performance.js'
import { bookingApi, isDuplicate } from '@/api/booking.js'
import { isSoldOutError } from '@/domain/soldout.js'
import { genreLabel } from '@/domain/genre.js'
import { HOLD_MINUTES } from '@/config/features.js'

const route = useRoute()
const store = useCourseStore()

const c = computed(() => store.current)
const label = computed(() => genreLabel(c.value?.category))

const round = ref(null)
const loading = ref(true)

const step = ref(1)
// 취소표 매칭에서 좌석을 배정받아 넘어왔는지. 화면 문구만 달라진다.
const fromOffer = ref(false)
const grade = ref('')
const qty = ref(1)
const selectedSeats = ref([])
const held = ref(null)
const err = ref('')
const holding = ref(false)
const paying = ref(false)

const picked = computed(() => round.value?.grades.find((g) => g.grade === grade.value) || null)

/* 선점 카운트다운 */
const left = ref(0)
let ticker = null

function startTimer(expiresAt) {
  stopTimer()
  const end = new Date(expiresAt).getTime()
  const tick = () => {
    left.value = Math.max(0, Math.round((end - Date.now()) / 1000))
    if (left.value === 0) expire()
  }
  tick()
  ticker = setInterval(tick, 1000)
}
function stopTimer() {
  if (ticker) clearInterval(ticker)
  ticker = null
}
const mmss = computed(() => {
  const m = Math.floor(left.value / 60)
  const s = left.value % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
})

onMounted(async () => {
  await store.fetchCourse(route.params.id)
  if (c.value) round.value = await performanceApi.round(c.value, route.query.round)
  // 자동 선점까지 끝낸 뒤에 화면을 연다. 먼저 열면 등급 선택 화면이 한 번
  // 깜빡였다가 결제 화면으로 바뀌어 보인다.
  await applyOfferSeats()
  loading.value = false
})

// 취소표 매칭으로 넘어온 경우(?seats=S-Q-5,S-Q-6) 자리가 이미 정해져 있다.
// 등급·매수를 다시 고르게 하지 않고 곧장 선점해서 결제 단계로 보낸다.
// 선점에 실패하면 fromOffer 를 되돌려 평소대로 1단계에서 고르게 둔다.
async function applyOfferSeats() {
  const raw = String(route.query.seats || '').trim()
  if (!raw || !round.value) return

  const seats = raw.split(',').map((x) => x.trim()).filter(Boolean)
  // 좌석 ID 는 "{등급}-{열}-{번호}" 형식이다 (recommend-service app/data/seats.py)
  const g = seats[0]?.split('-')[0]
  if (!g || !round.value.grades.some((x) => x.grade === g)) return

  fromOffer.value = true
  grade.value = g
  qty.value = Math.min(seats.length, 4)
  selectedSeats.value = seats

  await doHold()
  if (step.value !== 2) fromOffer.value = false
}

onBeforeUnmount(() => {
  stopTimer()
  // 결제 안 하고 화면을 벗어나면 선점을 풀어 준다
  if (step.value === 2 && held.value) releaseHeld()
})

// 배치도에서 자리를 누르면 등급·매수와 함께 화면용 좌석번호도 기억한다.
// 현재 백엔드는 등급·매수만 받으므로 좌석번호는 프론트 시연 정보로만 유지한다.
function onSeatPick({ grade: g, quantity: n, seats = [] }) {
  grade.value = g
  qty.value = n || 1
  selectedSeats.value = seats
  err.value = ''
}

function pick(g) {
  grade.value = g.grade
  selectedSeats.value = []
  if (qty.value > remaining(g)) qty.value = 1
  err.value = ''
}

function setQuantity(n) {
  qty.value = n
  // 매수 버튼으로 바꾸면 배치도가 해당 등급의 예매 가능 좌석을 다시 자동 표시한다.
  selectedSeats.value = []
}

async function doHold() {
  if (!picked.value) return
  holding.value = true
  err.value = ''
  try {
    const result = await bookingApi.hold(c.value, round.value.id, grade.value, qty.value)
    held.value = { ...result, seats: [...selectedSeats.value] }
    round.value = await performanceApi.round(c.value, route.query.round)
    step.value = 2
    startTimer(held.value.expiresAt)
  } catch (e) {
    console.error('[booking] 선점 실패:', e)
    err.value = e.message || '좌석을 선점하지 못했습니다.'
    round.value = await performanceApi.round(c.value, route.query.round)
  } finally {
    holding.value = false
  }
}

function seatName(seatId) {
  const [g, row, no] = String(seatId).split('-')
  return g && row && no ? `${g}석 ${row}열 ${no}번` : String(seatId)
}

function releaseHeld() {
  if (!held.value) return
  bookingApi.release(c.value.id, round.value.id, held.value.grade, held.value.quantity)
}

function expire() {
  stopTimer()
  if (step.value !== 2) return
  releaseHeld()
  held.value = null
  step.value = 1
  fromOffer.value = false
  err.value = '결제 시간이 지나 선점이 풀렸습니다. 다시 선택해 주세요.'
  performanceApi.round(c.value, route.query.round).then((r) => { round.value = r })
}

function cancelHold() {
  backToPick()
  err.value = ''
}

// 선점을 풀고 1단계로 되돌린다. held를 비워서 같은 선점이 두 번 반환되지 않게 한다.
function backToPick() {
  stopTimer()
  releaseHeld()
  held.value = null
  step.value = 1
  fromOffer.value = false
  performanceApi.round(c.value, route.query.round).then((r) => { round.value = r })
}

async function doPay() {
  paying.value = true
  err.value = ''
  try {
    await bookingApi.confirm(c.value, round.value.id, held.value)
    stopTimer()
    step.value = 3
  } catch (e) {
    console.error('[booking] 결제 실패:', e)
    if (isSoldOutError(e)) {
      // 결제 직전에 남이 채운 경우. 선점분을 돌려놓고 대기 등록을 안내한다.
      err.value = '방금 매진되었습니다. 공연 상세에서 취소표 대기를 걸어두시면 자리가 났을 때 자동으로 예매됩니다.'
      backToPick()
    } else if (isDuplicate(e)) {
      // 선점분을 돌려놓고 1단계로 되돌린다.
      // held를 비우지 않으면 사용자가 '선점 취소'를 눌렀을 때 같은 수량이
      // 두 번 복구되어 잔여 수량이 부풀어 오른다.
      err.value = '이미 예매하신 공연입니다. 같은 공연은 중복 예매할 수 없습니다.'
      backToPick()
    } else if (e.response?.status === 401) {
      // 선점 사이에 토큰이 만료되면 여기로 온다. 좌석은 물고 있어도 소용없으니 풀어 준다.
      err.value = '로그인이 만료되었습니다. 다시 로그인한 뒤 예매해 주세요.'
      backToPick()
    } else {
      err.value = e.response?.data?.message || '결제에 실패했습니다. 잠시 후 다시 시도해 주세요.'
    }
  } finally {
    paying.value = false
  }
}
</script>

<style scoped>
.steps { display: flex; gap: 6px; margin-bottom: 26px; }
.steps li {
  flex: 1;
  display: flex; align-items: center; gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: var(--r);
  font-size: 13px; font-weight: 600; color: var(--t3);
}
.steps .num {
  width: 20px; height: 20px; border-radius: 50%;
  display: grid; place-items: center;
  background: var(--bg-dim); color: var(--t3); font-size: 11px;
}
.steps li.on { border-color: var(--red); color: var(--red-dark); background: var(--red-wash); }
.steps li.on .num { background: var(--red); color: #fff; }
.steps li.done { color: var(--t2); }
.steps li.done .num { background: var(--navy); color: #fff; }

.summary { display: flex; gap: 16px; align-items: center; padding-bottom: 22px; border-bottom: 1px solid var(--line); margin-bottom: 26px; }
.sm-poster { width: 66px; border-radius: var(--r); overflow: hidden; flex-shrink: 0; }
.sm-ttl { font-size: 19px; font-weight: 800; letter-spacing: -0.05em; margin: 5px 0 2px; }
.sm-when { font-size: 13.5px; color: var(--t2); }

.card-sec { display: flex; flex-direction: column; gap: 12px; }
.stitle { margin-bottom: 4px; }
.mt { margin-top: 16px; }

.grades { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.gcard {
  width: 100%;
  display: flex; flex-direction: column; gap: 3px;
  padding: 13px 12px;
  border: 1px solid var(--line-dark);
  border-radius: var(--r);
  text-align: left;
  transition: border-color .15s var(--ease), background .15s var(--ease);
}
.gcard:hover:not(:disabled) { border-color: var(--t3); }
.gcard.on { border-color: var(--red); background: var(--red-wash); }
.gcard.out { opacity: .4; cursor: not-allowed; }
.gname { font-size: 14px; font-weight: 700; }
.gprice { font-size: 14px; font-weight: 600; }
.gleft { font-size: 11.5px; color: var(--t3); }
.gleft.few { color: var(--red); font-weight: 700; }

.qty { display: flex; gap: 6px; }
.qbtn {
  padding: 9px 18px;
  border: 1px solid var(--line-dark);
  border-radius: var(--r);
  font-size: 13.5px; font-weight: 600;
}
.qbtn:disabled { opacity: .35; cursor: not-allowed; }
.qbtn.on { background: var(--navy); border-color: var(--navy); color: #fff; }

.total {
  display: flex; justify-content: space-between; align-items: baseline;
  padding: 14px 16px;
  background: var(--bg-soft);
  border: 1px solid var(--line);
  border-radius: var(--r);
  font-size: 13.5px;
  margin-top: 6px;
}
.total b { font-size: 20px; font-weight: 800; color: var(--red); }

.timer {
  display: flex; justify-content: space-between; align-items: center;
  padding: 13px 16px;
  border: 1px solid var(--line-dark);
  border-radius: var(--r);
  background: var(--bg-soft);
}
.timer.urgent { border-color: var(--red); background: var(--red-wash); }
.t-l { font-size: 13px; color: var(--t2); font-weight: 600; }
.t-v { font-size: 22px; font-weight: 800; letter-spacing: -0.02em; }
.timer.urgent .t-v { color: var(--red); }

.amt { font-size: 18px; font-weight: 800; color: var(--red); }
.spin-w { border-color: rgba(255,255,255,.4); border-top-color: #fff; width: 15px; height: 15px; }

.done-sec { align-items: stretch; text-align: center; }
.ok-mark {
  width: 54px; height: 54px; margin: 10px auto 4px;
  display: grid; place-items: center;
  border-radius: 50%;
  background: var(--ok-wash); color: var(--ok);
  font-size: 26px; font-weight: 700;
}
.done-h { font-size: 21px; font-weight: 800; letter-spacing: -0.04em; }
.done-p { font-size: 13.5px; color: var(--t2); margin-bottom: 12px; }
.done-sec .dl { text-align: left; }
.done-acts { display: flex; gap: 8px; justify-content: center; margin-top: 8px; }

@media (max-width: 640px) {
  .grades { grid-template-columns: repeat(2, 1fr); }
  .steps li { font-size: 11.5px; padding: 8px; }
  .done-acts { flex-direction: column; }
}
</style>
