<template>
  <div>
    <AppHeader />

    <main class="wrap page" v-if="course && round">
      <router-link :to="`/courses/${course.id}`" class="back num">← {{ course.title }}</router-link>

      <header class="head">
        <div>
          <p class="eyebrow">AI 좌석 매칭</p>
          <h1 class="h-t">원하는 자리를 말로 알려주세요</h1>
          <p class="h-d num">
            {{ round.date.replaceAll('-', '.') }} ({{ round.weekday }}) {{ round.time }}
            <span class="sep">·</span>
            <b :class="soldOut ? 'so' : 'ok'">{{ soldOut ? '매진' : `잔여 ${totalLeft}석` }}</b>
          </p>
        </div>
        <span class="bdg bdg-ai-solid">AI</span>
      </header>

      <!-- 상황 안내: 매진이냐 / 뒷열만 남았냐 -->
      <p class="alert situation" :class="soldOut ? 'alert-err' : 'alert-info'">
        <template v-if="soldOut">
          이 회차는 <b>매진</b>입니다. 원하는 조건을 적어두시면 취소표가 나왔을 때
          조건에 맞는 분부터 자동으로 배정됩니다.
        </template>
        <template v-else-if="onlyBackLeft">
          앞쪽 등급은 거의 소진되고 <b>{{ backGradesLabel }}만 남아 있습니다.</b>
          지금 예매 가능한 자리 중 조건에 가장 가까운 곳을 찾아 드리고,
          더 좋은 자리를 원하시면 취소표 대기도 함께 걸 수 있습니다.
        </template>
        <template v-else>
          조건을 적어주시면 지금 예매 가능한 자리 중 가장 가까운 곳을 찾아 드립니다.
        </template>
      </p>

      <div class="split">
        <!-- 왼쪽: 좌석 배치도 -->
        <section class="card card-pad map-sec">
          <h2 class="s-t">
            좌석 배치
            <span v-if="wish" class="s-sub">조건에 맞는 구역이 표시됩니다</span>
          </h2>
          <SeatMap
            :round="round"
            :grade="picked?.grade || ''"
            :quantity="picked ? (wish?.quantity || 1) : 0"
            :max="4"
            @pick="onMapPick"
          />
        </section>

        <!-- 오른쪽: 입력 + 결과 -->
        <section class="side">
          <article class="card card-pad">
            <h2 class="s-t">희망 사항</h2>
            <textarea
              v-model="text"
              class="txt wish"
              maxlength="300"
              placeholder="예) 3명이서 붙어 앉고 싶어요. 무대 가까운 앞쪽이면 좋겠고 1매 15만원 이하로요. 정 안 되면 떨어져 앉아도 괜찮습니다."
            ></textarea>

            <div class="ex">
              <span class="ex-l">예시</span>
              <button v-for="e in EXAMPLES" :key="e" class="ex-b" @click="text = e">{{ e.slice(0, 18) }}…</button>
            </div>

            <button class="btn btn-ai btn-wide" :disabled="parsing || !text.trim()" @click="run">
              <span v-if="parsing" class="spin spin-w"></span>{{ parsing ? '분석 중' : 'AI로 조건 분석하기' }}
            </button>
          </article>

          <!-- 파싱 결과: 필수 / 선호 / 양보가능 -->
          <article v-if="wish" class="card card-pad up">
            <h2 class="s-t">
              AI가 이해한 조건
              <span class="s-sub">{{ wish.source === 'AI_SERVICE' ? 'LLM 분석' : '규칙 기반 분석' }}</span>
            </h2>
            <p class="b-d">틀린 게 있으면 아래에서 직접 빼고 다시 찾아볼 수 있습니다.</p>

            <div v-for="b in BUCKETS" :key="b.key" class="bucket">
              <p class="b-t" :class="b.key">{{ b.label }}</p>
              <ul v-if="wish.buckets[b.key].length" class="b-l">
                <li v-for="(it, i) in wish.buckets[b.key]" :key="it.key + i">
                  <span class="b-k">{{ it.label }}</span>
                  <span class="b-v">{{ it.value }}</span>
                  <button class="b-x" :aria-label="`${it.label} 조건 빼기`" @click="dropCondition(b.key, i)">✕</button>
                </li>
              </ul>
              <p v-else class="b-none">없음</p>
            </div>

            <p v-if="wish.unparsed.length" class="alert alert-info b-un">
              이 문장은 조건으로 읽지 못했습니다 — “{{ wish.unparsed[0] }}”.
              매수·등급·가격·연석 여부를 넣어 다시 써 주시면 더 잘 찾습니다.
            </p>
          </article>

          <!-- 매칭 결과 -->
          <article v-if="matches.length" class="card card-pad up">
            <h2 class="s-t">추천 좌석</h2>

            <ul class="m-l">
              <li v-for="(m, i) in matches" :key="m.grade">
                <button
                  class="m-c"
                  :class="{ on: picked?.grade === m.grade, out: !m.available }"
                  @click="picked = m"
                >
                  <span class="m-rank num">{{ i + 1 }}</span>
                  <span class="m-main">
                    <span class="m-g">{{ m.grade }}석</span>
                    <span class="m-p num">{{ m.price.toLocaleString() }}원</span>
                    <span class="m-left num" :class="{ zero: !m.available }">
                      {{ m.left === 0 ? '매진' : `잔여 ${m.left}석` }}
                    </span>
                  </span>
                  <span class="m-score num">{{ m.score }}</span>
                </button>

                <ul v-if="picked?.grade === m.grade" class="m-why">
                  <li v-for="(r, ri) in m.reasons" :key="ri">{{ r }}</li>
                </ul>
              </li>
            </ul>

            <div class="acts">
              <router-link
                v-if="picked?.available"
                :to="`/courses/${course.id}/booking?round=${round.id}`"
                class="btn btn-red btn-wide"
              >{{ picked.grade }}석으로 예매하러 가기</router-link>

              <template v-if="soldOut || !picked?.available">
                <p v-if="waitErr" class="alert alert-err">{{ waitErr }}</p>
                <p v-if="myWait" class="alert alert-ok">
                  이 조건으로 <b>대기 중</b>입니다. 자리가 나면 자동으로 예매됩니다.
                </p>
                <button v-else class="btn btn-ai btn-wide" :disabled="waiting" @click="joinWaitlist">
                  <span v-if="waiting" class="spin spin-w"></span>
                  {{ waiting ? '등록 중' : '이 조건으로 취소표 대기 걸기' }}
                </button>
                <p class="fhint">
                  대기는 공연 단위로 등록되고, 위 조건은 매칭 우선순위를 정하는 데 쓰입니다.
                </p>
              </template>
            </div>
          </article>
        </section>
      </div>
    </main>

    <main class="wrap page" v-else-if="loading">
      <div class="load"><span class="spin"></span>불러오는 중입니다</div>
    </main>

    <main class="wrap page" v-else>
      <div class="blank">
        <h3>회차를 찾을 수 없습니다</h3>
        <router-link to="/courses" class="btn btn-line btn-sm" style="margin-top:14px">공연 목록으로</router-link>
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import SeatMap from '@/components/SeatMap.vue'
import { useCourseStore } from '@/store/course.js'
import { useWaitlistStore } from '@/store/waitlist.js'
import { performanceApi, remaining } from '@/api/performance.js'
import { seatWishApi } from '@/api/seatWish.js'
import { isSoldOut } from '@/domain/soldout.js'
import { isNotSoldOutError } from '@/domain/soldout.js'

