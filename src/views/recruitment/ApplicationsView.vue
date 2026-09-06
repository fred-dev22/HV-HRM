<template>
  <ListPageLayout
    title="Candidatures"
    :subtitle="`${filtered.length} candidature(s) liée(s) à une offre`"
    :columns="columns"
    :items="pageItems"
    :total="totalCount"
    :total-text="`${totalCount} candidature(s)`"
    search-placeholder="Rechercher un candidat, un email…"
    :page-size-options="[15, 25, 50]"
    scope-label="Candidatures :"
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
    <!-- Actions contextuelles (ligne sélectionnée) -->
    <template #row-actions="{ item }">
      <ApplicationWorkflowActions :item="item" />
    </template>

    <!-- KPIs -->
    <template #above-table>
      <div class="grid grid-cols-4 gap-2.5 mb-3.5 max-md:grid-cols-2">
        <div :class="kpiItem">
          <div :class="kpiIcon" class="bg-primary/10"><Users class="w-[18px] h-[18px] text-primary" /></div>
          <div><div :class="kpiVal">{{ applicationStore.fromOffers.length }}</div><div :class="kpiLbl">Total</div></div>
        </div>
        <div :class="kpiItem">
          <div :class="kpiIcon" class="bg-info-bg"><UserPlus class="w-[18px] h-[18px] text-info" /></div>
          <div><div :class="kpiVal">{{ newCount }}</div><div :class="kpiLbl">Nouvelles</div></div>
        </div>
        <div :class="kpiItem">
          <div :class="kpiIcon" class="bg-warning-bg"><Clock class="w-[18px] h-[18px] text-warning" /></div>
          <div><div :class="kpiVal">{{ inReviewCount }}</div><div :class="kpiLbl">En cours</div></div>
        </div>
        <div :class="kpiItem">
          <div :class="kpiIcon" class="bg-success-bg"><UserCheck class="w-[18px] h-[18px] text-success" /></div>
          <div><div :class="kpiVal">{{ retainedCount }}</div><div :class="kpiLbl">Retenues</div></div>
        </div>
      </div>
    </template>

    <!-- Cellules -->
    <template #cell-candidate="{ item }">
      <span class="inline-flex items-center gap-1.5 min-w-0">
        <span class="font-medium text-foreground text-[13px] truncate">{{ item.candidateName }}</span>
        <span v-if="item.source === 'Internal'" class="text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap bg-info-bg text-info shrink-0" title="Employé existant, candidature interne">Interne</span>
      </span>
    </template>
    <template #cell-candidateEmail="{ item }"><span class="text-muted-foreground text-xs truncate">{{ item.candidateEmail || '—' }}</span></template>
    <template #cell-candidatePhone="{ item }"><span class="text-muted-foreground text-xs whitespace-nowrap">{{ item.candidatePhone || '—' }}</span></template>
    <template #cell-jobOfferTitle="{ item }"><span class="text-foreground text-xs truncate">{{ item.jobOfferTitle || 'Candidature spontanée' }}</span></template>
    <template #cell-cvFileName="{ item }">
      <span v-if="item.cvFileName" class="inline-flex items-center gap-1 text-xs text-muted-foreground min-w-0">
        <FileText class="w-3.5 h-3.5 shrink-0" /> <span class="truncate">{{ item.cvFileName }}</span>
      </span>
      <span v-else class="text-xs text-muted-foreground">—</span>
    </template>
    <template #cell-status="{ item }"><StatusPill :status="item.status" /></template>
    <template #cell-appliedAt="{ item }"><span class="text-muted-foreground text-xs">{{ formatDate(item.appliedAt) }}</span></template>

    <!-- Aperçu rapide -->
    <template #details-panel="{ item }">
      <div class="flex flex-col gap-3.5">
        <div>
          <div class="text-sm font-semibold text-foreground truncate flex items-center gap-1.5">
            {{ item.candidateName }}
            <span v-if="item.source === 'Internal'" class="text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap bg-info-bg text-info">Interne</span>
          </div>
          <div class="text-[11px] text-muted-foreground truncate">{{ item.candidateEmail || 'Candidature interne, sans email' }}</div>
        </div>
        <div><StatusPill :status="item.status" /></div>

        <div class="grid grid-cols-1 gap-2 text-[12px]">
          <div><div class="text-muted-foreground text-[11px]">Offre liée</div>{{ item.jobOfferTitle || 'Candidature spontanée' }}</div>
          <div><div class="text-muted-foreground text-[11px]">Candidature reçue le</div>{{ formatDate(item.appliedAt) }}</div>
        </div>

        <ApplicationWorkflowActions :item="item" />

        <button :class="L.btnPrimary" class="w-full justify-center" @click="openCard(item)">Ouvrir la fiche</button>
      </div>
    </template>

    <template #empty>
      <Users class="w-8 h-8" />
      <p class="text-[13px]">Aucune candidature pour le moment.</p>
    </template>

    <!-- Fiche (double-clic ou "Ouvrir la fiche") -->
    <ApplicationCard v-if="openCardId !== null" :items="filtered" :item-id="openCardId" @close="openCardId = null" />
  </ListPageLayout>
