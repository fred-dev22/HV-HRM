<template>
  <ListPageLayout
    title="Demandes à valider"
    :subtitle="`${totalPending} en attente de validation`"
    :columns="columns"
    :items="pageItems"
    :total="totalCount"
    :total-text="`${totalCount} élément(s)`"
    search-placeholder="Rechercher une demande, un employé…"
    scope-label="Type :"
    :scope-options="scopeOptions"
    v-model:scope="scope"
    v-model:search-query="searchQuery"
    v-model:page="page"
    v-model:page-size="pageSize"
    @open-card="openCard"
  >
    <!-- Actions contextuelles -->
    <template #row-actions="{ item }">
      <AbsenceWorkflowActions v-if="kindOf(item) === 'absences'" :leave="item" />
      <MissionWorkflowActions v-else-if="kindOf(item) === 'missions'" :mission="item" />
      <ExpenseWorkflowActions v-else-if="kindOf(item) === 'expenses'" :report="item" />
      <button v-else :class="L.btnOutline" @click.stop="openCard(item)">Traiter</button>
    </template>

    <!-- Cellules de la vue "Toutes" -->
    <template #cell-kindLabel="{ item }">
      <span class="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap bg-tint text-primary">{{ KIND_LABELS[kindOf(item)] }}</span>
    </template>
    <template #cell-allRef="{ item }">
      <span class="truncate block">{{ summaryOf(item) }}</span>
    </template>
    <template #cell-allDate="{ item }">
      <span class="text-muted-foreground whitespace-nowrap text-[11px]">{{ formatDate(item.createdAt) }}</span>
    </template>

    <!-- Cellules ABSENCES -->
    <template #cell-employeeName="{ item }">
      <div class="flex items-center gap-2">
        <UserAvatar :name="item.employeeName" size="sm" />
        <div class="min-w-0">
          <div class="truncate">{{ item.employeeName }}</div>
          <div v-if="item.createdByName && item.createdByName !== item.employeeName" class="text-[10px] text-muted-foreground truncate">
            Créé par {{ item.createdByName }}
          </div>
          <div v-if="item.actingAsInterimOfName" class="text-[10px] font-medium text-warning truncate">Intérimaire de {{ item.actingAsInterimOfName }}</div>
        </div>
      </div>
    </template>
    <template #cell-type="{ item }">
      <span class="inline-flex items-center gap-1 whitespace-nowrap">
        {{ item.leaveTypeName }}
        <TriangleAlert v-if="item.insufficientBalance" class="w-3.5 h-3.5 text-danger shrink-0" title="Solde insuffisant" />
      </span>
    </template>
    <template #cell-dates="{ item }"><span class="whitespace-nowrap text-[11px]">{{ formatDate(item.startDate) }} → {{ formatDate(item.endDate) }}</span></template>
    <template #cell-workingDays="{ item }"><span class="font-medium">{{ item.daysCount }}j</span></template>
    <template #cell-createdAt="{ item }"><span class="text-muted-foreground whitespace-nowrap text-[11px]">{{ formatDate(item.createdAt) }}</span></template>
    <!-- Cellules MISSIONS -->
    <template #cell-referenceCode="{ item }"><span class="font-mono text-xs font-semibold text-primary">{{ item.referenceCode }}</span></template>
    <template #cell-destination="{ item }"><span class="truncate">{{ item.destination }}</span></template>
    <template #cell-missionDates="{ item }"><span class="whitespace-nowrap text-[11px]">{{ shortDate(item.departureDate) }} → {{ shortDate(item.returnDate) }}</span></template>
    <template #cell-estimatedTotal="{ item }"><span class="font-semibold tabular-nums whitespace-nowrap">{{ fmtNum(item.estimatedTotal ?? 0) }} MGA</span></template>
    <!-- Cellules NOTES DE FRAIS -->
    <template #cell-title="{ item }"><span class="truncate">{{ item.title }}</span></template>
    <template #cell-totalAmount="{ item }"><span class="font-semibold tabular-nums whitespace-nowrap">{{ fmtNum(item.totalAmount) }} {{ item.currency }}</span></template>
    <!-- Commun -->
    <template #cell-status="{ item }"><StatusPill :status="item.status" /></template>

    <!-- Panneau d'aperçu rapide — mixe les 3 types selon le scope actif,
         comme les cellules #cell-* ci-dessus. -->
    <template #details-panel="{ item }">
      <div class="flex flex-col gap-3.5">
        <div class="flex items-center gap-2.5">
          <UserAvatar :name="item.employeeName" size="md" />
          <div class="min-w-0">
            <div class="text-sm font-semibold text-foreground truncate">{{ item.employeeName }}</div>
            <div class="text-[11px] text-muted-foreground">
              {{ kindOf(item) === 'absences' ? item.leaveTypeName : kindOf(item) === 'time' ? 'Saisie de temps' : (item.referenceCode || '') }}
            </div>
          </div>
        </div>
        <div v-if="item.createdByName && item.createdByName !== item.employeeName" class="text-[12px]">
          <div class="text-muted-foreground text-[11px]">Créé par</div>{{ item.createdByName }}
        </div>
        <div v-if="item.actingAsInterimOfName" class="text-[12px] text-warning bg-warning-bg rounded-md px-2.5 py-2">
          Vous validez cette demande en tant qu'intérimaire de {{ item.actingAsInterimOfName }}.
        </div>
        <div><StatusPill :status="item.status" /></div>

        <template v-if="kindOf(item) === 'absences'">
          <div class="grid grid-cols-2 gap-2 text-[12px]">
            <div><div class="text-muted-foreground text-[11px]">Début</div>{{ formatDate(item.startDate) }}</div>
            <div><div class="text-muted-foreground text-[11px]">Fin</div>{{ formatDate(item.endDate) }}</div>
            <div><div class="text-muted-foreground text-[11px]">Jours ouvrés</div>{{ item.daysCount }}j</div>
            <div><div class="text-muted-foreground text-[11px]">Soumis le</div>{{ formatDate(item.createdAt) }}</div>
          </div>
          <div v-if="item.reason" class="text-[12px]">
            <div class="text-muted-foreground text-[11px]">Motif</div>{{ item.reason }}
          </div>
          <div v-if="item.insufficientBalance" class="flex items-center gap-2 text-[12px] text-danger bg-danger-bg rounded-md px-2.5 py-2">
            <TriangleAlert class="w-3.5 h-3.5 shrink-0" /> Solde insuffisant pour ce type de congé, à valider en connaissance de cause.
          </div>
        </template>

        <template v-else-if="kindOf(item) === 'missions'">
          <div class="grid grid-cols-2 gap-2 text-[12px]">
            <div><div class="text-muted-foreground text-[11px]">Destination</div>{{ item.destination }}</div>
            <div><div class="text-muted-foreground text-[11px]">Durée</div>{{ item.daysCount }}j</div>
            <div><div class="text-muted-foreground text-[11px]">Départ</div>{{ shortDate(item.departureDate) }}</div>
            <div><div class="text-muted-foreground text-[11px]">Retour</div>{{ shortDate(item.returnDate) }}</div>
          </div>
          <div class="text-[12px]">
            <div class="text-muted-foreground text-[11px]">Total mission (estimé)</div>
            <span class="font-semibold text-primary">{{ fmtNum(item.estimatedTotal ?? 0) }} MGA</span>
          </div>
        </template>

        <template v-else-if="kindOf(item) === 'time'">
          <div class="grid grid-cols-2 gap-2 text-[12px]">
            <div><div class="text-muted-foreground text-[11px]">Date</div>{{ formatDate(item.date) }}</div>
            <div><div class="text-muted-foreground text-[11px]">Heures</div>{{ item.hours }} h</div>
          </div>
          <div v-if="item.comments" class="text-[12px]"><div class="text-muted-foreground text-[11px]">Commentaire</div>{{ item.comments }}</div>
        </template>

        <template v-else>
          <div class="text-[12px]">
            <div class="text-muted-foreground text-[11px]">Titre</div>{{ item.title }}
          </div>
          <div class="text-[12px]">
            <div class="text-muted-foreground text-[11px]">Total</div>
            <span class="font-semibold text-primary">{{ fmtNum(item.totalAmount) }} {{ item.currency }}</span>
          </div>
        </template>

        <button :class="L.btnPrimary" class="w-full justify-center" @click="openCard(item)">Ouvrir la fiche</button>
        <AbsenceWorkflowActions v-if="kindOf(item) === 'absences'" :leave="item" />
        <MissionWorkflowActions v-else-if="kindOf(item) === 'missions'" :mission="item" />
        <ExpenseWorkflowActions v-else-if="kindOf(item) === 'expenses'" :report="item" />
      </div>
    </template>

    <template #empty>
      <ClipboardCheck class="w-8 h-8" />
      <p class="text-[13px]">Aucune demande</p>
    </template>

    <AbsenceCard v-if="openAbsenceId !== null" :leaves="absenceRows" :request-id="openAbsenceId" @close="openAbsenceId = null" />
    <MissionCard v-if="openMissionId !== null" :missions="missionRows" :mission-id="openMissionId" @close="openMissionId = null" />
    <ExpenseCard v-if="openExpenseId !== null" :reports="expenseRows" :report-id="openExpenseId" @close="openExpenseId = null" />
  </ListPageLayout>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ClipboardCheck, TriangleAlert } from 'lucide-vue-next'
