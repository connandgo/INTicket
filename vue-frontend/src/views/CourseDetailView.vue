<template>
  <div>
    <AppHeader />

    <main class="wrap page">
      <div v-if="store.loading" class="load"><span class="spin"></span>공연 정보를 불러오는 중입니다</div>

      <div v-else-if="!c" class="blank">
        <h3>공연을 찾을 수 없습니다</h3>
        <p>{{ store.error }}</p>
        <router-link to="/courses" class="btn btn-line btn-sm" style="margin-top:14px">공연 목록으로</router-link>
      </div>

      <template v-else>
        <nav class="crumb small">
          <router-link to="/courses">공연</router-link>
          <span>›</span>
          <span>{{ label }}</span>
        </nav>

        <div class="top">
          <div class="poster">
            <PosterArt :id="c.id" :title="c.title" :genre="label" />
          </div>

          <div class="side">
            <span class="bdg bdg-red">{{ label }}</span>
            <h1 class="ttl">{{ c.title }}</h1>

            <dl class="dl">
              <div><dt>장르</dt><dd>{{ label }}</dd></div>
              <div><dt>티켓 가격</dt><dd><b class="price num">{{ price }}원</b> <span class="small muted">1매 기준</span></dd></div>
              <div><dt>누적 예매</dt><dd class="num">{{ (c.enrollmentCount || 0).toLocaleString() }}건</dd></div>
              <div><dt>기획사</dt><dd class="num muted">ID {{ c.instructorId }}</dd></div>
              <div><dt>예매 상태</dt><dd>{{ c.status === 'ACTIVE' ? '예매 가능' : '예매 중지' }}</dd></div>
            </dl>

            <!-- 예매 -->
            <div class="act">
              <p v-if="mine" class="alert" :class="mine.status === 'ACTIVE' ? 'alert-ok' : 'alert-info'">
                이미 예매하신 공연입니다 — <b>{{ STATUS_LABEL[mine.status] }}</b>
              </p>
              <p v-else-if="done" class="alert alert-ok">
                예매가 접수되었습니다. 결제가 끝나면 예매 확정으로 바뀝니다.
              </p>
              <p v-else-if="err" class="alert alert-err">{{ err }}</p>

              <button
                v-if="!mine"
                class="btn btn-red btn-lg btn-wide"
                :disabled="booking || c.status !== 'ACTIVE' || !isViewer"
                @click="book"
              >
                <span v-if="booking" class="spin spin-w"></span>
                {{ booking ? '예매 처리 중' : '예매하기' }}
              </button>
              <router-link v-else to="/enrollments" class="btn btn-navy btn-lg btn-wide">내 예매 확인</router-link>

              <p v-if="!isViewer" class="fhint">
                공연기획사 계정은 예매할 수 없습니다. 관람객 계정으로 로그인해 주세요.
              </p>
              <p class="fhint">1인 1매 기준이며, 같은 공연은 중복 예매할 수 없습니다.</p>
            </div>
          </div>
        </div>

        <section class="body">
          <h2 class="stitle">공연 소개</h2>
          <p v-if="c.description" class="desc">{{ c.description }}</p>
          <p v-else class="desc muted">등록된 공연 소개가 없습니다.</p>
        </section>

        <section class="body">
          <h2 class="stitle">예매 안내</h2>
          <ul class="notice">
            <li>예매 신청 후 모의 결제가 자동으로 진행되며, 결제가 완료되면 예매 확정으로 바뀝니다.</li>
            <li>결제 처리 중 상태는 <router-link to="/enrollments" class="lk">내 예매</router-link>에서 확인할 수 있습니다.</li>
            <li>이번 버전에서는 예매 취소와 환불을 지원하지 않습니다.</li>
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
import { useEnrollmentStore, STATUS_LABEL } from '@/store/enrollment.js'
import { useAuthStore } from '@/store/auth.js'
import { genreLabel } from '@/domain/genre.js'

const route = useRoute()
const store = useCourseStore()
const enroll = useEnrollmentStore()
const auth = useAuthStore()

const c = computed(() => store.current)
const label = computed(() => genreLabel(c.value?.category))
const price = computed(() => Number(c.value?.price || 0).toLocaleString())
const isViewer = computed(() => auth.user?.role !== 'INSTRUCTOR')

const booking = ref(false)
const done = ref(false)
const err = ref('')

const mine = computed(() => enroll.findByCourse(route.params.id))

onMounted(async () => {
  await store.fetchCourse(route.params.id)
  if (isViewer.value) await enroll.fetchMine()
})

async function book() {
  booking.value = true
  err.value = ''
  done.value = false
  try {
    await enroll.book(Number(route.params.id))
    done.value = true
    // 누적 예매 수가 바뀌었을 수 있으니 상세를 다시 읽는다
    await store.fetchCourse(route.params.id)
  } catch (e) {
    console.error('[detail] 예매 실패:', e)
    err.value =
      e.response?.status === 409
        ? '이미 예매한 공연입니다.'
        : e.response?.data?.message || '예매에 실패했습니다. 잠시 후 다시 시도해 주세요.'
  } finally {
    booking.value = false
  }
}
</script>

<style scoped>
.crumb { display: flex; gap: 7px; color: var(--t3); margin-bottom: 16px; }
.crumb a:hover { color: var(--red); }

.top { display: grid; grid-template-columns: 300px 1fr; gap: 34px; align-items: start; }
.poster { border-radius: var(--r-lg); overflow: hidden; box-shadow: var(--shadow); }

.side { display: flex; flex-direction: column; gap: 12px; }
.ttl { font-size: 27px; font-weight: 800; line-height: 1.28; letter-spacing: -0.05em; }
.price { font-size: 19px; font-weight: 800; color: var(--red); }

.act { margin-top: 6px; display: flex; flex-direction: column; gap: 10px; }
.spin-w { border-color: rgba(255,255,255,.4); border-top-color: #fff; width: 15px; height: 15px; }

.body { margin-top: 46px; }
.desc { font-size: 14.5px; line-height: 1.85; color: var(--t2); white-space: pre-wrap; }
.notice { display: flex; flex-direction: column; gap: 7px; }
.notice li {
  position: relative;
  padding-left: 12px;
  font-size: 13.5px;
  color: var(--t2);
  line-height: 1.7;
}
.notice li::before { content: ''; position: absolute; left: 0; top: 10px; width: 3px; height: 3px; border-radius: 50%; background: var(--t4); }
.lk { color: var(--blue); text-decoration: underline; text-underline-offset: 2px; }

@media (max-width: 860px) {
  .top { grid-template-columns: 1fr; gap: 22px; }
  .poster { max-width: 240px; }
  .ttl { font-size: 22px; }
}
</style>