</template>

<script setup lang="ts">
/**
 * Liste des candidatures liées à une offre (Application, source "Offer"),
 * module Recrutement, design uniquement (données fictives, voir
 * src/stores/recruitment). Calquée sur EmployeeListView.vue et
 * HiringRequestsView.vue.
 */
import { ref, watch, computed } from 'vue'
import { Users, UserPlus, UserCheck, Clock, FileText } from 'lucide-vue-next'
import { ListPageLayout, StatusPill } from '../../components'
import type { ListColumn } from '../../components/shared/ListPageLayout.vue'
import ApplicationCard from '../../components/recruitment/ApplicationCard.vue'
import ApplicationWorkflowActions from '../../components/recruitment/ApplicationWorkflowActions.vue'
import * as L from '../../lib/listClasses'
import { formatDate } from '../../lib/date'
import { useApplicationStore } from '../../stores/recruitment'
import type { Application } from '../../stores/recruitment'

const applicationStore = useApplicationStore()

/* ── Fiche plein écran ──────────────────────────────────────── */
const openCardId = ref<string | null>(null)
function openCard(item: Application) { openCardId.value = item.id }

/* ── Styles (KPI, repris à l'identique d'EmployeeListView.vue) ────── */
const kpiItem = 'bg-card border border-border rounded-lg px-3.5 py-3 flex items-center gap-3'
const kpiIcon = 'w-9 h-9 rounded-lg flex items-center justify-center shrink-0'
const kpiVal = 'text-[22px] font-bold leading-none'
const kpiLbl = 'text-xs text-muted-foreground mt-0.5'

/* ── Colonnes ───────────────────────────────────────────────── */
const columns: ListColumn[] = [
  { key: 'candidate', label: 'Candidat', sortable: true, hideable: false, width: 180 },
  { key: 'candidateEmail', label: 'Email', width: 200 },
  { key: 'candidatePhone', label: 'Téléphone', width: 130 },
  { key: 'jobOfferTitle', label: 'Offre liée', sortable: true, width: 180 },
  { key: 'cvFileName', label: 'CV', width: 170 },
  { key: 'status', label: 'Statut', width: 150 },
  { key: 'appliedAt', label: 'Date de candidature', sortable: true, width: 150 },
]

/* ── KPIs ───────────────────────────────────────────────────── */
const newCount = computed(() => applicationStore.fromOffers.filter(a => a.status === 'New').length)
const inReviewCount = computed(() => applicationStore.fromOffers.filter(a => a.status === 'InReview').length)
const retainedCount = computed(() => applicationStore.fromOffers.filter(a => a.status === 'Retained').length)

/* ── Scope / recherche / tri / pagination ──────────────────────
   Même pattern que EmployeeListView.vue : la vue calcule elle-même
   "filtered" puis passe la page déjà filtrée/triée à ListPageLayout. */
const scopeOptions = [
  { value: '', label: 'Toutes' },
  { value: 'New', label: 'Nouvelle' },
  { value: 'InReview', label: 'En cours' },
  { value: 'InterviewScheduled', label: 'Entretien planifié' },
  { value: 'Retained', label: 'Retenue' },
  { value: 'Rejected', label: 'Refusé' },
]
const activeScope = ref('')
const searchQuery = ref('')
const sortKey = ref('')
const sortDir = ref<'asc' | 'desc'>('asc')
const page = ref(1)
const pageSize = ref(15)

watch([activeScope, searchQuery, pageSize], () => { page.value = 1 })

function resetFilters() {
  searchQuery.value = ''; activeScope.value = ''; page.value = 1
}

const sortFieldMap: Partial<Record<string, keyof Application>> = {
  candidate: 'candidateName', jobOfferTitle: 'jobOfferTitle', appliedAt: 'appliedAt',
}

const filtered = computed(() => {
  let rows = applicationStore.fromOffers.filter(a => {
    if (activeScope.value && a.status !== activeScope.value) return false
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      if (
        !a.candidateName.toLowerCase().includes(q) &&
        !a.candidateEmail.toLowerCase().includes(q) &&
        !(a.jobOfferTitle ?? '').toLowerCase().includes(q)
      ) return false
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
