<template>
  <div>
    <AppHeader />

    <main class="wrap page">
      <div v-if="store.loading" class="load"><span class="spin"></span>공연 정보를 불러오는 중입니다</div>

      <div v-else-if="store.needsLogin" class="blank">
        <h3>로그인하면 공연 정보를 볼 수 있습니다</h3>
        <p>이 서버는 공연 조회에도 로그인을 요구합니다.</p>
        <router-link to="/login" class="btn btn-red btn-sm" style="margin-top:14px">로그인</router-link>
      </div>

      <div v-else-if="!c" class="blank">
        <h3>공연을 찾을 수 없습니다</h3>
        <p>{{ store.error }}</p>
        <router-link to="/courses" class="btn btn-line btn-sm" style="margin-top:14px">공연 목록으로</router-link>
      </div>

      <template v-else>
        <nav class="crumb small">
          <router-link to="/courses">공연</router-link><span>›</span><span>{{ label }}</span>
        </nav>

        <div class="top">
          <div class="poster"><PosterArt :id="c.id" :title="c.title" :genre="label" /></div>

          <div class="side">
            <span class="bdg bdg-red">{{ label }}</span>
            <h1 class="ttl">{{ c.title }}</h1>

            <dl class="dl">
              <div><dt>장르</dt><dd>{{ label }}</dd></div>
              <div><dt>기준가</dt><dd><b class="price num">{{ price }}원</b> <span class="small muted">R석 1매 기준</span></dd></div>
              <div><dt>누적 예매</dt><dd class="num">{{ (c.enrollmentCount || 0).toLocaleString() }}건</dd></div>
              <div v-if="rounds.length">
                <dt>전체 회차 잔여</dt>
                <dd>
                  <span v-if="soldOut" class="bdg bdg-red">매진</span>
                  <span v-else class="num cap-left" :class="{ few: almostGone }">{{ scheduleLeft.toLocaleString() }}석</span>
                </dd>
              </div>
              <div v-else-if="hasCap">
                <dt>정원</dt>
                <dd>
                  <span class="num">{{ Number(c.capacity).toLocaleString() }}석</span>
                  <span v-if="soldOut" class="bdg bdg-red cap-b">매진</span>
                  <span v-else class="num cap-left" :class="{ few: almostGone }">잔여 {{ left }}석</span>
                </dd>
              </div>
              <div><dt>기획사</dt><dd class="num muted">ID {{ c.instructorId }}</dd></div>
              <div>
                <dt>예매 상태</dt>
                <!-- status 는 공연 자체의 활성 여부고 매진과는 별개다. 매진이면 그쪽을 먼저 알린다. -->
                <dd>{{ c.status !== 'ACTIVE' ? '예매 중지' : soldOut ? '매진 (취소표 대기만 가능)' : '예매 가능' }}</dd>
              </div>
            </dl>

            <!-- 매진 → 취소표 대기 (Sprint2) -->
            <section v-if="soldOut" class="wait">
              <p class="w-t">이 공연은 매진되었습니다</p>
              <p class="w-d">
                취소표 대기를 걸어두면, 누군가 예매를 취소하는 순간
                <b>대기 순서대로 자동으로 예매·결제까지 처리</b>됩니다.
              </p>

              <template v-if="!auth.isAuthenticated">
                <router-link to="/login" class="btn btn-red btn-wide">로그인하고 대기 걸기</router-link>
              </template>

              <template v-else-if="myWait">
                <p class="alert" :class="myWait.status === 'MATCHED' ? 'alert-ok' : 'alert-info'">
                  <template v-if="myWait.status === 'MATCHED'">
                    자리가 나서 <b>자동으로 예매되었습니다.</b>
                    <router-link to="/enrollments" class="lk">내 예매</router-link>에서 확인하세요.
                  </template>
                  <template v-else>
                    <b>대기 중</b>입니다. 자리가 나면 자동으로 예매됩니다.
                  </template>
                </p>
              </template>

              <template v-else-if="!isViewer">
                <p class="alert alert-info">공연기획사 계정은 대기 등록을 할 수 없습니다.</p>
              </template>

              <template v-else>
                <p v-if="waitErr" class="alert alert-err">{{ waitErr }}</p>
                <button v-if="firstRound" type="button" class="btn btn-ai btn-wide"
                        @click="openWish(firstRound)">
                  취소표 매칭 신청하기
                </button>
                <button class="btn btn-line btn-wide" :disabled="waiting" @click="joinWaitlist">
                  <span v-if="waiting" class="spin spin-w"></span>
                  {{ waiting ? '등록 중' : '조건 없이 대기만 걸기' }}
                </button>
              </template>
            </section>

            <p v-if="store.isShowcase" class="alert alert-info">
              로그인하시면 예매와 취소표 매칭을 이용할 수 있습니다.
            </p>
            <p v-else-if="!auth.isAuthenticated" class="alert alert-info">
              공연 정보는 로그인 없이 보실 수 있습니다. 예매하려면 로그인이 필요합니다.
            </p>
            <p v-else-if="!isViewer" class="alert alert-info">
              공연기획사 계정입니다. 예매는 관람객 계정으로만 가능합니다.
            </p>
          </div>
        </div>

        <!-- 회차 -->
        <section class="body">
          <h2 class="stitle">회차 선택</h2>

          <p v-if="wishNotice" class="alert" :class="wishNoticeType === 'error' ? 'alert-err' : 'alert-ok'">
            {{ wishNotice }}
          </p>

          <div v-if="loadingRounds" class="load"><span class="spin"></span>회차를 불러오는 중입니다</div>

          <div v-else-if="!rounds.length" class="blank">
            <h3>등록된 회차가 없습니다</h3>
            <p>공연기획사가 회차를 등록하면 예매할 수 있습니다.</p>
          </div>

          <ul v-else class="rounds">
            <li v-for="r in rounds" :key="r.id" class="rd" :class="{ sold: totalLeft(r) === 0 }">
              <div class="rd-when">
                <span class="rd-date num">{{ r.date.replaceAll('-', '.') }}</span>
                <span class="rd-wd">({{ r.weekday }})</span>
                <span class="rd-time num">{{ r.time }}</span>
              </div>

              <ul class="grades">
                <li v-for="g in r.grades" :key="g.grade" class="gr" :class="{ out: remaining(g) === 0 }">
                  <span class="gr-n">{{ g.grade }}석</span>
                  <span class="gr-p num">{{ g.price.toLocaleString() }}원</span>
                  <span class="gr-r num" :class="{ few: remaining(g) > 0 && remaining(g) <= 10 }">
                    {{ remaining(g) === 0 ? '매진' : `잔여 ${remaining(g)}` }}
                  </span>
                </li>
              </ul>

              <router-link
                v-if="!auth.isAuthenticated && c.status === 'ACTIVE'"
                to="/login"
                class="btn btn-line btn-sm rd-go"
              >로그인 후 예매</router-link>
              <span v-else-if="isViewer && c.status === 'ACTIVE'" class="rd-go rd-two">
                <button type="button" class="btn btn-line btn-sm ai-b" title="취소표 매칭"
                        @click="openWish(r)">취소표 매칭</button>
                <button type="button" class="btn btn-line btn-sm occur-b"
                        :disabled="releasingRoundId === r.id" @click="releaseTicket(r)">
                  {{ releasingRoundId === r.id ? '발생 중' : '취소표 발생' }}
                </button>
                <router-link v-if="totalLeft(r) > 0" :to="`/courses/${c.id}/booking?round=${r.id}`"
                             class="btn btn-red btn-sm">예매하기</router-link>
                <span v-else class="bdg bdg-red">매진</span>
              </span>
              <span v-else class="rd-go small muted">예매 불가</span>
            </li>
          </ul>
        </section>

        <section class="body">
          <h2 class="stitle">공연 소개</h2>
          <p v-if="c.description" class="desc">{{ c.description }}</p>
          <p v-else class="desc muted">등록된 공연 소개가 없습니다.</p>
        </section>

        <section class="body">
          <h2 class="stitle">예매 안내</h2>
          <ul class="notice">
            <li>좌석 등급과 매수를 고르면 {{ HOLD_MINUTES }}분 동안 좌석이 선점되고, 그 안에 결제를 마쳐야 예매가 확정됩니다.</li>
            <li>선점하는 순간 잔여 수량이 즉시 줄어듭니다. 시간 안에 결제하지 않으면 자동으로 풀립니다.</li>
            <li>좌석은 등급 단위로 예매되며, 같은 등급 안에서는 현장 배정됩니다.</li>
            <li>예매한 뒤에는 <router-link to="/enrollments" class="lk">내 예매</router-link>에서 취소할 수 있습니다. 취소하면 좌석이 다시 풀립니다.</li>
          </ul>
        </section>
      </template>
    </main>

    <SeatWishModal
      :open="wishOpen"
      :course="c"
      :round="wishRound"
      @registered="onWishRegistered"
      @close="wishOpen = false"
    />
    <SeatMatchResultModal
      :open="resultOpen"
      :course="c"
      :round="resultRound"
      :offer="resultOffer"
      :reason="resultReason"
      @close="resultOpen = false"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import PosterArt from '@/components/PosterArt.vue'