import { StatusPill, UserAvatar, ListPageLayout } from '../../components'
import type { ListColumn } from '../../components/shared/ListPageLayout.vue'
import AbsenceCard from '../../components/absences/AbsenceCard.vue'
import AbsenceWorkflowActions from '../../components/absences/AbsenceWorkflowActions.vue'
import MissionCard from '../../components/missions/MissionCard.vue'
import MissionWorkflowActions from '../../components/missions/MissionWorkflowActions.vue'
import ExpenseCard from '../../components/expenses/ExpenseCard.vue'
import ExpenseWorkflowActions from '../../components/expenses/ExpenseWorkflowActions.vue'
import { formatDate } from '../../lib/date'
import * as L from '../../lib/listClasses'
import { useLeaveRequestStore } from '../../stores/leaveRequests'
import { useMissionStore } from '../../stores/missions'
import { useExpenseStore } from '../../stores/expenses'
import { useTimeStore } from '../../stores/time'
import { useAuthStore } from '../../stores/auth'
import { useLeaveTypesStore } from '../../stores/leaveTypes'
import { MISSIONS_EXPENSES_ENABLED, TIME_MODULE_ENABLED } from '../../config/features'
import type { LeaveRequest, MissionOrder, ExpenseReport } from '../../types'

const route = useRoute()
const router = useRouter()
const leaveStore = useLeaveRequestStore()
const missionStore = useMissionStore()
const expenseStore = useExpenseStore()
const timeStore = useTimeStore()
const auth = useAuthStore()
const leaveTypesStore = useLeaveTypesStore()

