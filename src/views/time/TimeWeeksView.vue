<template>
  <ListPageLayout
    :embedded="embedded"
    title="Validation hebdomadaire"
    :subtitle="isHr ? 'Les semaines de pointage de tous les employés : le manager contrôle, vous validez.' : 'Les semaines de pointage de votre équipe : corrigez puis marquez-les contrôlées. Le RH les valide ensuite.'"
    :columns="columns"
    :items="rows"
    :total="total"
    :total-text="`${total} employé(s)`"
    :loading="loading"
    row-key="employeeId"
    search-placeholder="Rechercher un employé, un matricule..."
    :storage-key="`time-weeks-${auth.user?.id ?? ''}`"
    v-model:search-query="search"
    v-model:page="page"
    v-model:page-size="pageSize"
    @reset-filters="search = ''"
    @open-card="(item) => (openId = item.employeeId)"
  >
    <template #above-table>
      <div class="flex items-center gap-2 flex-wrap mb-3.5">
        <button :class="L.btnOutline" title="Semaine précédente" @click="monday = addDays(monday, -7)"><ChevronLeft class="w-4 h-4" /></button>
        <div class="text-[13px] font-semibold text-foreground min-w-[270px] text-center">
          Semaine {{ weekNumber || '...' }}, du {{ formatDate(monday) }} au {{ formatDate(addDays(monday, 6)) }}
        </div>
        <button :class="L.btnOutline" title="Semaine suivante" @click="monday = addDays(monday, 7)"><ChevronRight class="w-4 h-4" /></button>
        <input :value="monday" type="date" :class="L.fpSelect" class="!w-auto" aria-label="Aller à la semaine du" @change="pick(($event.target as HTMLInputElement).value)" />
      </div>
    </template>

    <template #row-actions="{ item }">
      <button :class="quickBtn" @click="openId = item.employeeId">Ouvrir la semaine</button>
    </template>

    <template #cell-employee="{ item }">
      <div class="flex items-center gap-2">
        <UserAvatar :name="item.name" size="sm" />
        <div class="min-w-0">
          <div class="font-medium whitespace-nowrap">{{ item.name }}</div>
          <div class="text-[10px] text-muted-foreground">{{ item.code }}<span v-if="item.isCadre"> · cadre</span></div>
        </div>
      </div>
    </template>
    <template #cell-worked="{ item }"><span class="whitespace-nowrap">{{ formatHours(item.worked) }}</span></template>
    <template #cell-overtime="{ item }"><span :class="item.overtime > 0 ? 'text-success font-medium' : ''">{{ formatHours(item.overtime) }}</span></template>
    <template #cell-check="{ item }">
      <div class="flex flex-col gap-0.5 text-[11px]">
        <span v-if="item.incompleteDays" class="text-warning">{{ item.incompleteDays }} jour(s) incomplet(s)</span>
        <span v-if="item.pendingEntries" class="text-warning">{{ item.pendingEntries }} saisie(s) en attente</span>
        <span v-if="item.corrected" class="text-muted-foreground">Corrigée</span>
        <span v-if="!item.incompleteDays && !item.pendingEntries && !item.corrected" class="text-muted-foreground">-</span>
      </div>
    </template>
    <template #cell-status="{ item }">
      <span class="text-[11px] font-medium px-2 py-[2px] rounded-full whitespace-nowrap" :class="STATUS_CLASSES[item.status as WeekStatus]">{{ WEEK_STATUS_LABELS[item.status as WeekStatus] }}</span>
    </template>

    <!-- Aperçu rapide -->
    <template #details-panel="{ item }">
      <div class="flex flex-col gap-3.5">
        <div class="flex items-center gap-2.5">
          <UserAvatar :name="item.name" size="md" />
          <div class="min-w-0">
            <div class="text-sm font-semibold text-foreground truncate">{{ item.name }}</div>
            <div class="text-[11px] text-muted-foreground">{{ item.code }}<span v-if="item.isCadre"> · cadre</span></div>
          </div>
        </div>
        <div><span class="text-[11px] font-medium px-2 py-[2px] rounded-full whitespace-nowrap" :class="STATUS_CLASSES[item.status as WeekStatus]">{{ WEEK_STATUS_LABELS[item.status as WeekStatus] }}</span></div>
        <div class="grid grid-cols-2 gap-2 text-[12px]">
          <div class="col-span-2"><div class="text-muted-foreground text-[11px]">Semaine {{ weekNumber || '...' }}</div>Du {{ formatDate(monday) }} au {{ formatDate(addDays(monday, 6)) }}</div>
          <div><div class="text-muted-foreground text-[11px]">Travaillé</div>{{ formatHours(item.worked) }}</div>
          <div><div class="text-muted-foreground text-[11px]">Heures supp.</div>{{ formatHours(item.overtime) }}</div>
          <div><div class="text-muted-foreground text-[11px]">Jours incomplets</div><span :class="item.incompleteDays ? 'text-warning' : ''">{{ item.incompleteDays }}</span></div>
          <div><div class="text-muted-foreground text-[11px]">Saisies en attente</div><span :class="item.pendingEntries ? 'text-warning' : ''">{{ item.pendingEntries }}</span></div>
        </div>
        <div v-if="item.corrected" class="text-[12px] text-muted-foreground">Cette semaine a été corrigée.</div>
        <button :class="L.btnPrimary" class="w-full justify-center" @click="openId = item.employeeId">Ouvrir la semaine</button>
      </div>
    </template>

    <template #empty>
      <CalendarCheck class="w-8 h-8" />
      <p class="text-[13px]">{{ search ? 'Aucun employé pour cette recherche.' : 'Aucun employé dans votre périmètre.' }}</p>
    </template>

    <TimeWeekCard v-if="openId" :rows="rows" :employee-id="openId" :week-start="monday" @close="openId = null" @changed="load" @week="(w) => (monday = w)" />
  </ListPageLayout>