import SeatWishModal from '@/components/SeatWishModal.vue'
import SeatMatchResultModal from '@/components/SeatMatchResultModal.vue'
import { useCourseStore } from '@/store/course.js'
import { useAuthStore } from '@/store/auth.js'
import { performanceApi, remaining } from '@/api/performance.js'
import { genreLabel } from '@/domain/genre.js'
import { isSoldOut, isAlmostGone, seatsLeft, hasCapacity, isNotSoldOutError } from '@/domain/soldout.js'
import { useWaitlistStore } from '@/store/waitlist.js'
import { HOLD_MINUTES } from '@/config/features.js'
import { seatWishApi, matchingDemoApi } from '@/api/seatWish.js'
import { SEAT_GRADES } from '@/data/seatLayout.js'

const route = useRoute()
const store = useCourseStore()
const auth = useAuthStore()

const c = computed(() => store.current)
const label = computed(() => genreLabel(c.value?.category))
const price = computed(() => Number(c.value?.price || 0).toLocaleString())
const isViewer = computed(() => auth.user?.role !== 'INSTRUCTOR')

const waitlist = useWaitlistStore()
const rounds = ref([])
const loadingRounds = ref(false)
const scheduleLeft = computed(() => rounds.value.reduce((sum, round) => sum + totalLeft(round), 0))
const soldOut = computed(() => rounds.value.length
  ? rounds.value.every((round) => totalLeft(round) === 0)
  : isSoldOut(c.value))
