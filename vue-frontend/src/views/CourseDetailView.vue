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
              <div v-if="hasCap">
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
                <b>대기 순서대로 자동으로 예매·결제까지 처리</b>됩니다. 따로 다시 들어오실 필요 없습니다.
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
                <button class="btn btn-red btn-wide" :disabled="waiting" @click="joinWaitlist">
                  <span v-if="waiting" class="spin spin-w"></span>
                  {{ waiting ? '등록 중' : '취소표 대기 등록' }}
                </button>
              </template>
            </section>

            <p v-if="!auth.isAuthenticated" class="alert alert-info">
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

          <!-- 실서버에 붙어 있어도 회차·좌석등급 API는 아직 없다. 화면에 숨기지 않는다. -->
          <p v-if="!scheduleFromServer" class="alert alert-info sched-note">
            회차와 좌석 등급은 아직 <b>프론트엔드 임시 데이터</b>입니다.
            공연 조회·예매·결제·추천은 실제 서버와 연동되어 있습니다.
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

              <span v-if="soldOut" class="bdg bdg-red rd-go">매진</span>
              <router-link
                v-else-if="!auth.isAuthenticated && totalLeft(r) > 0 && c.status === 'ACTIVE'"
                to="/login"
                class="btn btn-line btn-sm rd-go"
              >로그인 후 예매</router-link>
              <router-link
                v-else-if="isViewer && totalLeft(r) > 0 && c.status === 'ACTIVE'"
                :to="`/courses/${c.id}/booking?round=${r.id}`"
                class="btn btn-red btn-sm rd-go"
              >예매하기</router-link>
              <span v-else-if="totalLeft(r) === 0" class="bdg bdg-gray rd-go">전 등급 매진</span>
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
            <li>개별 좌석 지정은 지원하지 않습니다. 같은 등급 안에서 좌석은 현장 배정됩니다.</li>
            <li>예매한 뒤에는 <router-link to="/enrollments" class="lk">내 예매</router-link>에서 취소할 수 있습니다. 취소하면 좌석이 다시 풀립니다.</li>
          </ul>
        </section>
      </template>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import PosterArt from '@/components/PosterArt.vue'
import { useCourseStore } from '@/store/course.js'
import { useAuthStore } from '@/store/auth.js'
import { performanceApi, remaining } from '@/api/performance.js'
import { genreLabel } from '@/domain/genre.js'
import { isSoldOut, isAlmostGone, seatsLeft, hasCapacity, isNotSoldOutError } from '@/domain/soldout.js'
import { useWaitlistStore } from '@/store/waitlist.js'
import { HOLD_MINUTES, FEATURES } from '@/config/features.js'

const route = useRoute()
const store = useCourseStore()
const auth = useAuthStore()

const c = computed(() => store.current)
const label = computed(() => genreLabel(c.value?.category))
const price = computed(() => Number(c.value?.price || 0).toLocaleString())
const isViewer = computed(() => auth.user?.role !== 'INSTRUCTOR')

const waitlist = useWaitlistStore()
const soldOut = computed(() => isSoldOut(c.value))
const almostGone = computed(() => isAlmostGone(c.value))
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

const rounds = ref([])
const loadingRounds = ref(false)
const scheduleFromServer = FEATURES.scheduleApi

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

.sched-note { margin-bottom: 14px; }
.sched-note b { font-weight: 700; }

.rounds { border-top: 2px solid var(--navy); }
.rd {
  display: grid;
  grid-template-columns: 190px 1fr 110px;
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
