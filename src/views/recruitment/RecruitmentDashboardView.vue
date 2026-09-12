<template>
  <div class="px-7 py-6">

    <!-- En-tête -->
    <div :class="L.pageHeader">
      <div>
        <div :class="L.pageTitle">Tableau de bord Recrutement</div>
        <div :class="L.pageSub">Vue d'ensemble de l'activité de recrutement</div>
      </div>
    </div>

    <!-- KPIs -->
    <div v-if="kpiLoading" class="grid grid-cols-4 gap-2.5 mb-3.5 max-md:grid-cols-2 animate-pulse" role="status" aria-busy="true" aria-label="Chargement en cours">
      <div v-for="i in 4" :key="i" :class="kpiItem">
        <div :class="kpiIcon" class="bg-muted"></div>
        <div><div class="h-6 bg-muted rounded mb-1.5" style="width: 40px"></div><div class="h-2.5 bg-muted rounded" style="width: 80px"></div></div>
      </div>
    </div>
    <div v-else class="grid grid-cols-4 gap-2.5 mb-3.5 max-md:grid-cols-2">
      <div :class="kpiItem">
        <div :class="kpiIcon" class="bg-primary/10"><Briefcase class="w-[18px] h-[18px] text-primary" /></div>
        <div><div :class="kpiVal">{{ openPositionsCount }}</div><div :class="kpiLbl">Postes ouverts</div></div>
      </div>
      <div :class="kpiItem">
        <div :class="kpiIcon" class="bg-info-bg"><Users class="w-[18px] h-[18px] text-info" /></div>
        <div><div :class="kpiVal">{{ applicationsInProgressCount }}</div><div :class="kpiLbl">Candidatures en cours</div></div>
      </div>
      <div :class="kpiItem">
        <div :class="kpiIcon" class="bg-warning-bg"><CalendarClock class="w-[18px] h-[18px] text-warning" /></div>
        <div><div :class="kpiVal">{{ upcomingInterviewsCount }}</div><div :class="kpiLbl">Entretiens à venir</div></div>
      </div>
      <div :class="kpiItem">
        <div :class="kpiIcon" class="bg-success-bg"><FileSignature class="w-[18px] h-[18px] text-success" /></div>
        <div><div :class="kpiVal">{{ contractsInProgressCount }}</div><div :class="kpiLbl">Contrats en cours</div></div>
      </div>
    </div>

    <!-- Prochains entretiens + Candidatures récentes -->
    <div class="grid grid-cols-2 gap-3 max-lg:grid-cols-1">

      <div :class="L.card">
        <div :class="L.cardHeader">
          <div :class="L.cardTitle"><CalendarClock class="w-4 h-4 text-primary" /> Prochains entretiens</div>
        </div>
        <div v-if="interviewStore.loading" class="flex flex-col gap-2 animate-pulse" role="status" aria-busy="true">
          <div v-for="i in 3" :key="i" class="h-9 bg-muted rounded"></div>
        </div>
        <template v-else>
          <div v-if="upcomingInterviews.length === 0" class="py-6 text-xs text-muted-foreground text-center">
            Aucun entretien planifié pour le moment.
          </div>
          <div v-for="itw in upcomingInterviews" :key="itw.id" class="flex items-center justify-between gap-3 py-2 border-b border-border last:border-b-0">
            <div class="min-w-0">
              <div class="text-sm font-medium truncate">{{ itw.candidateName }}</div>
              <div class="text-xs text-muted-foreground truncate">{{ itw.jobOfferTitle }}</div>
            </div>
            <div class="text-xs text-muted-foreground text-right whitespace-nowrap">{{ formatInterviewDateTime(itw.scheduledAt) }}</div>
          </div>
        </template>
      </div>

      <div :class="L.card">
        <div :class="L.cardHeader">
          <div :class="L.cardTitle"><Users class="w-4 h-4 text-primary" /> Candidatures récentes</div>
        </div>
        <div v-if="applicationStore.loading" class="flex flex-col gap-2 animate-pulse" role="status" aria-busy="true">
          <div v-for="i in 3" :key="i" class="h-9 bg-muted rounded"></div>
        </div>
        <template v-else>
          <div v-if="recentApplications.length === 0" class="py-6 text-xs text-muted-foreground text-center">
            Aucune candidature pour le moment.
          </div>
          <div v-for="app in recentApplications" :key="app.id" class="flex items-center justify-between gap-3 py-2 border-b border-border last:border-b-0">
            <div class="min-w-0">
              <div class="text-sm font-medium truncate">{{ app.candidateName }}</div>
              <div class="text-xs text-muted-foreground truncate">{{ app.jobOfferTitle ?? sourceLabel(app.source) }}</div>
            </div>
            <StatusPill :status="app.status" />
          </div>
        </template>
      </div>

    </div>

  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { Briefcase, Users, CalendarClock, FileSignature } from 'lucide-vue-next'