const almostGone = computed(() => rounds.value.length ? scheduleLeft.value <= 10 : isAlmostGone(c.value))
const left = computed(() => seatsLeft(c.value))
const hasCap = computed(() => hasCapacity(c.value))
const myWait = computed(() => waitlist.findByCourse(route.params.id))

const waiting = ref(false)
const waitErr = ref('')

async function joinWaitlist() {
  waiting.value = true
  waitErr.value = ''
  try {
    await waitlist.register(route.params.id)
  } catch (e) {
    console.error('[detail] 대기 등록 실패:', e)
    if (isNotSoldOutError(e)) {
      waitErr.value = '방금 자리가 났습니다. 대기 대신 바로 예매하실 수 있습니다.'
      await store.fetchCourse(route.params.id)
    } else {
      waitErr.value = e.response?.data?.message || '대기 등록에 실패했습니다.'
    }
  } finally {
    waiting.value = false
  }
}

const firstRound = computed(() => rounds.value[0] ?? null)
const wishOpen = ref(false)
const wishRound = ref(null)
const registeredByRound = ref({})
const wishNotice = ref('')
const wishNoticeType = ref('ok')
const releasingRoundId = ref(null)
const resultOpen = ref(false)
const resultRound = ref(null)
const resultOffer = ref(null)
const resultReason = ref('')

