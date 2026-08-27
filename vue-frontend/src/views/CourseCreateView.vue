<template>
  <div>
    <AppHeader />

    <main class="narrow page">
      <h1 class="ptitle">공연 등록</h1>

      <p class="lead">
        등록한 공연은 바로 공연 목록에 노출되고 관람객이 예매할 수 있습니다.
        회차와 좌석은 이번 버전에서 다루지 않으므로, 일시와 장소는 공연 소개에 적어 주세요.
      </p>

      <form class="form" @submit.prevent="submit">
        <div class="fld">
          <label class="flabel" for="f-title">공연명<span class="req">*</span></label>
          <input id="f-title" v-model.trim="form.title" class="inp" maxlength="100"
                 placeholder="예) 뮤지컬 오페라의 유령" required />
        </div>

        <div class="fld">
          <label class="flabel" for="f-genre">장르<span class="req">*</span></label>
          <select id="f-genre" v-model="form.category" class="sel" required>
            <option v-for="g in GENRES" :key="g.code" :value="g.code">{{ g.label }}</option>
          </select>
        </div>

        <div class="fld">
          <label class="flabel" for="f-price">티켓 가격<span class="req">*</span></label>
          <div class="money">
            <input id="f-price" v-model.number="form.price" type="number" class="inp" min="0" step="1000"
                   placeholder="0" required />
            <span class="unit">원</span>
          </div>
          <p class="fhint">1매 기준 가격입니다. 이 금액이 그대로 결제 금액이 됩니다.</p>
        </div>

        <div class="fld">
          <label class="flabel" for="f-cap">정원</label>
          <div class="money">
            <input id="f-cap" v-model.number="form.capacity" type="number" class="inp" min="1" step="10"
                   placeholder="비워두면 정원 무제한" />
            <span class="unit">석</span>
          </div>
          <p class="fhint">
            예매 수가 정원에 도달하면 매진되고, 그때부터 관람객이 <b>취소표 대기</b>를 걸 수 있습니다.
            비워두면 무제한이라 매진도 대기도 생기지 않습니다.
          </p>
        </div>

        <div class="fld">
          <label class="flabel" for="f-desc">공연 소개</label>
          <textarea id="f-desc" v-model="form.description" class="txt" maxlength="2000"
                    placeholder="공연 일시, 공연장, 관람 시간, 관람 등급 등을 적어 주세요.&#10;&#10;예)&#10;일시 2026.09.12(금) 19:30&#10;장소 블루스퀘어 신한카드홀&#10;관람시간 160분(인터미션 20분 포함)&#10;관람등급 14세 이상"></textarea>
          <p class="fhint">{{ (form.description || '').length }} / 2000자</p>
        </div>

        <p v-if="err" class="alert alert-err">{{ err }}</p>
        <p v-if="ok" class="alert alert-ok">{{ ok }}</p>

        <div class="acts">
          <router-link to="/courses" class="btn btn-line">취소</router-link>
          <button type="submit" class="btn btn-red" :disabled="saving || !valid">
            <span v-if="saving" class="spin spin-w"></span>{{ saving ? '등록 중' : '공연 등록' }}
          </button>
        </div>
      </form>
    </main>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import { useCourseStore } from '@/store/course.js'
import { GENRES } from '@/domain/genre.js'

const router = useRouter()
const store = useCourseStore()

const form = ref({ title: '', category: 'BACKEND', price: null, capacity: null, description: '' })
const saving = ref(false)
const err = ref('')
const ok = ref('')

const valid = computed(
  () => form.value.title.length > 0 && form.value.price !== null && form.value.price >= 0
)

async function submit() {
  saving.value = true
  err.value = ''
  ok.value = ''
  try {
    const created = await store.create({
      title: form.value.title,
      description: form.value.description || null,
      category: form.value.category,
      price: form.value.price,
      // 비워두면 정원 무제한. 백엔드가 null 을 그렇게 해석한다.
      capacity: form.value.capacity && form.value.capacity > 0 ? form.value.capacity : null
    })
    ok.value = '공연이 등록되었습니다. 공연 상세로 이동합니다.'
    setTimeout(() => {
      if (created?.id) router.push(`/courses/${created.id}`)
      else router.push('/courses')
    }, 900)
  } catch (e) {
    console.error('[create] 공연 등록 실패:', e)
    err.value =
      e.response?.status === 403
        ? '공연기획사 계정만 공연을 등록할 수 있습니다.'
        : e.response?.data?.message || '공연 등록에 실패했습니다.'
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.lead { font-size: 13.5px; color: var(--t2); line-height: 1.75; margin-bottom: 26px; }
.form { display: flex; flex-direction: column; gap: 20px; }
.money { position: relative; }
.fhint b { font-weight: 700; color: var(--t1); }
.money .unit {
  position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
  font-size: 13px; color: var(--t3);
}
.money .inp { padding-right: 34px; }
.acts { display: flex; justify-content: flex-end; gap: 8px; margin-top: 6px; }
.spin-w { border-color: rgba(255,255,255,.4); border-top-color: #fff; width: 14px; height: 14px; }
</style>