type Kind = 'absences' | 'missions' | 'expenses' | 'time'
type Scope = 'all' | Kind
const TIME_ENABLED = TIME_MODULE_ENABLED && auth.hasAnyPermission(['TEMPS_VALIDER'])
const VALID_SCOPES: readonly Scope[] = [
  'all', 'absences',
  ...(MISSIONS_EXPENSES_ENABLED ? (['missions', 'expenses'] as const) : []),
  ...(TIME_ENABLED ? (['time'] as const) : []),
]
const KIND_LABELS: Record<Kind, string> = { absences: 'Absence', missions: 'Mission', expenses: 'Note de frais', time: 'Temps' }

// Par defaut : tous les types dans une seule liste, avec un filtre par type.
const initialScope = VALID_SCOPES.includes(route.query.scope as Scope) ? (route.query.scope as Scope) : 'all'
const scope = ref<Scope>(initialScope)

const openAbsenceId = ref<string | null>(null)
const openMissionId = ref<string | null>(null)
const openExpenseId = ref<string | null>(null)
/* eslint-disable @typescript-eslint/no-explicit-any */
function kindOf(item: any): Kind { return scope.value === 'all' ? item.kind : (scope.value as Kind) }
function openCard(item: any) {
  const k = kindOf(item)
  if (k === 'absences') openAbsenceId.value = item.id
  else if (k === 'missions') openMissionId.value = item.id
  else if (k === 'expenses') openExpenseId.value = item.id
  else router.push({ path: '/employee/time', query: { tab: 'validation' } })
}