function openWish(round) {
  wishRound.value = round
  wishOpen.value = true
  wishNotice.value = ''
}

function onWishRegistered(registered) {
  registeredByRound.value = {
    ...registeredByRound.value,
    [String(registered.roundId)]: registered
  }
  wishNoticeType.value = 'ok'
  wishNotice.value = `${wishRound.value.date.replaceAll('-', '.')} ${wishRound.value.time} 회차의 취소표 희망사항이 등록되었습니다.`
}

async function releaseTicket(round) {
  releasingRoundId.value = round.id
  wishNotice.value = ''
  try {
    let registered = registeredByRound.value[String(round.id)]
    if (!registered) {
      const mine = await seatWishApi.myWaitlists()
      registered = [...mine].reverse().find((w) => String(w.courseId) === String(c.value.id))
    }

    if (!registered) {
      openWish(round)
      wishNoticeType.value = 'error'
      wishNotice.value = '먼저 취소표 매칭에서 원하는 좌석 조건을 등록해 주세요.'
      return
    }

    await matchingDemoApi.release(c.value.id, pickReleasedSeats(registered.wish), 'DEADLINE_BATCH')
    // 서버가 배분을 끝낼 시간을 준다
    await new Promise((r) => setTimeout(r, 1200))

    // ⚠️ release 응답에는 다른 대기자에게 나간 제안도 섞여 있다. 그걸 그대로 쓰면
    // 남의 배정 좌석이 내 화면에 뜬다. 내 좌석은 offers/my 로만 받아 온다.
    const offers = await seatWishApi.myOffers()
    resultRound.value = round
    resultOffer.value =
      offers.find((o) => String(o.courseId) === String(c.value.id) && o.status === 'PENDING') || null
    resultReason.value = ''
    resultOpen.value = true
  } catch (e) {
    console.error('[detail] 취소표 발생 실패:', e)
    resultRound.value = round
    resultOffer.value = null
    resultReason.value = e.response?.data?.detail || e.response?.data?.message || '취소표 발생 요청을 처리하지 못했습니다.'
    resultOpen.value = true
  } finally {
    releasingRoundId.value = null
  }
}

// 풀리는 좌석을 만든다.
//
// 한 석만 풀면 앞순번 대기자 한 명에게만 가고 끝난다. 서버 시드에 대기자가
// 90명 있어서 방금 신청한 사람은 아무리 눌러도 배정될 수 없었다. 그래서 마감
// 직전 미결제분이 한꺼번에 취소되는 상황으로 해당 등급을 통째로 푼다.
function pickReleasedSeats(wish) {
  const grades = wish?.grades?.length ? wish.grades : ['S']
  const maxPrice = Number(wish?.maxPrice) || Infinity
  const grade = grades.find((g) => (SEAT_GRADES[g]?.price ?? Infinity) <= maxPrice) || grades[0] || 'S'
  const rows = SEAT_GRADES[grade]?.rows || SEAT_GRADES.S.rows
  const seats = []
  for (const [row, n] of Object.entries(rows)) {
    for (let i = 1; i <= n; i++) seats.push(`${grade}-${row}-${i}`)
  }
  return seats
}

function totalLeft(r) {
  return r.grades.reduce((a, g) => a + remaining(g), 0)
}

onMounted(async () => {
  await store.fetchCourse(route.params.id)
  if (!c.value) return
  if (auth.isAuthenticated && isViewer.value) waitlist.fetchMine()
  loadingRounds.value = true
  try {
    rounds.value = await performanceApi.rounds(c.value)
  } catch (e) {
    console.error('[detail] 회차 조회 실패:', e)
    rounds.value = []
  } finally {
    loadingRounds.value = false
  }
})
</script>

