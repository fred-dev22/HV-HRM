<template>
  <ListPageLayout
    title="Notes participants"
    subtitle="Vue consolidée des évaluations à chaud et à froid par participant"
    :columns="columns"
    :items="pageItems"
    :total="totalCount"
    :total-text="`${totalCount} évaluation(s)`"
    search-placeholder="Rechercher un employé, une formation…"
    :page-size-options="[15, 25, 50]"
    v-model:search-query="searchQuery"
    v-model:sort-key="sortKey"
    v-model:sort-dir="sortDir"
    v-model:page="page"
    v-model:page-size="pageSize"
    @reset-filters="searchQuery = ''"
  >
    <!-- KPI -->
    <template #above-table>
      <div class="grid grid-cols-2 gap-2.5 mb-3.5 max-md:grid-cols-1">
        <div :class="kpiItem">
          <div :class="kpiIcon" class="bg-warning-bg"><Flame class="w-[18px] h-[18px] text-warning" /></div>
          <div><div :class="kpiVal">{{ avgHot }}</div><div :class="kpiLbl">Moyenne évaluations à chaud (/5)</div></div>
        </div>
        <div :class="kpiItem">
          <div :class="kpiIcon" class="bg-info-bg"><Snowflake class="w-[18px] h-[18px] text-info" /></div>
          <div><div :class="kpiVal">{{ avgCold }}</div><div :class="kpiLbl">Moyenne évaluations à froid (/5)</div></div>
        </div>
      </div>
    </template>

    <template #cell-employeeName="{ item }"><span class="font-medium text-foreground text-xs truncate">{{ item.employeeName }}</span></template>
    <template #cell-courseTitle="{ item }"><span class="text-muted-foreground text-xs truncate">{{ item.courseTitle }}</span></template>
    <template #cell-sessionScheduledAt="{ item }"><span class="text-xs text-foreground whitespace-nowrap">{{ formatDate(item.sessionScheduledAt) }}</span></template>
    <template #cell-hotScore="{ item }">
      <span v-if="item.hotEvaluation" class="text-xs font-medium text-foreground">{{ item.hotEvaluation.score }}/5</span>
      <span v-else class="text-xs text-muted-foreground">-</span>
    </template>
    <template #cell-coldScore="{ item }">
      <span v-if="item.coldEvaluation" class="text-xs font-medium text-foreground">{{ item.coldEvaluation.score }}/5</span>
      <span v-else class="text-xs text-muted-foreground">-</span>
    </template>

    <template #details-panel="{ item }">
      <div class="flex flex-col gap-3.5">
        <div>
          <div class="text-sm font-semibold text-foreground truncate">{{ item.employeeName }}</div>
          <div class="text-[11px] text-muted-foreground truncate">{{ item.courseTitle }}</div>
        </div>
        <div v-if="item.hotEvaluation" :class="L.card">
          <div :class="L.cardTitle" class="mb-1"><Flame class="w-3.5 h-3.5 text-warning" /> À chaud : {{ item.hotEvaluation.score }}/5</div>
          <p class="text-[12px] text-muted-foreground">{{ item.hotEvaluation.comment }}</p>
        </div>
        <div v-if="item.coldEvaluation" :class="L.card">
          <div :class="L.cardTitle" class="mb-1"><Snowflake class="w-3.5 h-3.5 text-info" /> À froid : {{ item.coldEvaluation.score }}/5</div>
          <p class="text-[12px] text-muted-foreground">{{ item.coldEvaluation.comment }}</p>
        </div>
      </div>
    </template>

    <template #empty>
      <Star class="w-8 h-8" />
      <p class="text-[13px]">Aucune évaluation enregistrée</p>
    </template>
  </ListPageLayout>
</template>

<script setup lang="ts">
/**
 * Notes participants, module Formation (design uniquement, données
 * fictives, voir src/stores/training). Vue consolidée en lecture seule des
 * évaluations à chaud/à froid déjà soumises (HotEvaluationsView /
 * ColdEvaluationsView traitent les relances en attente).
 */
import { ref, computed, watch } from 'vue'
import { Flame, Snowflake, Star } from 'lucide-vue-next'
import { ListPageLayout } from '../../components'
import type { ListColumn } from '../../components/shared/ListPageLayout.vue'
import * as L from '../../lib/listClasses'
import { formatDate } from '../../lib/date'
import { useEnrollmentStore } from '../../stores/training'
import type { Enrollment } from '../../stores/training'

const enrollmentStore = useEnrollmentStore()

const kpiItem = 'bg-card border border-border rounded-lg px-3.5 py-3 flex items-center gap-3'
const kpiIcon = 'w-9 h-9 rounded-lg flex items-center justify-center shrink-0'
const kpiVal = 'text-[22px] font-bold leading-none'
const kpiLbl = 'text-xs text-muted-foreground mt-0.5'

const columns: ListColumn[] = [
  { key: 'employeeName', label: 'Employé', sortable: true, hideable: false, width: 180 },
  { key: 'courseTitle', label: 'Formation', sortable: true, width: 220 },
  { key: 'sessionScheduledAt', label: 'Session', sortable: true, width: 130 },
  { key: 'hotScore', label: 'À chaud', align: 'center', width: 100 },
  { key: 'coldScore', label: 'À froid', align: 'center', width: 100 },
]

const evaluated = computed(() => enrollmentStore.items.filter(e => e.hotEvaluation || e.coldEvaluation))

const avgHot = computed(() => {
  const scores = evaluated.value.filter(e => e.hotEvaluation).map(e => e.hotEvaluation!.score)
  return scores.length ? (scores.reduce((s, v) => s + v, 0) / scores.length).toFixed(1) : '-'
})
const avgCold = computed(() => {
  const scores = evaluated.value.filter(e => e.coldEvaluation).map(e => e.coldEvaluation!.score)
  return scores.length ? (scores.reduce((s, v) => s + v, 0) / scores.length).toFixed(1) : '-'
})

const searchQuery = ref('')
const sortKey = ref('sessionScheduledAt')
const sortDir = ref<'asc' | 'desc'>('desc')
const page = ref(1)
const pageSize = ref(15)
watch([searchQuery, pageSize], () => { page.value = 1 })

const filtered = computed(() => {
  let rows = evaluated.value
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    rows = rows.filter(e => e.employeeName.toLowerCase().includes(q) || e.courseTitle.toLowerCase().includes(q))
  }
  return [...rows].sort((a, b) => {
    const cmp = a.sessionScheduledAt.localeCompare(b.sessionScheduledAt)
    return sortDir.value === 'asc' ? cmp : -cmp
  })
})

const totalCount = computed(() => filtered.value.length)
const pageItems = computed(() => filtered.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value))
</script>