// Deep-link depuis une notification/un email (`?scope=...&open=<id>`) : ouvre la
// fiche concernee. Un `watch` est necessaire : cliquer une notif alors qu'on est
// deja sur cette page ne remonte pas le composant, seule la query change.
function applyDeepLink() {
  const id = route.query.open
  if (typeof id !== 'string' || !id) return
  const k = route.query.scope as string
  if (k === 'missions') openMissionId.value = id
  else if (k === 'expenses') openExpenseId.value = id
  else openAbsenceId.value = id
  const { open, scope: scopeQuery, ...rest } = route.query
  void open; void scopeQuery
  router.replace({ query: rest })
}
watch(() => route.query.open, (id) => { if (id) applyDeepLink() })

onMounted(async () => {
  await Promise.all([
    leaveStore.fetchPendingForMe().catch(() => {}),
    leaveStore.validatedByMe.length === 0 ? leaveStore.fetchValidatedByMe().catch(() => {}) : Promise.resolve(),
    MISSIONS_EXPENSES_ENABLED ? missionStore.fetchPendingForMe().catch(() => {}) : Promise.resolve(),
    MISSIONS_EXPENSES_ENABLED ? missionStore.fetchValidatedByMe().catch(() => {}) : Promise.resolve(),
    MISSIONS_EXPENSES_ENABLED ? expenseStore.fetchPendingForMe().catch(() => {}) : Promise.resolve(),
    MISSIONS_EXPENSES_ENABLED ? expenseStore.fetchValidatedByMe().catch(() => {}) : Promise.resolve(),
    TIME_ENABLED ? timeStore.fetchPending() : Promise.resolve(),
  ])
  leaveTypesStore.fetchAll().catch(() => {})
  applyDeepLink()
})

function shortDate(iso: string): string { return iso ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '-' }
function fmtNum(n: number) { return n.toLocaleString('fr-FR') }

const absenceColumns: ListColumn[] = [
  { key: 'employeeName', label: 'Employé', hideable: false, width: 220 },
  { key: 'type', label: 'Type', width: 160 },
  { key: 'dates', label: 'Dates', width: 200 },
  { key: 'workingDays', label: 'Jours', align: 'center', width: 90 },
  { key: 'createdAt', label: 'Soumis le', width: 120 },
  { key: 'status', label: 'Statut', width: 130 },
]
const missionColumns: ListColumn[] = [
  { key: 'referenceCode', label: 'Code', hideable: false, width: 130 },
  { key: 'employeeName', label: 'Employé', width: 200 },
  { key: 'destination', label: 'Destination', width: 170 },
  { key: 'missionDates', label: 'Dates', width: 170 },
  { key: 'estimatedTotal', label: 'Total', align: 'right', width: 150 },
  { key: 'status', label: 'Statut', width: 130 },
]
const expenseColumns: ListColumn[] = [
  { key: 'referenceCode', label: 'Code', hideable: false, width: 130 },
  { key: 'employeeName', label: 'Employé', width: 200 },
  { key: 'title', label: 'Titre', width: 200 },
  { key: 'totalAmount', label: 'Total', align: 'right', width: 150 },
  { key: 'status', label: 'Statut', width: 130 },
]
const allColumns: ListColumn[] = [
  { key: 'kindLabel', label: 'Type', hideable: false, width: 130 },
  { key: 'allRef', label: 'Demande', width: 260 },
  { key: 'employeeName', label: 'Employé', width: 200 },
  { key: 'allDate', label: 'Soumis le', width: 120 },
  { key: 'status', label: 'Statut', width: 130 },
]
const columns = computed(() => scope.value === 'absences' ? absenceColumns : scope.value === 'missions' ? missionColumns : scope.value === 'expenses' ? expenseColumns : allColumns)

const searchQuery = ref('')
const page = ref(1)
const pageSize = ref(10)
watch([scope, searchQuery, pageSize], () => { page.value = 1 })

