<template>
  <ListPageLayout
    embedded
    :title="kind === 'team' ? 'Synthèse de l\'équipe' : 'Rapport global'"
    :columns="columns"
    :items="rows"
    :total="total"
    :total-text="`${total} employé(s)`"
    :loading="loading"
    row-key="employeeId"
    search-placeholder="Rechercher un employé, un matricule..."
    :storage-key="`time-sheets-${kind}`"
    v-model:search-query="search"
    v-model:page="page"
    v-model:page-size="pageSize"
    @reset-filters="search = ''"
    @open-card="(row) => emit('open', row, rows)"
  >
    <template #header-actions>
      <button :class="L.btnOutline" :disabled="exporting || total === 0" @click="exportCsv"><FileDown class="w-4 h-4" /> Exporter</button>
    </template>

    <!-- Période et totaux de tous les employés -->
    <template #above-table>
      <div class="flex items-end gap-3 flex-wrap mb-3.5">
        <div :class="cls.field"><label :class="cls.fieldLabel">Du</label><input v-model="from" type="date" :class="cls.fieldInput" /></div>
        <div :class="cls.field"><label :class="cls.fieldLabel">Au</label><input v-model="to" type="date" :class="cls.fieldInput" :min="from" /></div>
        <p class="text-[12px] text-muted-foreground pb-2">Cliquez deux fois sur une ligne pour voir le détail jour par jour.</p>
      </div>
      <div class="grid grid-cols-4 gap-2.5 mb-3.5 max-md:grid-cols-2">
        <div v-for="k in kpis" :key="k.label" :class="kpiItem">
          <div :class="kpiIcon" :style="{ background: k.bg }"><component :is="k.icon" class="w-[18px] h-[18px]" :style="{ color: k.color }" /></div>
          <div><div :class="kpiVal">{{ k.value }}</div><div :class="kpiLbl">{{ k.label }}</div></div>
        </div>
      </div>
    </template>

    <template #cell-employee="{ item }">
      <div class="flex items-center gap-2">
        <UserAvatar :name="item.name" size="sm" />
        <div class="min-w-0">
          <div class="font-medium whitespace-nowrap">{{ item.name }}</div>
          <div class="text-[10px] text-muted-foreground">{{ item.employeeNumber }}</div>
        </div>
      </div>
    </template>
    <template #cell-required="{ item }">{{ formatHours(item.required) }}</template>
    <template #cell-worked="{ item }">{{ formatHours(item.worked) }}</template>
    <template #cell-overtime="{ item }"><span :class="item.overtime > 0 ? 'text-success font-medium' : ''">{{ formatHours(item.overtime) }}</span></template>
    <template #cell-absence="{ item }"><span :class="item.absence > 0 ? 'text-danger font-medium' : ''">{{ formatHours(item.absence) }}</span></template>
    <template #cell-paid="{ item }">{{ item.paidOvertime ? formatHours(item.paidOvertime) : '-' }}</template>
    <template #cell-presence="{ item }">{{ item.presenceRate === null ? '-' : `${item.presenceRate} %` }}</template>

    <!-- Aperçu rapide -->
    <template #details-panel="{ item }">
      <div class="flex flex-col gap-3.5">
        <div class="flex items-center gap-2.5">
          <UserAvatar :name="item.name" size="md" />
          <div class="min-w-0">
            <div class="text-sm font-semibold text-foreground truncate">{{ item.name }}</div>
            <div class="text-[11px] text-muted-foreground">{{ item.employeeNumber }}</div>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-2 text-[12px]">
          <div><div class="text-muted-foreground text-[11px]">Prévu</div>{{ formatHours(item.required) }}</div>
          <div><div class="text-muted-foreground text-[11px]">Travaillé</div>{{ formatHours(item.worked) }}</div>
          <div><div class="text-muted-foreground text-[11px]">Heures supp.</div>{{ formatHours(item.overtime) }}</div>
          <div><div class="text-muted-foreground text-[11px]">Absences</div>{{ formatHours(item.absence) }}</div>
          <div><div class="text-muted-foreground text-[11px]">HS payées</div>{{ item.paidOvertime ? formatHours(item.paidOvertime) : '-' }}</div>
          <div><div class="text-muted-foreground text-[11px]">Présence</div>{{ item.presenceRate === null ? '-' : `${item.presenceRate} %` }}</div>
        </div>
        <button :class="L.btnPrimary" class="w-full justify-center" @click="emit('open', item, rows)">Voir le détail</button>
      </div>
    </template>

    <template #empty>
      <Users class="w-8 h-8" />
      <p class="text-[13px]">Aucun employé.</p>
    </template>
  </ListPageLayout>
</template>

