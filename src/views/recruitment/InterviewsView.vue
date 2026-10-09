<template>
  <ListPageLayout
    title="Entretiens"
    :subtitle="`${interviewStore.items.length} entretien(s)`"
    :columns="columns"
    :items="pageItems"
    :loading="interviewStore.loading"
    :total="totalCount"
    :total-text="`${totalCount} entretien(s)`"
    search-placeholder="Rechercher un candidat, une offre, un lieu…"
    :page-size-options="[15, 25, 50]"
    scope-label="Entretiens :"
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
    <template #header-actions>
      <button :class="L.btnPrimary" @click="showCreate = true">
        <Plus class="w-4 h-4" /> Planifier un entretien
      </button>
    </template>

    <!-- KPIs -->
    <template #above-table>
      <div class="grid grid-cols-4 gap-2.5 mb-3.5 max-md:grid-cols-2">
        <div :class="kpiItem">
          <div :class="kpiIcon" class="bg-tint"><CalendarClock class="w-[18px] h-[18px] text-primary" /></div>
          <div><div :class="kpiVal">{{ interviewStore.items.length }}</div><div :class="kpiLbl">Total</div></div>
        </div>
        <div :class="kpiItem">
          <div :class="kpiIcon" class="bg-warning-bg"><Clock class="w-[18px] h-[18px] text-warning" /></div>
          <div><div :class="kpiVal">{{ scheduledCount }}</div><div :class="kpiLbl">Planifiés</div></div>
        </div>
        <div :class="kpiItem">
          <div :class="kpiIcon" class="bg-success-bg"><CheckCircle2 class="w-[18px] h-[18px] text-success" /></div>
          <div><div :class="kpiVal">{{ doneCount }}</div><div :class="kpiLbl">Effectués</div></div>
        </div>
        <div :class="kpiItem">
          <div :class="kpiIcon" class="bg-info-bg"><CalendarDays class="w-[18px] h-[18px] text-info" /></div>
          <div><div :class="kpiVal">{{ todayCount }}</div><div :class="kpiLbl">Aujourd'hui</div></div>
        </div>
      </div>
    </template>

    <!-- Actions contextuelles (ligne sélectionnée) -->
    <template #row-actions="{ item }">
      <InterviewWorkflowActions :item="item" />
    </template>

    <!-- Cellules -->
    <template #cell-candidateName="{ item }"><span class="font-medium text-foreground text-xs truncate">{{ item.candidateName }}</span></template>
    <template #cell-jobOfferTitle="{ item }"><span class="text-muted-foreground text-xs truncate">{{ item.jobOfferTitle }}</span></template>
    <template #cell-scheduledAt="{ item }"><span class="text-muted-foreground text-xs whitespace-nowrap">{{ formatInterviewDateTime(item.scheduledAt) }}</span></template>
    <template #cell-location="{ item }">
      <a v-if="item.mode === 'VideoCall'" :href="item.meetingLink" target="_blank" rel="noopener" class="inline-flex items-center gap-1 text-primary text-xs truncate hover:underline" @click.stop>
        <Video class="w-3.5 h-3.5 shrink-0" /> Visioconférence
      </a>
      <span v-else class="inline-flex items-center gap-1 text-muted-foreground text-xs truncate">
        <MapPin class="w-3.5 h-3.5 shrink-0" /> {{ item.location }}
      </span>
    </template>
    <template #cell-participants="{ item }"><span class="text-muted-foreground text-xs truncate">{{ item.participants.map(p => p.name).join(', ') }}</span></template>
    <template #cell-rsvp="{ item }">
      <div class="flex items-center gap-1 flex-wrap">
        <span class="text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap" :class="rsvpPillClass(item.candidateRsvp)" :title="`Candidat : ${rsvpLabel(item.candidateRsvp)}`">
          C · {{ rsvpShort(item.candidateRsvp) }}
        </span>
        <span v-if="item.participants.length" class="text-[10px] text-muted-foreground whitespace-nowrap" :title="'Participants ayant accepté'">
          {{ participantsAccepted(item) }}/{{ item.participants.length }}
        </span>
      </div>
    </template>
    <template #cell-status="{ item }"><StatusPill :status="item.status" /></template>

    <!-- Aperçu rapide -->
    <template #details-panel="{ item }">
      <div class="flex flex-col gap-3.5">
        <div>
          <div class="text-sm font-semibold text-foreground truncate">{{ item.candidateName }}</div>
          <div class="text-[11px] text-muted-foreground truncate">{{ item.jobOfferTitle }}</div>
        </div>
        <div><StatusPill :status="item.status" /></div>
        <div class="grid grid-cols-2 gap-2 text-[12px]">
          <div class="col-span-2"><div class="text-muted-foreground text-[11px]">Date et heure</div>{{ formatInterviewDateTime(item.scheduledAt) }}</div>
          <div class="col-span-2">
            <div class="text-muted-foreground text-[11px]">{{ item.mode === 'VideoCall' ? 'Visioconférence' : 'Lieu' }}</div>
            <a v-if="item.mode === 'VideoCall'" :href="item.meetingLink" target="_blank" rel="noopener" class="text-primary hover:underline break-all">{{ item.meetingLink }}</a>
            <span v-else>{{ item.location }}</span>
          </div>
        </div>
        <div class="pt-2 border-t border-border">
          <InterviewWorkflowActions :item="item" />
        </div>
        <button :class="L.btnPrimary" class="w-full justify-center" @click="openCard(item)">Ouvrir la fiche</button>
      </div>
    </template>

    <template #empty>
      <CalendarClock class="w-8 h-8" />
      <p class="text-[13px]">Aucun entretien</p>
    </template>

    <!-- Création -->
    <InterviewCreateModal :open="showCreate" @close="showCreate = false" @created="interviewStore.fetchAll()" />

    <!-- Fiche complète -->
    <InterviewCard v-if="openCardId !== null" :items="filtered" :item-id="openCardId" @close="openCardId = null" />
  </ListPageLayout>