<style scoped>
.crumb { display: flex; gap: 7px; color: var(--t3); margin-bottom: 16px; }
.crumb a:hover { color: var(--red); }

.top { display: grid; grid-template-columns: 300px 1fr; gap: 34px; align-items: start; }
.poster { border-radius: var(--r-lg); overflow: hidden; box-shadow: var(--shadow); }
.side { display: flex; flex-direction: column; gap: 12px; }
.ttl { font-size: 27px; font-weight: 800; line-height: 1.28; letter-spacing: -0.05em; }
.price { font-size: 19px; font-weight: 800; color: var(--red); }

.cap-b { margin-left: 8px; }
.cap-left { margin-left: 8px; font-size: 12.5px; color: var(--t3); }
.cap-left.few { color: var(--red); font-weight: 700; }

.wait {
  padding: 16px 18px;
  border: 1px solid var(--red);
  border-radius: var(--r-lg);
  background: var(--red-wash);
  display: flex;
  flex-direction: column;
  gap: 9px;
}
.w-t { font-size: 15px; font-weight: 800; color: var(--red-dark); letter-spacing: -0.04em; }
.w-d { font-size: 13px; color: var(--t2); line-height: 1.7; }
.w-d b { font-weight: 700; color: var(--t1); }
.wait .alert { margin: 0; }
.spin-w { border-color: rgba(255,255,255,.4); border-top-color: #fff; width: 15px; height: 15px; }

.body { margin-top: 46px; }

.rounds { border-top: 2px solid var(--navy); }
.rd {
  display: grid;
  grid-template-columns: 190px 1fr 270px;
  gap: 18px;
  align-items: center;
  padding: 15px 6px;
  border-bottom: 1px solid var(--line);
}
.rd.sold { background: var(--bg-soft); }
.rd-when { display: flex; align-items: baseline; gap: 6px; }
.rd-date { font-size: 15px; font-weight: 700; }
.rd-wd { font-size: 12.5px; color: var(--t3); }
.rd-time { font-size: 15px; font-weight: 600; margin-left: 4px; }

.grades { display: flex; flex-wrap: wrap; gap: 6px; }
.gr {
  display: inline-flex; align-items: baseline; gap: 7px;
  padding: 5px 10px;
  border: 1px solid var(--line);
  border-radius: var(--r);
  background: #fff;
}
.gr.out { opacity: .45; }
.gr-n { font-size: 12px; font-weight: 700; color: var(--navy); }
.gr-p { font-size: 12.5px; }
.gr-r { font-size: 11.5px; color: var(--t3); }
.gr-r.few { color: var(--red); font-weight: 700; }
.rd-go { justify-self: end; }
.rd-two { display: inline-flex; gap: 6px; }
.ai-b { border-color: var(--ai-line); color: var(--ai); }
.ai-b:hover { border-color: var(--ai); background: var(--ai-wash); }
.occur-b { border-color: #E8B9C1; color: var(--red-dark); }
.occur-b:hover:not(:disabled) { border-color: var(--red); background: var(--red-wash); }
.btn-ai { background: var(--ai); color: #fff; border-color: var(--ai); }
.btn-ai:hover:not(:disabled) { background: #5A38CC; border-color: #5A38CC; }

.desc { font-size: 14.5px; line-height: 1.85; color: var(--t2); white-space: pre-wrap; }
.notice { display: flex; flex-direction: column; gap: 7px; }
.notice li { position: relative; padding-left: 12px; font-size: 13.5px; color: var(--t2); line-height: 1.7; }
.notice li::before { content: ''; position: absolute; left: 0; top: 10px; width: 3px; height: 3px; border-radius: 50%; background: var(--t4); }

@media (max-width: 900px) {
  .top { grid-template-columns: 1fr; gap: 22px; }
  .poster { max-width: 240px; }
  .ttl { font-size: 22px; }
  .rd { grid-template-columns: 1fr; row-gap: 10px; }
  .rd-go { justify-self: start; }
}
</style>