const route = useRoute()
const store = useCourseStore()
const waitlist = useWaitlistStore()

const course = computed(() => store.current)
const round = ref(null)
const loading = ref(true)

const text = ref('')
const wish = ref(null)
const matches = ref([])
const picked = ref(null)
const parsing = ref(false)

const waiting = ref(false)
const waitErr = ref('')
const myWait = computed(() => waitlist.findByCourse(route.params.id))

const BUCKETS = [
  { key: 'must', label: '양보할 수 없는 조건' },
  { key: 'prefer', label: '되도록 맞추고 싶은 조건' },
  { key: 'flexible', label: '양보 가능한 조건' }
]

const EXAMPLES = [
  '3명이서 꼭 붙어 앉고 싶어요. 앞쪽이면 좋겠고 1매 15만원 이하로 부탁드려요.',
  '혼자 볼 거라 자리는 어디든 괜찮아요. 대신 최대한 저렴했으면 좋겠습니다.',
  '두 명인데 무대 가까운 VIP석 원해요. 떨어져 앉아도 괜찮습니다.'
]

const soldOut = computed(() => isSoldOut(course.value))
const totalLeft = computed(() =>
  round.value ? round.value.grades.reduce((a, g) => a + remaining(g), 0) : 0
)

// 앞쪽 등급(VIP·R)이 거의 없고 뒤쪽만 남은 상황인지
const onlyBackLeft = computed(() => {
  if (!round.value || soldOut.value) return false
  const front = round.value.grades.filter((g) => ['VIP', 'R'].includes(g.grade))
  const back = round.value.grades.filter((g) => ['S', 'A'].includes(g.grade))
  const fl = front.reduce((a, g) => a + remaining(g), 0)
  const bl = back.reduce((a, g) => a + remaining(g), 0)
  return bl > 0 && fl <= Math.max(5, bl * 0.12)
})
const backGradesLabel = computed(() =>
  (round.value?.grades || [])
    .filter((g) => ['S', 'A'].includes(g.grade) && remaining(g) > 0)
    .map((g) => `${g.grade}석`)
    .join('·') || '뒤쪽 등급'
)