</template>

<script setup lang="ts">
/**
 * Validation hebdomadaire : les employes et l'etat de leur semaine, sur la liste
 * standard du HRM. La semaine ouverte par defaut est la derniere terminee.
 */
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { CalendarCheck, ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { UserAvatar, ListPageLayout } from '../../components'
import type { ListColumn } from '../../components/shared/ListPageLayout.vue'
import TimeWeekCard from '../../components/time/TimeWeekCard.vue'
import * as L from '../../lib/listClasses'
import { formatDate, todayIso } from '../../lib/date'
import { getApiErrorMessage } from '../../lib/api'
import { useAuthStore } from '../../stores/auth'
import { useToastStore } from '../../stores/toast'
import { useTimeWeekStore, WEEK_STATUS_LABELS, type WeekList, type WeekRow, type WeekStatus } from '../../stores/timeWeeks'
import { addDays, mondayOf } from '../../components/time/weekGrid'
import { formatHours } from '../../components/time/timeFormat'

defineProps<{ embedded?: boolean }>()

const auth = useAuthStore()
const store = useTimeWeekStore()
const toast = useToastStore()
const isHr = computed(() => auth.hasPermission('TEMPS_ACCES'))

const quickBtn = 'px-2.5 py-[5px] rounded text-xs font-medium cursor-pointer bg-background text-muted-foreground hover:text-foreground'
const STATUS_CLASSES: Record<WeekStatus, string> = {
  Open: 'bg-warning-bg text-warning', Controlled: 'bg-info-bg text-info', Validated: 'bg-success-bg text-success',
}
const columns: ListColumn[] = [
  { key: 'employee', label: 'Employé', hideable: false, width: 240 },
  { key: 'worked', label: 'Travaillé', width: 120 },
  { key: 'overtime', label: 'Heures supp.', width: 130 },
  { key: 'check', label: 'À vérifier', width: 220 },
  { key: 'status', label: 'État', width: 140 },
]

const monday = ref(addDays(mondayOf(todayIso()), -7))
const rows = ref<WeekRow[]>([])
const total = ref(0)
const weekNumber = ref(0)
const loading = ref(false)
const search = ref('')
const debouncedSearch = ref('')
const page = ref(1)
const pageSize = ref(10)
const openId = ref<string | null>(null)

function pick(date: string) { if (date) monday.value = mondayOf(date) }

let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, (v) => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { debouncedSearch.value = v }, 300) })
onBeforeUnmount(() => clearTimeout(searchTimer))
watch([debouncedSearch, pageSize], () => { page.value = 1 })

function show(list: WeekList) {
  rows.value = list.rows
  total.value = list.total
  weekNumber.value = list.weekNumber
}

let seq = 0
async function load() {
  const mine = ++seq
  // Derniere lecture gardee pour les memes criteres : affichee tout de suite, puis relue en silence.
  const key = 'weeks:' + JSON.stringify([monday.value, debouncedSearch.value, page.value, pageSize.value])
  const cached = store.cache[key] as WeekList | undefined
  if (cached) show(cached)
  loading.value = !cached
  try {
    const list = await store.fetchList(monday.value, { Search: debouncedSearch.value, Page: page.value, PageSize: pageSize.value })
    if (mine !== seq) return
    store.cache[key] = list
    show(list)
  } catch (e) {
    if (mine === seq) toast.error(getApiErrorMessage(e, 'Chargement des semaines impossible'))
  } finally {
    if (mine === seq) loading.value = false
  }
}
watch([monday, debouncedSearch, page, pageSize], load, { immediate: true })
</script>
