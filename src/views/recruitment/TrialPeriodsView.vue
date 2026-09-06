<template>
  <ListPageLayout
    title="Périodes d'essai"
    :subtitle="`${trialStore.items.length} période(s) d'essai`"
    :columns="columns"
    :items="pageItems"
    :total="totalCount"
    :total-text="`${totalCount} période(s) d'essai`"
    search-placeholder="Rechercher un employé, un poste, une entité…"
    :page-size-options="[15, 25, 50]"
    scope-label="Périodes :"
    :scope-options="scopeOptions"
    v-model:scope="activeScope"
    v-model:search-query="searchQuery"
    v-model:sort-key="sortKey"
    v-model:sort-dir="sortDir"
    v-model:page="page"
    v-model:page-size="pageSize"
    @reset-filters="resetFilters"
    @open-card="openCard"
  >
    <!-- KPIs -->
    <template #above-table>
      <div class="grid grid-cols-4 gap-2.5 mb-3.5 max-md:grid-cols-2">
        <div :class="kpiItem">
          <div :class="kpiIcon" class="bg-primary/10"><Users class="w-[18px] h-[18px] text-primary" /></div>
          <div><div :class="kpiVal">{{ trialStore.items.length }}</div><div :class="kpiLbl">Total</div></div>
        </div>
        <div :class="kpiItem">
          <div :class="kpiIcon" class="bg-warning-bg"><Clock class="w-[18px] h-[18px] text-warning" /></div>
          <div><div :class="kpiVal">{{ onTrialCount }}</div><div :class="kpiLbl">En cours</div></div>
        </div>
        <div :class="kpiItem">
          <div :class="kpiIcon" class="bg-info-bg"><CalendarClock class="w-[18px] h-[18px] text-info" /></div>
          <div><div :class="kpiVal">{{ extendedCount }}</div><div :class="kpiLbl">Prolongées</div></div>
        </div>
        <div :class="kpiItem">
          <div :class="kpiIcon" class="bg-success-bg"><UserCheck class="w-[18px] h-[18px] text-success" /></div>
          <div><div :class="kpiVal">{{ convertedCount }}</div><div :class="kpiLbl">Converties</div></div>
        </div>
      </div>
    </template>

    <!-- Actions contextuelles (ligne sélectionnée) -->
    <template #row-actions="{ item }">
      <TrialEmployeeWorkflowActions :item="item" />
    </template>

    <!-- Filtres -->
    <template #filters>
      <div :class="L.fpField">
        <label :class="L.fpFieldLabel">Entité</label>
        <select v-model="fEntity" :class="L.fpSelect">
          <option value="">Entité</option>
          <option v-for="e in entityStore.approvedEntities" :key="e.id" :value="e.name">{{ e.code }} · {{ e.name }}</option>
        </select>
      </div>
      <button class="mt-auto py-[7px] bg-transparent border-0 text-xs text-muted-foreground cursor-pointer text-left hover:text-primary" @click="resetFilters">Réinitialiser les filtres</button>
    </template>

    <!-- Cellules -->
    <template #cell-employeeName="{ item }"><span class="font-medium text-foreground text-xs truncate">{{ item.employeeName }}</span></template>
    <template #cell-jobTitle="{ item }"><span class="text-muted-foreground text-xs truncate">{{ item.jobTitle }}</span></template>
    <template #cell-entityName="{ item }"><span class="text-muted-foreground text-xs truncate">{{ item.entityName }}</span></template>
    <template #cell-startDate="{ item }"><span class="text-muted-foreground text-xs">{{ formatDate(item.startDate) }}</span></template>
    <template #cell-trialEndDate="{ item }"><span class="text-muted-foreground text-xs">{{ formatDate(item.trialEndDate) }}</span></template>
    <template #cell-status="{ item }"><StatusPill :status="item.status" /></template>

    <!-- Aperçu rapide -->
    <template #details-panel="{ item }">
      <div class="flex flex-col gap-3.5">
        <div>
          <div class="text-sm font-semibold text-foreground truncate">{{ item.employeeName }}</div>
          <div class="text-[11px] text-muted-foreground truncate">{{ item.jobTitle }} · {{ item.entityName }}</div>
        </div>
        <div><StatusPill :status="item.status" /></div>
        <div class="grid grid-cols-2 gap-2 text-[12px]">
          <div><div class="text-muted-foreground text-[11px]">Début</div>{{ formatDate(item.startDate) }}</div>
          <div><div class="text-muted-foreground text-[11px]">Fin d'essai</div>{{ formatDate(item.trialEndDate) }}</div>
        </div>

        <button :class="L.btnPrimary" class="w-full justify-center" @click="openCard(item)">Ouvrir la fiche</button>

        <div class="pt-2 border-t border-border">
          <TrialEmployeeWorkflowActions :item="item" />
        </div>
      </div>
    </template>

    <template #empty>
      <Users class="w-8 h-8" />
      <p class="text-[13px]">Aucune période d'essai</p>
    </template>

    <!-- Fiche (double-clic ou "Ouvrir la fiche") -->
    <TrialEmployeeCard v-if="openCardId !== null" :items="filtered" :item-id="openCardId" @close="openCardId = null" />
  </ListPageLayout>