onMounted(async () => {
  await store.fetchCourse(route.params.id)
  if (course.value) {
    round.value = await performanceApi.round(course.value, route.query.round)
    waitlist.fetchMine()
  }
  loading.value = false
})

async function run() {
  parsing.value = true
  picked.value = null
  try {
    wish.value = await seatWishApi.parse({
      courseId: course.value.id,
      scheduleId: round.value.id,
      text: text.value
    })
    recompute()
  } finally {
    parsing.value = false
  }
}

function recompute() {
  matches.value = seatWishApi.match(round.value, wish.value)
  picked.value = matches.value[0] || null
}

// 잘못 읽은 조건을 사용자가 빼면 바로 다시 계산한다
function dropCondition(bucket, index) {
  const removed = wish.value.buckets[bucket][index]
  wish.value.buckets[bucket].splice(index, 1)
  if (removed.key === 'maxPrice') wish.value.maxPrice = null
  if (removed.key === 'grades') wish.value.grades = ['VIP', 'R', 'S', 'A']
  if (removed.key === 'together') wish.value.together = null
  if (removed.key === 'front') wish.value.frontPreferred = null
  if (removed.key === 'quantity') wish.value.quantity = null
  recompute()
}

function onMapPick({ grade }) {
  const found = matches.value.find((m) => m.grade === grade)
  if (found) picked.value = found
}

async function joinWaitlist() {
  waiting.value = true
  waitErr.value = ''
  try {
    await waitlist.register(route.params.id)
  } catch (e) {
    console.error('[seat-wish] 대기 등록 실패:', e)
    waitErr.value = isNotSoldOutError(e)
      ? '아직 매진이 아니어서 대기 등록은 할 수 없습니다. 지금 바로 예매하실 수 있습니다.'
      : e.response?.data?.message || '대기 등록에 실패했습니다.'
  } finally {
    waiting.value = false
  }
}
</script>

<style scoped>
.back { display: inline-block; font-size: 12px; color: var(--t3); margin-bottom: 18px; }
.back:hover { color: var(--t1); }

.head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
.eyebrow { font-size: 11.5px; font-weight: 700; letter-spacing: .14em; color: var(--ai); }
.h-t { font-size: 24px; font-weight: 800; letter-spacing: -0.045em; margin: 7px 0 6px; }
.h-d { font-size: 13.5px; color: var(--t2); }
.sep { margin: 0 7px; color: var(--t4); }
.h-d b.so { color: var(--red); }
.h-d b.ok { color: var(--ok); }

