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
    <div class="grid grid-cols-4 gap-2.5 mb-3.5 max-md:grid-cols-2">
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
        <div v-if="upcomingInterviews.length === 0" class="py-6 text-xs text-muted-foreground text-center">
          Aucun entretien planifié pour le moment.
        </div>
        <div v-for="itw in upcomingInterviews" :key="itw.id" class="flex items-center justify-between gap-3 py-2 border-b border-border last:border-b-0">
          <div class="min-w-0">
            <div class="text-sm font-medium truncate">{{ itw.candidateName }}</div>
            <div class="text-xs text-muted-foreground truncate">{{ itw.jobOfferTitle }}</div>
          </div>
          <div class="text-xs text-muted-foreground text-right whitespace-nowrap">{{ formatDateTime(itw.scheduledAt) }}</div>
        </div>
      </div>

      <div :class="L.card">
        <div :class="L.cardHeader">
          <div :class="L.cardTitle"><Users class="w-4 h-4 text-primary" /> Candidatures récentes</div>
        </div>
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
      </div>

    </div>

  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Briefcase, Users, CalendarClock, FileSignature } from 'lucide-vue-next'
import { StatusPill } from '../../components'
import * as L from '../../lib/listClasses'
import { formatDate } from '../../lib/date'
import {
  useJobOfferStore, useApplicationStore, useInterviewStore, useContractStore,
} from '../../stores/recruitment'
import type { ApplicationSource } from '../../stores/recruitment'

const jobOfferStore = useJobOfferStore()
const applicationStore = useApplicationStore()
const interviewStore = useInterviewStore()
const contractStore = useContractStore()

const kpiItem = 'bg-card border border-border rounded-lg px-3.5 py-3 flex items-center gap-3'
const kpiIcon = 'w-9 h-9 rounded-lg flex items-center justify-center shrink-0'
const kpiVal = 'text-[22px] font-bold leading-none'
const kpiLbl = 'text-xs text-muted-foreground mt-0.5'

// ── KPIs ─────────────────────────────────────────────────────
const openPositionsCount = computed(() => jobOfferStore.published.length)

const APPLICATION_IN_PROGRESS = new Set(['New', 'InReview', 'InterviewScheduled'])
const applicationsInProgressCount = computed(() =>
  applicationStore.items.filter(a => APPLICATION_IN_PROGRESS.has(a.status)).length,
)

const upcomingInterviewsCount = computed(() =>
  interviewStore.items.filter(i => i.status === 'Scheduled').length,
)

const CONTRACT_NOT_IN_PROGRESS = new Set(['Draft', 'Cancelled', 'RefusedByCandidate'])
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

function formatDateTime(iso: string): string {
  const m = /T(\d{2}):(\d{2})/.exec(iso)
  return m ? `${formatDate(iso)} à ${m[1]}:${m[2]}` : formatDate(iso)
}
</script>