</template>

<script setup lang="ts">
/**
 * Périodes d'essai (TrialEmployee), module Recrutement, design uniquement
 * (données fictives, voir src/stores/recruitment). Calquée sur
 * EmployeeListView.vue / HiringRequestsView.vue : ListPageLayout + fiche
 * plein écran (TrialEmployeeCard) + actions de workflow réutilisables
 * (TrialEmployeeWorkflowActions), même pattern que le module Missions.
 */
import { ref, computed, watch } from 'vue'
import { Users, Clock, CalendarClock, UserCheck } from 'lucide-vue-next'
import { ListPageLayout, StatusPill } from '../../components'
import type { ListColumn } from '../../components/shared/ListPageLayout.vue'
import TrialEmployeeCard from '../../components/recruitment/TrialEmployeeCard.vue'
import TrialEmployeeWorkflowActions from '../../components/recruitment/TrialEmployeeWorkflowActions.vue'
import * as L from '../../lib/listClasses'
import { formatDate } from '../../lib/date'
import { useTrialStore } from '../../stores/recruitment'
import type { TrialEmployee } from '../../stores/recruitment'
import { useEntityStore } from '../../stores/entities'

const trialStore = useTrialStore()
const entityStore = useEntityStore()
if (entityStore.entities.length === 0) entityStore.fetchAll()

/* ── Styles KPI ─────────────────────────────────────────────── */
const kpiItem = 'bg-card border border-border rounded-lg px-3.5 py-3 flex items-center gap-3'
const kpiIcon = 'w-9 h-9 rounded-lg flex items-center justify-center shrink-0'
const kpiVal = 'text-[22px] font-bold leading-none'
const kpiLbl = 'text-xs text-muted-foreground mt-0.5'

/* ── Fiche plein écran ──────────────────────────────────────── */
const openCardId = ref<string | null>(null)
function openCard(item: TrialEmployee) { openCardId.value = item.id }

/* ── Colonnes ───────────────────────────────────────────────── */
const columns: ListColumn[] = [
  { key: 'employeeName', label: 'Employé', sortable: true, hideable: false, width: 180 },
  { key: 'jobTitle', label: 'Poste', sortable: true, width: 170 },
  { key: 'entityName', label: 'Entité', sortable: true, width: 170 },
  { key: 'startDate', label: 'Début', sortable: true, width: 120 },
  { key: 'trialEndDate', label: "Fin d'essai", sortable: true, width: 120 },
  { key: 'status', label: 'Statut', width: 140 },
]

/* ── KPIs ───────────────────────────────────────────────────── */
const onTrialCount = computed(() => trialStore.items.filter(t => t.status === 'OnTrial').length)
const extendedCount = computed(() => trialStore.items.filter(t => t.status === 'Extended').length)
const convertedCount = computed(() => trialStore.items.filter(t => t.status === 'Converted').length)

/* ── Scope / recherche / tri / pagination ──────────────────────
   Même pattern que EmployeeListView.vue : la vue calcule elle-même
   "filtered" puis passe la page déjà filtrée/triée à ListPageLayout. */
const scopeOptions = [
  { value: '', label: 'Toutes' },
  { value: 'OnTrial', label: 'En cours' },
  { value: 'Extended', label: 'Prolongée' },
  { value: 'Converted', label: 'Convertie' },
  { value: 'Cancelled', label: 'Annulée' },
]
const activeScope = ref('')
const fEntity = ref('')
const searchQuery = ref('')
const sortKey = ref('')
const sortDir = ref<'asc' | 'desc'>('asc')
const page = ref(1)
const pageSize = ref(15)

watch([activeScope, fEntity, searchQuery, pageSize], () => { page.value = 1 })

function resetFilters() {
  fEntity.value = ''; searchQuery.value = ''; activeScope.value = ''; page.value = 1
}

const sortFieldMap: Record<string, keyof TrialEmployee> = {
  employeeName: 'employeeName', jobTitle: 'jobTitle', entityName: 'entityName', startDate: 'startDate', trialEndDate: 'trialEndDate',
}

const filtered = computed(() => {
  let rows = trialStore.items.filter(t => {
    if (activeScope.value && t.status !== activeScope.value) return false
    if (fEntity.value && t.entityName !== fEntity.value) return false
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      if (!t.employeeName.toLowerCase().includes(q) && !t.jobTitle.toLowerCase().includes(q) && !t.entityName.toLowerCase().includes(q)) return false
    }
    return true
  })
  if (sortKey.value && sortFieldMap[sortKey.value]) {
    const f = sortFieldMap[sortKey.value]!
    rows = [...rows].sort((a, b) => {
      const cmp = String(a[f] ?? '').localeCompare(String(b[f] ?? ''))
      return sortDir.value === 'asc' ? cmp : -cmp
    })
  }
  return rows
})

const totalCount = computed(() => filtered.value.length)
const pageItems = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filtered.value.slice(start, start + pageSize.value)
})
</script>