.situation { margin-bottom: 18px; line-height: 1.7; }
.situation b { font-weight: 700; }

.split { display: grid; grid-template-columns: 1.25fr 1fr; gap: 14px; align-items: start; }
.s-t { font-size: 15px; font-weight: 700; letter-spacing: -0.035em; margin-bottom: 12px; display: flex; align-items: baseline; gap: 8px; }
.s-sub { font-size: 11.5px; font-weight: 500; color: var(--t3); }

.side { display: flex; flex-direction: column; gap: 12px; }
.wish { min-height: 108px; font-size: 13.5px; line-height: 1.7; }

.ex { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: 10px 0 12px; }
.ex-l { font-size: 11px; color: var(--t3); }
.ex-b {
  font-size: 11.5px; color: var(--ai);
  padding: 4px 9px; border: 1px solid var(--ai-line); border-radius: 20px;
  background: var(--ai-wash);
}
.ex-b:hover { border-color: var(--ai); }

.btn-ai { background: var(--ai); color: #fff; border-color: var(--ai); }
.btn-ai:hover:not(:disabled) { background: #5A38CC; border-color: #5A38CC; }
.spin-w { border-color: rgba(255,255,255,.4); border-top-color: #fff; width: 14px; height: 14px; }

.b-d { font-size: 12px; color: var(--t3); margin: -4px 0 12px; }
.bucket { margin-bottom: 12px; }
.b-t { font-size: 12px; font-weight: 700; margin-bottom: 6px; }
.b-t.must { color: var(--red-dark); }
.b-t.prefer { color: var(--ai); }
.b-t.flexible { color: var(--t2); }
.b-l { display: flex; flex-direction: column; gap: 5px; }
.b-l li {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 10px; border: 1px solid var(--line); border-radius: var(--r);
  background: var(--bg-soft);
}
.b-k { font-size: 11px; color: var(--t3); }
.b-v { font-size: 12.5px; font-weight: 600; margin-right: auto; }
.b-x { font-size: 11px; color: var(--t4); padding: 2px 4px; }
.b-x:hover { color: var(--red); }
.b-none { font-size: 12px; color: var(--t4); padding-left: 2px; }
.b-un { margin-top: 10px; font-size: 12.5px; line-height: 1.6; }

.m-l { display: flex; flex-direction: column; gap: 7px; }
.m-c {
  width: 100%; display: flex; align-items: center; gap: 10px;
  padding: 11px 12px; border: 1px solid var(--line-dark); border-radius: var(--r);
  text-align: left; transition: border-color .15s var(--ease), background .15s var(--ease);
}
.m-c:hover { border-color: var(--ai); }
.m-c.on { border-color: var(--ai); background: var(--ai-wash); }
.m-c.out { opacity: .55; }
.m-rank { font-size: 11px; font-weight: 700; color: var(--t4); width: 12px; }
.m-main { display: flex; align-items: baseline; gap: 9px; flex-wrap: wrap; margin-right: auto; }
.m-g { font-size: 14px; font-weight: 700; }
.m-p { font-size: 13px; }
.m-left { font-size: 11.5px; color: var(--t3); }
.m-left.zero { color: var(--red); font-weight: 700; }
.m-score { font-size: 16px; font-weight: 800; color: var(--ai); }

.m-why { margin: 6px 0 4px 22px; display: flex; flex-direction: column; gap: 4px; }
.m-why li {
  position: relative; padding-left: 11px;
  font-size: 12px; color: var(--t2); line-height: 1.6;
}
.m-why li::before {
  content: ''; position: absolute; left: 0; top: 7px;
  width: 3px; height: 3px; border-radius: 50%; background: var(--ai);
}

.acts { margin-top: 14px; display: flex; flex-direction: column; gap: 8px; }

@media (max-width: 980px) {
  .split { grid-template-columns: 1fr; }
}
</style>