<script setup lang="ts">
/**
 * Synthese des feuilles de temps par employe sur une periode (globale pour le
 * RH, equipe pour un validateur), sur la liste standard du HRM : recherche et
 * pagination faites par le serveur, totaux calcules sur l'ensemble.
 */
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { FileDown, Users, Clock, Briefcase, TrendingUp, UserX } from 'lucide-vue-next'
import { UserAvatar, ListPageLayout } from '../index'
import type { ListColumn } from '../shared/ListPageLayout.vue'
import * as cls from '../../lib/formClasses'
import * as L from '../../lib/listClasses'
import { todayIso } from '../../lib/date'
import { getApiErrorMessage } from '../../lib/api'
import { useToastStore } from '../../stores/toast'
import { useTimeStore, type TimesheetRow, type TimesheetSummary } from '../../stores/time'
import { formatHours, downloadCsv } from './timeFormat'

const props = defineProps<{ kind: 'global' | 'team' }>()
const emit = defineEmits<{ open: [row: TimesheetRow, rows: TimesheetRow[]]; period: [from: string, to: string] }>()

const store = useTimeStore()
const toast = useToastStore()

const kpiItem = 'bg-card border border-border rounded-lg px-3.5 py-3 flex items-center gap-3'
const kpiIcon = 'w-9 h-9 rounded-lg flex items-center justify-center shrink-0'
const kpiVal = 'text-[22px] font-bold leading-none'
const kpiLbl = 'text-xs text-muted-foreground mt-0.5'

const columns: ListColumn[] = [
  { key: 'employee', label: 'Employé', hideable: false, width: 240 },
  { key: 'required', label: 'Prévu', width: 100 },
  { key: 'worked', label: 'Travaillé', width: 110 },
  { key: 'overtime', label: 'Heures supp.', width: 120 },
  { key: 'absence', label: 'Absences', width: 110 },
  { key: 'paid', label: 'HS payées', width: 110 },
  { key: 'presence', label: 'Présence', width: 100 },
]

const today = todayIso()
const from = ref(`${today.slice(0, 8)}01`)
const to = ref(today)
const search = ref('')
const debouncedSearch = ref('')
const page = ref(1)
const pageSize = ref(10)
const rows = ref<TimesheetRow[]>([])
const total = ref(0)
const totals = ref<TimesheetSummary['meta']['totals'] | null>(null)
const loading = ref(false)
const exporting = ref(false)

let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, (v) => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { debouncedSearch.value = v }, 300) })
onBeforeUnmount(() => clearTimeout(searchTimer))
watch([debouncedSearch, from, to, pageSize], () => { page.value = 1 })

// Totaux de tous les employes de la periode (pas seulement de la page).
const kpis = computed(() => [
  { label: 'Heures prévues', value: formatHours(totals.value?.required ?? 0), icon: Clock, bg: 'var(--color-info-bg)', color: 'var(--color-info)' },
  { label: 'Heures travaillées', value: formatHours(totals.value?.worked ?? 0), icon: Briefcase, bg: 'var(--color-success-bg)', color: 'var(--color-success)' },
  { label: 'Heures supplémentaires', value: formatHours(totals.value?.overtime ?? 0), icon: TrendingUp, bg: 'var(--color-warning-bg)', color: 'var(--color-warning)' },
  { label: 'Absences', value: formatHours(totals.value?.absence ?? 0), icon: UserX, bg: 'var(--color-danger-bg)', color: 'var(--color-danger)' },
])

let seq = 0
async function load() {
  if (!from.value || !to.value || from.value > to.value) return
  const mine = ++seq
  loading.value = true
  try {
    const res = await store.fetchTimesheetSummary(props.kind, { From: from.value, To: to.value, Search: debouncedSearch.value, Page: page.value, PageSize: pageSize.value })
    if (mine !== seq) return
    rows.value = res.items
    total.value = res.total
    totals.value = res.meta.totals
    emit('period', from.value, to.value)
  } catch (e) {
    if (mine === seq) toast.error(getApiErrorMessage(e, 'Chargement impossible'))
  } finally {
    if (mine === seq) loading.value = false
  }
}
watch([() => props.kind, from, to, debouncedSearch, page, pageSize], load, { immediate: true })

const num = (n: number) => n.toString().replace('.', ',')

async function exportCsv() {
  exporting.value = true
  try {
    const out: (string | number)[][] = []
    for (let p = 1; p <= 50; p++) {
      const res = await store.fetchTimesheetSummary(props.kind, { From: from.value, To: to.value, Search: debouncedSearch.value, Page: p, PageSize: 100 })
      for (const r of res.items) out.push([r.employeeNumber, r.name, num(r.required), num(r.worked), num(r.overtime), num(r.absence), num(r.paidOvertime), r.presenceRate === null ? '' : num(r.presenceRate)])
      if (out.length >= res.total || res.items.length === 0) break
    }
    downloadCsv(`feuilles-de-temps-${from.value}-${to.value}.csv`, ['Matricule', 'Employé', 'Heures prévues', 'Heures travaillées', 'Heures supp.', 'Absences', 'HS payées', 'Présence (%)'], out)
  } catch (e) {
    toast.error(getApiErrorMessage(e, 'Export impossible'))
  } finally {
    exporting.value = false
  }
}
</script>
