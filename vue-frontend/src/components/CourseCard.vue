<template>
  <router-link :to="`/courses/${course.id}`" class="card">
    <div class="thumb">
      <PosterArt :id="course.id" :title="course.title" :genre="label" />
      <span v-if="rank" class="rank num">{{ rank }}</span>
      <span v-if="soldOut" class="sold">매진</span>
    </div>

    <div class="info">
      <span class="bdg bdg-gray">{{ label }}</span>
      <h3 class="ttl">{{ course.title }}</h3>
      <p class="desc">{{ oneLine }}</p>
      <div class="foot">
        <span class="price num">{{ price }}<em>원</em></span>
        <span v-if="almostGone" class="cnt num few">{{ left }}석 남음</span>
        <span v-else class="cnt num">예매 {{ (course.enrollmentCount || 0).toLocaleString() }}</span>
      </div>
    </div>
  </router-link>
</template>

<script setup>
import { computed } from 'vue'
import PosterArt from '@/components/PosterArt.vue'
import { genreLabel } from '@/domain/genre.js'
import { isSoldOut, isAlmostGone, seatsLeft } from '@/domain/soldout.js'

const props = defineProps({
  course: { type: Object, required: true },
  rank: { type: Number, default: 0 }
})

const label = computed(() => genreLabel(props.course.category))
const soldOut = computed(() => isSoldOut(props.course))
const almostGone = computed(() => isAlmostGone(props.course))
const left = computed(() => seatsLeft(props.course))
const price = computed(() => Number(props.course.price || 0).toLocaleString())

// description에 일시·장소 안내가 들어온다(명세서 4.3). 카드에는 첫 줄만.
const oneLine = computed(() => {
  const d = (props.course.description || '').trim()
  if (!d) return '공연 정보는 상세에서 확인하세요'
  return d.split('\n')[0]
})
</script>

<style scoped>
.card { display: block; }
.thumb {
  position: relative;
  border-radius: var(--r);
  overflow: hidden;
  background: var(--bg-dim);
  transition: box-shadow .18s var(--ease);
}
.card:hover .thumb { box-shadow: var(--shadow-up); }
.rank {
  position: absolute;
  top: 0; left: 0;
  min-width: 30px;
  height: 30px;
  padding: 0 8px;
  display: grid;
  place-items: center;
  background: var(--red);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
}

/* 매진 표시. 포스터 가운데를 덮으면 공연명과 겹쳐 둘 다 못 읽는다.
   실제 예매 사이트처럼 하단 띠로 두고, 포스터는 살짝 눌러 구분한다. */
.thumb:has(.sold) :deep(.poster) { filter: saturate(.45) brightness(.72); }
.sold {
  position: absolute;
  left: 0; right: 0; bottom: 0;
  padding: 7px 0;
  text-align: center;
  background: rgba(14,17,22,.88);
  color: #fff;
  font-size: 12.5px;
  font-weight: 700;
  letter-spacing: .1em;
}

.info { padding: 11px 2px 0; }
.ttl {
  margin: 7px 0 3px;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.4;
  letter-spacing: -0.04em;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.card:hover .ttl { text-decoration: underline; text-underline-offset: 3px; }
.desc {
  font-size: 12.5px;
  color: var(--t3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.foot {
  margin-top: 9px;
  padding-top: 9px;
  border-top: 1px solid var(--line);
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.price { font-size: 15px; font-weight: 700; letter-spacing: -0.03em; }
.price em { font-style: normal; font-size: 12px; font-weight: 500; margin-left: 1px; }
.cnt { font-size: 12px; color: var(--t3); }
.cnt.few { color: var(--red); font-weight: 700; }
</style>