import { StatusPill } from '../../components'
import * as L from '../../lib/listClasses'
import { formatInterviewDateTime } from '../../lib/date'
import {
  useJobOfferStore, useApplicationStore, useInterviewStore, useContractStore,
} from '../../stores/recruitment'
import type { ApplicationSource } from '../../stores/recruitment'

const jobOfferStore = useJobOfferStore()
const applicationStore = useApplicationStore()
const interviewStore = useInterviewStore()
const contractStore = useContractStore()

onMounted(() => {
  jobOfferStore.fetchAll()
  applicationStore.fetchAll()
  interviewStore.fetchAll()
  contractStore.fetchAll()
})

const kpiItem = 'bg-card border border-border rounded-lg px-3.5 py-3 flex items-center gap-3'
const kpiIcon = 'w-9 h-9 rounded-lg flex items-center justify-center shrink-0'
const kpiVal = 'text-[22px] font-bold leading-none'
const kpiLbl = 'text-xs text-muted-foreground mt-0.5'

// Squelette tant qu'aucune des 4 sources des KPI n'a fini son premier
// chargement — evite le flash "0" avant que les vraies valeurs arrivent.
const kpiLoading = computed(() =>
  jobOfferStore.loading || applicationStore.loading || interviewStore.loading || contractStore.loading,
)

// ── KPIs ─────────────────────────────────────────────────────
const openPositionsCount = computed(() => jobOfferStore.published.length)

const APPLICATION_IN_PROGRESS = new Set(['New', 'InReview', 'InterviewScheduled'])
const applicationsInProgressCount = computed(() =>
  applicationStore.items.filter(a => APPLICATION_IN_PROGRESS.has(a.status)).length,
)

const upcomingInterviewsCount = computed(() =>
  interviewStore.items.filter(i => i.status === 'Scheduled').length,
)

const CONTRACT_NOT_IN_PROGRESS = new Set(['Draft', 'Cancelled', 'Refused'])
const contractsInProgressCount = computed(() =>
  contractStore.items.filter(c => !CONTRACT_NOT_IN_PROGRESS.has(c.status)).length,
)

// ── Prochains entretiens ────────────────────────────────────────
const upcomingInterviews = computed(() =>
  [...interviewStore.items]
    .filter(i => i.status === 'Scheduled')
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
    .slice(0, 5),
)

// ── Candidatures récentes ────────────────────────────────────────
const recentApplications = computed(() =>
  [...applicationStore.items]
    .sort((a, b) => b.appliedAt.localeCompare(a.appliedAt))
    .slice(0, 5),
)

const SOURCE_LABELS: Record<ApplicationSource, string> = {
  Offer: 'Candidature sur offre',
  Spontaneous: 'Candidature spontanée',
  Internal: 'Candidature interne',
}
function sourceLabel(source: ApplicationSource): string {
  return SOURCE_LABELS[source] ?? source
}
</script>