</template>

<script setup lang="ts">
/**
 * Liste des entretiens (Interview), module Recrutement, design uniquement
 * (données fictives, voir src/stores/recruitment). Calquée sur
 * EmployeeListView.vue / JobOffersView.vue / HiringRequestsView.vue :
 * ListPageLayout + boutons de workflow dans InterviewWorkflowActions.vue,
 * fiche complète dans InterviewCard.vue.
 */
import { ref, computed, watch, onMounted } from 'vue'
import { Plus, CalendarClock, Clock, CheckCircle2, CalendarDays, MapPin, Video } from 'lucide-vue-next'
import { ListPageLayout, StatusPill } from '../../components'
import type { ListColumn } from '../../components/shared/ListPageLayout.vue'
import InterviewWorkflowActions from '../../components/recruitment/InterviewWorkflowActions.vue'
import InterviewCard from '../../components/recruitment/InterviewCard.vue'
import InterviewCreateModal from '../../components/recruitment/InterviewCreateModal.vue'
import * as L from '../../lib/listClasses'
import { todayIso, formatInterviewDateTime } from '../../lib/date'
import { useInterviewStore } from '../../stores/recruitment'
import type { Interview, RsvpResponse } from '../../stores/recruitment'

const interviewStore = useInterviewStore()

onMounted(() => {
  interviewStore.fetchAll()
  interviewStore.fetchTemplates()
})

/* ── Styles (KPI) ───────────────────────────────────────────── */
const kpiItem = 'bg-card border border-border rounded-lg px-3.5 py-3 flex items-center gap-3'
const kpiIcon = 'w-9 h-9 rounded-lg flex items-center justify-center shrink-0'
const kpiVal = 'text-[22px] font-bold leading-none'
const kpiLbl = 'text-xs text-muted-foreground mt-0.5'

/* ── Colonnes ───────────────────────────────────────────────── */
const columns: ListColumn[] = [
  { key: 'candidateName', label: 'Candidat', sortable: true, hideable: false, width: 180 },
  { key: 'jobOfferTitle', label: 'Offre', sortable: true, width: 180 },
  { key: 'scheduledAt', label: 'Date et heure', sortable: true, width: 150 },
  { key: 'location', label: 'Lieu / Visio', width: 170 },
  { key: 'participants', label: 'Participants', width: 200 },
  { key: 'rsvp', label: 'Réponses', width: 110 },
  { key: 'status', label: 'Statut', width: 130 },
]

/* ── Reponses aux invitations (RSVP, backlog "Suivi des reponses") ──── */
function rsvpLabel(r?: RsvpResponse): string {
  return r === 'Accepted' ? 'accepté' : r === 'Declined' ? 'refusé' : r === 'Tentative' ? 'peut-être' : 'en attente'
}
function rsvpShort(r?: RsvpResponse): string {
  return r === 'Accepted' ? 'Oui' : r === 'Declined' ? 'Non' : r === 'Tentative' ? '?' : '-'
}
function rsvpPillClass(r?: RsvpResponse): string {
  if (r === 'Accepted') return 'bg-success-bg text-success'
  if (r === 'Declined') return 'bg-danger-bg text-danger'
  if (r === 'Tentative') return 'bg-warning-bg text-warning'
  return 'bg-neutral-bg text-neutral'
}
function participantsAccepted(i: Interview): number {
  return i.participants.filter(p => p.rsvp === 'Accepted').length
}

/* ── KPIs ───────────────────────────────────────────────────── */
const scheduledCount = computed(() => interviewStore.items.filter(i => i.status === 'Scheduled').length)
const doneCount = computed(() => interviewStore.items.filter(i => i.status === 'Done').length)
const todayCount = computed(() => {
  const today = todayIso()
  return interviewStore.items.filter(i => i.scheduledAt.slice(0, 10) === today).length
})

/* ── Scope / recherche / tri / pagination ──────────────────────
   Même pattern que EmployeeListView.vue : la vue calcule elle-même
   "filtered" puis passe la page déjà filtrée/triée à ListPageLayout. */
const scopeOptions = [
  { value: '', label: 'Tous' },
  { value: 'Scheduled', label: 'Planifié' },
  { value: 'Done', label: 'Effectué' },
  { value: 'Cancelled', label: 'Annulé' },
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

const sortFieldMap: Record<string, keyof Interview> = {
  candidateName: 'candidateName', jobOfferTitle: 'jobOfferTitle', scheduledAt: 'scheduledAt',
}

const filtered = computed(() => {
  let rows = interviewStore.items.filter(i => {
    if (activeScope.value && i.status !== activeScope.value) return false
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      const place = (i.location ?? i.meetingLink ?? '').toLowerCase()
      if (!i.candidateName.toLowerCase().includes(q) && !i.jobOfferTitle.toLowerCase().includes(q) && !place.includes(q)) return false
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

/* ── Création (formulaire dans InterviewCreateModal.vue, reutilise
   depuis ApplicationCard.vue) ──────────────────────────────────── */
const showCreate = ref(false)

/* ── Fiche complète (double-clic sur une ligne ou bouton "Ouvrir la
   fiche") ──────────────────────────────────────────────────── */
const openCardId = ref<string | null>(null)
function openCard(item: Interview) { openCardId.value = item.id }
</script>
