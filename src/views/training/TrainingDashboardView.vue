<template>
  <div class="px-7 py-6">

    <!-- En-tête -->
    <div :class="L.pageHeader">
      <div>
        <div :class="L.pageTitle">Tableau de bord Formation</div>
        <div :class="L.pageSub">Vue d'ensemble de l'activité de formation</div>
      </div>
    </div>

    <!-- KPIs -->
    <div class="grid grid-cols-4 gap-2.5 mb-3.5 max-md:grid-cols-2">
      <div :class="kpiItem">
        <div :class="kpiIcon" class="bg-success-bg"><CheckCircle2 class="w-[18px] h-[18px] text-success" /></div>
        <div><div :class="kpiVal">{{ completionRate }}%</div><div :class="kpiLbl">Taux de complétion</div></div>
      </div>
      <div :class="kpiItem">
        <div :class="kpiIcon" class="bg-info-bg"><GraduationCap class="w-[18px] h-[18px] text-info" /></div>
        <div><div :class="kpiVal">{{ courseStore.inProgressCount }}</div><div :class="kpiLbl">Formations en cours</div></div>
      </div>
      <div :class="kpiItem">
        <div :class="kpiIcon" class="bg-warning-bg"><CalendarClock class="w-[18px] h-[18px] text-warning" /></div>
        <div><div :class="kpiVal">{{ courseStore.inPreparationCount }}</div><div :class="kpiLbl">Formations planifiées</div></div>
      </div>
      <div :class="kpiItem">
        <div :class="kpiIcon" class="bg-primary/10"><Coins class="w-[18px] h-[18px] text-primary" /></div>
        <div><div :class="kpiVal">{{ formatMga(budgetStore.totalUsed) }}</div><div :class="kpiLbl">Budget utilisé ({{ budgetUsedPct }}%)</div></div>
      </div>
    </div>

    <!-- Prochaines sessions + Demandes en attente -->
    <div class="grid grid-cols-2 gap-3 max-lg:grid-cols-1 mb-3">

      <div :class="L.card">
        <div :class="L.cardHeader">
          <div :class="L.cardTitle"><CalendarClock class="w-4 h-4 text-primary" /> Prochaines sessions</div>
        </div>
        <div v-if="upcomingSessions.length === 0" class="py-6 text-xs text-muted-foreground text-center">
          Aucune session planifiée pour le moment.
        </div>
        <div v-for="s in upcomingSessions" :key="s.id" class="flex items-center justify-between gap-3 py-2 border-b border-border last:border-b-0">
          <div class="min-w-0">
            <div class="text-sm font-medium truncate">{{ s.courseTitle }}</div>
            <div class="text-xs text-muted-foreground truncate">{{ s.trainerName }} · {{ s.enrolledCount }}/{{ s.capacity }} inscrits</div>
          </div>
          <div class="text-xs text-muted-foreground text-right whitespace-nowrap">{{ formatSessionDate(s.scheduledAt) }}</div>
        </div>
      </div>

      <div :class="L.card">
        <div :class="L.cardHeader">
          <div :class="L.cardTitle"><Inbox class="w-4 h-4 text-primary" /> Demandes en attente</div>
        </div>
        <div v-if="enrollmentStore.pendingRequests.length === 0" class="py-6 text-xs text-muted-foreground text-center">
          Aucune demande de formation en attente.
        </div>
        <div v-for="e in enrollmentStore.pendingRequests.slice(0, 5)" :key="e.id" class="flex items-center justify-between gap-3 py-2 border-b border-border last:border-b-0">
          <div class="min-w-0">
            <div class="text-sm font-medium truncate">{{ e.employeeName }}</div>
            <div class="text-xs text-muted-foreground truncate">{{ e.courseTitle }}</div>
          </div>
          <StatusPill :status="e.status" />
        </div>
      </div>

    </div>

    <!-- Évaluations à froid à relancer -->
    <div :class="L.card">
      <div :class="L.cardHeader">
        <div :class="L.cardTitle"><Snowflake class="w-4 h-4 text-primary" /> Évaluations à froid à relancer</div>
      </div>
      <div v-if="enrollmentStore.coldEvalsDue.length === 0" class="py-6 text-xs text-muted-foreground text-center">
        Aucune relance à faire pour le moment.
      </div>
      <div v-for="e in enrollmentStore.coldEvalsDue" :key="e.id" class="flex items-center justify-between gap-3 py-2 border-b border-border last:border-b-0">
        <div class="min-w-0">
          <div class="text-sm font-medium truncate">{{ e.employeeName }}</div>
          <div class="text-xs text-muted-foreground truncate">{{ e.courseTitle }}</div>
        </div>
        <div class="text-xs text-warning text-right whitespace-nowrap">Échéance dépassée le {{ formatDate(e.coldEvaluationDueAt!) }}</div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { CheckCircle2, GraduationCap, CalendarClock, Coins, Inbox, Snowflake } from 'lucide-vue-next'
import { StatusPill } from '../../components'
import * as L from '../../lib/listClasses'
import { formatDate } from '../../lib/date'
import { loadAll } from '../../lib/runAction'
import { useCourseStore, useSessionStore, useEnrollmentStore, useBudgetStore, useProviderStore } from '../../stores/training'

const courseStore = useCourseStore()
const sessionStore = useSessionStore()
const enrollmentStore = useEnrollmentStore()
const budgetStore = useBudgetStore()
const providerStore = useProviderStore()

onMounted(() => loadAll(
  () => courseStore.fetchAll(),
  () => sessionStore.fetchAll(),
  () => enrollmentStore.fetchAll(),
  () => budgetStore.fetchAll(),
  () => providerStore.fetchAll(),
))

const kpiItem = 'bg-card border border-border rounded-lg px-3.5 py-3 flex items-center gap-3'
const kpiIcon = 'w-9 h-9 rounded-lg flex items-center justify-center shrink-0'
const kpiVal = 'text-[22px] font-bold leading-none'
const kpiLbl = 'text-xs text-muted-foreground mt-0.5'

// Taux de complétion = part des inscriptions ayant réellement été suivies
// (Attended) parmi celles qui ne sont ni refusées ni annulées.
const completionRate = computed(() => {
  const relevant = enrollmentStore.items.filter(e => e.status !== 'Rejected' && e.status !== 'Cancelled')
  if (relevant.length === 0) return 0
  const attended = relevant.filter(e => e.status === 'Attended').length
  return Math.round((attended / relevant.length) * 100)
})

const budgetUsedPct = computed(() => {
  if (budgetStore.totalAllocated === 0) return 0
  return Math.round((budgetStore.totalUsed / budgetStore.totalAllocated) * 100)
})

function formatMga(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M MGA`
  return `${n.toLocaleString('fr-FR')} MGA`
}

const upcomingSessions = computed(() => sessionStore.upcoming.slice(0, 5))

function formatSessionDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) + ' · ' +
    d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}
</script>