// "à valider" : les demandes en attente de ma decision d'abord, puis celles que j'ai
// deja traitees (elles restent visibles apres ma decision, voir validatedByMe).
function withDecided<T extends { id: string }>(pending: T[], decided: T[]): T[] {
  const ids = new Set(pending.map(x => x.id))
  return [...pending, ...decided.filter(x => !ids.has(x.id))]
}
const absenceRows = computed(() => withDecided(leaveStore.pendingForMe, leaveStore.validatedByMe))
const missionRows = computed(() => MISSIONS_EXPENSES_ENABLED ? withDecided(missionStore.pendingForMe, missionStore.validatedByMe) : [])
const expenseRows = computed(() => MISSIONS_EXPENSES_ENABLED ? withDecided(expenseStore.pendingForMe, expenseStore.validatedByMe) : [])
const timeRows = computed(() => TIME_ENABLED ? timeStore.pending : [])

const totalPending = computed(() => leaveStore.pendingForMe.length + missionStore.pendingForMe.length + expenseStore.pendingForMe.length + timeRows.value.length)

const scopeOptions = computed(() => {
  const withCount = (label: string, n: number) => (n > 0 ? `${label} (${n})` : label)
  const options = [
    { value: 'all', label: withCount('Toutes', totalPending.value) },
    { value: 'absences', label: withCount('Absences', leaveStore.pendingForMe.length) },
  ]
  if (MISSIONS_EXPENSES_ENABLED) {
    options.push({ value: 'missions', label: withCount('Missions', missionStore.pendingForMe.length) })
    options.push({ value: 'expenses', label: withCount('Notes de frais', expenseStore.pendingForMe.length) })
  }
  if (TIME_ENABLED) options.push({ value: 'time', label: withCount('Temps', timeRows.value.length) })
  return options
})

function summaryOf(item: any): string {
  const k = kindOf(item)
  if (k === 'absences') return `${item.leaveTypeName} · ${formatDate(item.startDate)} → ${formatDate(item.endDate)}`
  if (k === 'missions') return `${item.referenceCode} · ${item.destination} · ${shortDate(item.departureDate)} → ${shortDate(item.returnDate)}`
  if (k === 'expenses') return `${item.referenceCode} · ${item.title} · ${fmtNum(item.totalAmount)} ${item.currency}`
  return `Saisie du ${formatDate(item.date)} · ${item.hours} h`
}

const pendingIds = computed(() => new Set([
  ...leaveStore.pendingForMe.map(x => x.id), ...missionStore.pendingForMe.map(x => x.id),
  ...expenseStore.pendingForMe.map(x => x.id), ...timeRows.value.map(x => x.id),
]))

// Liste unifiee : en attente d'abord, puis le reste du plus recent au plus ancien.
const tagged = computed<any[]>(() => [
  ...absenceRows.value.map(x => ({ ...x, kind: 'absences' })),
  ...missionRows.value.map(x => ({ ...x, kind: 'missions' })),
  ...expenseRows.value.map(x => ({ ...x, kind: 'expenses' })),
  ...timeRows.value.map(x => ({ ...x, kind: 'time' })),
])
function searchTextOf(r: any): string {
  if (r.kind === 'absences') return `${r.leaveTypeName ?? ''} ${r.reason ?? ''}`
  if (r.kind === 'missions') return `${r.referenceCode ?? ''} ${r.destination ?? ''}`
  if (r.kind === 'expenses') return `${r.referenceCode ?? ''} ${r.title ?? ''}`
  return 'temps saisie'
}
const filtered = computed<any[]>(() => {
  let rows = scope.value === 'all' ? tagged.value : tagged.value.filter(r => r.kind === scope.value)
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    rows = rows.filter(r => `${r.employeeName ?? ''} ${searchTextOf(r)}`.toLowerCase().includes(q))
  }
  return [...rows].sort((a, b) => {
    const pa = pendingIds.value.has(a.id) ? 0 : 1
    const pb = pendingIds.value.has(b.id) ? 0 : 1
    if (pa !== pb) return pa - pb
    return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
  })
})

const totalCount = computed(() => filtered.value.length)
// items typés any[] : la vue mixe légitimement trois types (absences /
// missions / notes de frais) selon le scope ; les slots #cell-* lisent les
// champs propres à chaque type.
/* eslint-disable @typescript-eslint/no-explicit-any */
const pageItems = computed<any[]>(() => {
  const start = (page.value - 1) * pageSize.value
  return filtered.value.slice(start, start + pageSize.value)
})
</script>
