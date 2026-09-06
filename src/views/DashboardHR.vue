<template>
  <div class="px-7 py-6 max-w-[1400px] mx-auto w-full">

        <div class="flex items-center justify-between mb-3.5">
          <div>
            <div class="text-lg font-semibold">{{ t('dashboard.welcome') }}</div>
            <div class="text-[13px] text-muted-foreground mt-px">{{ t('dashboard.greeting') }} {{ auth.user?.name }} · {{ today }}</div>
          </div>
        </div>

        <!-- KPIs -->
        <div v-if="kpiLoading" class="grid grid-cols-4 gap-2.5 mb-3.5 max-md:grid-cols-2 animate-pulse" role="status" aria-busy="true" aria-label="Chargement en cours">
          <div v-for="i in 4" :key="i" :class="kpiCard">
            <div :class="kpiAccent" class="bg-muted"></div>
            <div class="h-2.5 bg-muted rounded mb-1.5" style="width: 65%"></div>
            <div class="h-6 bg-muted rounded mb-1.5" style="width: 35%"></div>
            <div class="h-2.5 bg-muted rounded" style="width: 50%"></div>
          </div>
        </div>
        <div v-else class="grid grid-cols-4 gap-2.5 mb-3.5 max-md:grid-cols-2">
          <div :class="kpiCard">
            <div :class="kpiAccent" class="bg-success-bg"><Users class="w-[17px] h-[17px] text-success" /></div>
            <div :class="kpiLabel">{{ t('dashboard.active_employees') }}</div>
            <div :class="kpiValue">{{ activeEmployeesCount }}</div>
            <div :class="kpiSub">+{{ newHiresThisMonth }} {{ t('dashboard.this_month') }}</div>
          </div>
          <div :class="kpiCard">
            <div :class="kpiAccent" class="bg-warning-bg"><Clock class="w-[17px] h-[17px] text-warning" /></div>
            <div :class="kpiLabel">{{ t('dashboard.pending') }}</div>
            <div :class="kpiValue">{{ pending.length }}</div>
            <div :class="kpiSub">{{ t('dashboard.to_process') }}</div>
          </div>
          <div :class="kpiCard">
            <div :class="kpiAccent" class="bg-success-bg"><Check class="w-[17px] h-[17px] text-success" /></div>
            <div :class="kpiLabel">{{ t('dashboard.approved_month') }}</div>
            <div :class="kpiValue">{{ approvedThisMonthCount }}</div>
            <div :class="kpiSub">{{ t('dashboard.leaves_absences') }}</div>
          </div>
          <div :class="kpiCard">
            <div :class="kpiAccent" class="bg-primary/10"><UserX class="w-[17px] h-[17px] text-primary" /></div>
            <div :class="kpiLabel">{{ t('dashboard.absent_today') }}</div>
            <div :class="kpiValue">{{ absentTodayCount }}</div>
            <div :class="kpiSub">{{ t('dashboard.on_employees', { count: activeEmployeesCount }) }}</div>
          </div>
        </div>

        <!-- Structure organisationnelle -->
        <SkeletonLoader v-if="entityStore.loading" type="list" :lines="1" class="mb-3" />
        <router-link
          v-else
          :to="{ name: 'hr-entities' }"
          class="flex items-center justify-between bg-card border border-border rounded-lg px-4 py-3.5 mb-3 no-underline text-foreground cursor-pointer transition-shadow hover:shadow-[0_2px_12px_rgba(0,0,0,0.08)] hover:border-primary/20"
        >
          <div class="flex items-center gap-3">
            <div class="w-[38px] h-[38px] rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Network class="w-5 h-5" />
            </div>
            <div>
              <div class="text-sm font-semibold">Structure organisationnelle</div>
              <div class="text-xs text-muted-foreground mt-0.5">
                {{ entityStore.approvedEntities.length }} entités approuvées ·
                {{ entityStore.totalHeadcount }} employés rattachés
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span v-if="entityStore.pendingEntities.length > 0" class="bg-danger-bg text-danger text-[11px] font-semibold px-2.5 py-[3px] rounded-full">
              {{ entityStore.pendingEntities.length }} en attente
            </span>
            <ChevronRight class="w-4 h-4 text-muted-foreground" />
          </div>
        </router-link>

        <!-- Demandes -->
        <div :class="[card, 'mb-3']">
          <div :class="cardHeader">
            <div :class="cardTitle">
              <CalendarClock class="w-4 h-4 text-primary" />
              {{ t('absence.pending_title') }}
              <span class="bg-primary text-primary-foreground text-[11px] font-semibold px-[7px] py-px rounded-full">{{ pending.length }}</span>
            </div>
            <router-link :to="{ name: 'hr-absences' }" class="text-xs text-info no-underline cursor-pointer">{{ t('absence.see_all') }}</router-link>
          </div>
          <div class="flex border-b border-border mb-3.5">
            <div :class="[tabClass, tab === 'pending' && tabActive]" @click="tab = 'pending'">
              {{ t('absence.tabs.pending', { count: pending.length }) }}
            </div>
            <div :class="[tabClass, tab === 'approved' && tabActive]" @click="tab = 'approved'">
              {{ t('absence.tabs.approved', { count: approved.length }) }}
            </div>
          </div>
          <div v-for="r in activeRequests" :key="r.id" class="flex items-center gap-2.5 py-2 border-b border-border last:border-b-0">
            <div class="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 bg-primary/10 text-primary">
              {{ r.employeeInitials }}
            </div>
            <div class="flex-1">
              <div class="text-sm font-medium">
                {{ r.employeeName }}
                <span v-if="r.createdByName && r.createdByName !== r.employeeName" class="text-xs font-normal text-muted-foreground">(créé par {{ r.createdByName }})</span>
              </div>
              <div class="text-xs text-muted-foreground">{{ r.leaveTypeName }} · {{ formatDate(r.startDate) }} → {{ formatDate(r.endDate) }} · {{ r.daysCount }} jour{{ r.daysCount > 1 ? 's' : '' }}</div>
            </div>
            <StatusPill :status="r.status" />
            <AbsenceWorkflowActions :leave="r" />
          </div>
        </div>

        <!-- Soldes + Calendrier -->
        <div class="grid grid-cols-2 gap-3 max-lg:grid-cols-1">

          <!-- Soldes individuels -->
          <div :class="card">
            <div :class="cardHeader">
              <div :class="cardTitle">
                <BarChart3 class="w-4 h-4 text-primary" /> {{ t('absence.balances_title') }}
              </div>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    <th :class="balTh" @click="balSort('name')">
                      <div class="flex items-center gap-1.5">
                        <GripVertical class="w-3 h-3 text-foreground/30 cursor-grab" />
                        {{ t('absence.fields.employee') }}
                        <span class="ml-auto"><component :is="sortIcon('name')" class="w-3 h-3" :class="balSortKey==='name' ? 'text-primary' : 'text-foreground/30'" /></span>
                      </div>
                    </th>
                    <th v-for="col in balCols" :key="col.leaveTypeId" :class="balTh" :title="col.leaveTypeName" @click="balSort(col.leaveTypeId)">
                      <div class="flex items-center gap-1">{{ col.leaveTypeName }}
                        <span class="ml-auto"><component :is="sortIcon(col.leaveTypeId)" class="w-3 h-3" :class="balSortKey===col.leaveTypeId ? 'text-primary' : 'text-foreground/30'" /></span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="e in sortedBalances" :key="e.name" class="hover:bg-primary/10">
                    <td :class="balTd">
                      <div class="flex items-center gap-1.5">
                        <div class="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-semibold shrink-0" :style="{ background: e.avatarColor, color: e.avatarTextColor }">{{ e.initials }}</div>
                        <span>{{ e.name }}</span>
                      </div>
                    </td>
                    <td v-for="col in balCols" :key="col.leaveTypeId" :class="[balTd, 'text-center font-medium']">{{ e.balances[col.leaveTypeId] ?? 0 }}j</td>
                  </tr>
                </tbody>
              </table>
              <!-- Pagination soldes -->
              <div class="flex items-center gap-3 px-2.5 py-2 border-t border-border text-xs text-muted-foreground">
                <span class="flex-1 whitespace-nowrap text-[11px]">{{ t('absence.employees_total', { count: employeeBalances.length }) }}</span>
                <div class="flex items-center gap-1.5 text-[11px] whitespace-nowrap">
                  {{ t('absence.per_page') }}
                  <select v-model.number="balPageSize" class="h-6 px-1.5 border border-border rounded text-[11px] text-foreground bg-card outline-none cursor-pointer focus:border-primary">
                    <option :value="5">5</option>
                    <option :value="10">10</option>
                    <option :value="25">25</option>
                  </select>
                </div>
                <div class="flex items-center gap-[3px]" v-if="balTotalPages > 1">
                  <button :class="pagBtn" :disabled="balPage === 1" @click="balPage--"><ChevronLeft class="w-3 h-3" /></button>
                  <button
                    v-for="p in balTotalPages" :key="p"
                    :class="[pagBtn, p === balPage && pagBtnActive]"
                    @click="balPage = p"
                  >{{ p }}</button>
                  <button :class="pagBtn" :disabled="balPage === balTotalPages" @click="balPage++"><ChevronRight class="w-3 h-3" /></button>
                </div>
              </div>
            </div>
          </div>

          <!-- Calendrier dynamique -->
          <div :class="card">
            <div :class="cardHeader">
              <div :class="cardTitle">
                <Calendar class="w-4 h-4 text-primary" />
                <span class="capitalize">{{ calTitle }}</span>
              </div>
              <div class="flex gap-1">
                <button :class="calNavBtn" @click="prevMonth"><ChevronLeft class="w-3 h-3" /></button>
                <button :class="calNavBtn" @click="nextMonth"><ChevronRight class="w-3 h-3" /></button>
              </div>
            </div>
            <div class="grid grid-cols-7 gap-0.5">
              <div v-for="(d, i) in weekDays" :key="i" class="text-xs text-muted-foreground text-center py-[3px] font-medium">{{ d }}</div>
              <div
                v-for="(day, i) in calDays"
                :key="i"
                class="text-xs text-center py-[5px] px-0.5 rounded cursor-pointer text-foreground relative hover:bg-background"
                :class="dayClass(day)"
                :style="dayStyle(day)"
                @mouseenter="day.dateStr ? showTooltip($event, day) : undefined"
                @mouseleave="hideTooltip"
              >
                {{ day.n ?? '' }}
              </div>
            </div>
            <div class="flex gap-3 mt-2.5 flex-wrap">
              <span :class="legClass"><span class="w-2 h-2 rounded-full shrink-0 bg-success"></span>Absence approuvée (couleur du type)</span>
              <span :class="legClass"><span class="w-2 h-2 rounded-full shrink-0 bg-info"></span>Jour férié</span>
              <span :class="legClass"><span class="w-2 h-2 rounded-full shrink-0 bg-primary"></span>Aujourd'hui</span>
            </div>
          </div>

        </div>

  </div>

  <!-- Tooltip calendrier -->
  <Teleport to="body">
    <div v-if="tooltip.visible" class="bg-card border border-border rounded-md px-2.5 py-2 text-[11px] text-foreground shadow-[0_2px_8px_rgba(0,0,0,0.12)] min-w-40 max-w-[240px]" :style="tooltipStyle">
      <div v-for="(line, idx) in tooltip.lines" :key="idx" class="flex items-center gap-1.5 py-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
        <span v-if="line.color" class="w-[7px] h-[7px] rounded-full shrink-0" :style="{ background: line.color }"></span>
        {{ line.text }}
      </div>
    </div>
  </Teleport>

  <!-- Tour guidé — uniquement juste après l'onboarding (?tour=1), voir
       OnboardingWizard.vue:finish() -->
  <ProductTour v-if="showTour" :steps="TOUR_STEPS" @close="closeTour" />

</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import {
  Users, Clock, Check, UserX, Network, ChevronRight, ChevronLeft,
  CalendarClock, BarChart3, GripVertical, Calendar, ArrowUp, ArrowDown, ArrowUpDown,
} from 'lucide-vue-next'
import AbsenceWorkflowActions from '../components/absences/AbsenceWorkflowActions.vue'
import ProductTour from '../components/ui/ProductTour.vue'
import type { TourStep } from '../components/ui/ProductTour.vue'
import { SkeletonLoader, StatusPill } from '../components'
import { formatDate } from '../lib/date'
import { useAuthStore } from '../stores/auth'
import { useLeaveRequestStore } from '../stores/leaveRequests'
import { useEntityStore } from '../stores/entities'
import { useEmployeeStore } from '../stores/employees'
import { useLeaveTransactionStore } from '../stores/leaveTransactions'
import { useCalendarStore } from '../stores/calendar'
import { isHoliday } from '../utils/calendar'
import { isEligible } from '../lib/eligibility'

const auth        = useAuthStore()
const leaves      = useLeaveRequestStore()
const entityStore = useEntityStore()
const employeeStore = useEmployeeStore()
const balanceStore = useLeaveTransactionStore()
const calendarStore = useCalendarStore()
const { t, locale } = useI18n()
const route  = useRoute()
const router = useRouter()

// Tour guidé — déclenché une seule fois juste après l'onboarding (voir
// OnboardingWizard.vue:finish(), qui pousse ici avec ?tour=1). On retire le
// paramètre dès la fermeture pour ne pas le redéclencher au rechargement.
const showTour = ref(route.query.tour === '1')
function closeTour() {
  showTour.value = false
  router.replace({ query: {} })
}
const TOUR_STEPS: TourStep[] = [
  { target: '[data-tour="config"]', title: 'Configuration', description: "Gérez ici le calendrier et les jours fériés, ainsi que la Classification (catégories, métiers et postes de l'entreprise)." },
  { target: '[data-tour="management"]', title: 'Employés et entités', description: 'Créez et gérez vos employés et entités depuis cette section.' },
  { target: '[data-tour="absences"]', title: "Demandes d'absence", description: "Suivez et validez les demandes de congé de votre équipe, et consultez les soldes." },
]
if (entityStore.entities.length === 0) entityStore.fetchAll()
if (leaves.all.length === 0) leaves.fetchAll()
if (employeeStore.employees.length === 0) employeeStore.fetchAll()
// AbsenceWorkflowActions (ligne 104) n'affiche Approuver/Retourner/Refuser
// que pour les demandes reellement a l'etape courante du validateur — voir
// pendingForMe.some(...) dans ce composant. Sans ce fetch, un validateur
// avec CONGE_VOIR_TOUT (ex: Directeur RH) qui voit ici une demande pas
// encore a son niveau ne voyait quand meme les boutons (ils s'affichaient
// a tort avant ce correctif, et echouaient au clic cote serveur).
if (auth.hasPermission('CONGE_VALIDER')) leaves.fetchPendingForMe()
if (!calendarStore.calendar.id) calendarStore.fetchCalendar()
if (calendarStore.holidays.length === 0) calendarStore.fetchHolidays(new Date().getFullYear())

// ── KPIs ─────────────────────────────────────────────────────
const todayIso = new Date().toISOString().slice(0, 10)
const thisMonthKey = todayIso.slice(0, 7)

// Squelette tant que les deux sources des KPI n'ont pas fini leur premier
// chargement — évite le flash "0" avant que les vraies valeurs arrivent
// (le flag `loading` ne redevient true que sur un fetch reellement lance,
// voir "if (x.length === 0) fetch()" plus haut : pas de flash sur un retour
// a cet ecran avec des donnees deja en cache).
const kpiLoading = computed(() => employeeStore.loading || leaves.loading)

const activeEmployeesCount = computed(() => employeeStore.activeEmployees.length)
const newHiresThisMonth = computed(() => employeeStore.employees.filter(e => e.hireDate?.slice(0, 7) === thisMonthKey).length)

const APPROVED_LIKE = new Set(['Approved', 'Registered', 'Done', 'Regularized'])
const approvedThisMonthCount = computed(() => leaves.all.filter(l =>
  APPROVED_LIKE.has(l.status) && (l.modifiedAt ?? l.createdAt)?.slice(0, 7) === thisMonthKey,
).length)

const absentTodayCount = computed(() => leaves.all.filter(l =>
  APPROVED_LIKE.has(l.status) && l.startDate <= todayIso && l.endDate >= todayIso,
).length)

// ── Classes du design system ─────────────────────────────────
const kpiCard = 'bg-card border border-border rounded-lg px-3.5 py-3'
const kpiAccent = 'w-8 h-8 rounded-md flex items-center justify-center mb-2'
const kpiLabel = 'text-[13px] text-muted-foreground mb-1'
const kpiValue = 'text-[28px] font-semibold leading-none'
const kpiSub = 'text-xs text-muted-foreground mt-[3px]'
const card = 'bg-card border border-border rounded-lg p-3.5'
const cardHeader = 'flex items-center justify-between mb-3'
const cardTitle = 'flex items-center gap-1.5 text-sm font-semibold text-foreground'
const tabClass = 'px-3.5 py-2 text-[13px] text-muted-foreground cursor-pointer border-b-2 border-transparent'
const tabActive = '!text-primary !border-primary font-medium'
const balTh = 'px-2.5 py-2 text-left text-xs font-semibold text-foreground bg-primary/10 border-b border-primary/20 whitespace-nowrap cursor-pointer select-none hover:bg-primary/15'
const balTd = 'px-2.5 py-2 border-b border-border'
const pagBtn = 'min-w-[26px] h-[26px] px-1.5 rounded text-[11px] font-medium cursor-pointer border border-border bg-card text-foreground flex items-center justify-center transition-colors hover:bg-background disabled:opacity-35 disabled:cursor-not-allowed'
const pagBtnActive = '!bg-primary !text-primary-foreground !border-primary'
const calNavBtn = 'border border-border rounded w-[22px] h-[22px] flex items-center justify-center cursor-pointer text-muted-foreground transition-colors hover:bg-background hover:text-foreground'
const legClass = 'flex items-center gap-1.5 text-xs text-muted-foreground'

function sortIcon(key: string) {
  if (balSortKey.value !== key) return ArrowUpDown
  return balSortDir.value === 'asc' ? ArrowUp : ArrowDown
}

function dayClass(day: CalDay): string {
  if (day.cls === 'empty') return 'text-transparent pointer-events-none'
  if (day.cls === 'today') return 'bg-primary text-primary-foreground font-semibold'
  if (day.hasHoliday) return 'bg-info-bg text-info font-medium'
  if (day.hasLeave) return 'font-medium'
  return ''
}

function dayStyle(day: CalDay): Record<string, string> {
  if (day.cls === 'empty' || day.cls === 'today' || day.hasHoliday || !day.hasLeave || !day.leaveColor) return {}
  return { backgroundColor: `${day.leaveColor}1A`, color: day.leaveColor }
}

const today = new Date().toLocaleDateString(locale.value === 'fr' ? 'fr-FR' : 'en-US', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
})

// ── Demandes ─────────────────────────────────────────────────
const tab = ref<'pending' | 'approved'>('pending')

const PENDING_STATUSES = new Set(['Pending', 'InApprovalN1', 'InApprovalN2', 'InApprovalN3', 'InApprovalN4'])
const pending        = computed(() => leaves.all.filter(r => PENDING_STATUSES.has(r.status)))
const approved       = computed(() => leaves.all.filter(r => r.status === 'Approved'))
const activeRequests = computed(() => tab.value === 'pending' ? pending.value : approved.value)

// ── Soldes individuels ────────────────────────────────────────
const balSortKey  = ref('name')
const balSortDir  = ref<'asc' | 'desc'>('asc')
const balPage     = ref(1)
const balPageSize = ref(5)

function balSort(key: string) {
  if (balSortKey.value === key) balSortDir.value = balSortDir.value === 'asc' ? 'desc' : 'asc'
  else { balSortKey.value = key; balSortDir.value = 'asc' }
}

if (balanceStore.allBalances.length === 0) balanceStore.fetchAllBalances()

// Colonnes derivees des types de conge reellement presents dans les soldes
// (jamais de code fixe 'ANNUAL'/'RECOVERY'/... — le code d'un type de conge
// est libre, choisi par le RH y compris depuis l'onboarding, donc rien ne
// garantit que ces codes existent).
const balCols = computed(() => (balanceStore.allBalances[0]?.balances ?? []).slice(0, 4).map(b => ({ leaveTypeId: b.leaveTypeId, leaveTypeName: b.leaveTypeName })))

const employeeBalances = computed(() => balanceStore.allBalances.map(b => {
  const emp = employeeStore.getById(b.employeeId)
  const balances: Record<string, number> = {}
  for (const bal of b.balances) balances[bal.leaveTypeId] = bal.balance
  return {
    name: b.employeeName,
    initials: emp?.initials ?? '',
    avatarColor: emp?.avatarBg ?? '#E2E8F0',
    avatarTextColor: emp?.avatarText ?? '#475569',
    balances,
  }
}))

const sortedBalances = computed(() => {
  const list = [...employeeBalances.value].sort((a, b) => {
    const va = balSortKey.value === 'name' ? a.name : (a.balances[balSortKey.value] ?? 0)
    const vb = balSortKey.value === 'name' ? b.name : (b.balances[balSortKey.value] ?? 0)
    const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb))
    return balSortDir.value === 'asc' ? cmp : -cmp
  })
  const start = (balPage.value - 1) * balPageSize.value
  return list.slice(start, start + balPageSize.value)
})
const balTotalPages = computed(() => Math.max(1, Math.ceil(employeeBalances.value.length / balPageSize.value)))

// ── Calendrier dynamique ──────────────────────────────────────
const weekDays = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

const _now     = new Date()
const calYear  = ref(_now.getFullYear())
const calMonth = ref(_now.getMonth())

const calTitle = computed(() =>
  new Date(calYear.value, calMonth.value, 1)
    .toLocaleDateString(locale.value === 'fr' ? 'fr-FR' : 'en-US', { month: 'long', year: 'numeric' })
)

function prevMonth() {
  if (calMonth.value === 0) { calMonth.value = 11; calYear.value-- }
  else calMonth.value--
}
function nextMonth() {
  if (calMonth.value === 11) { calMonth.value = 0; calYear.value++ }
  else calMonth.value++
}

interface CalDay { n: number | null; dateStr: string | null; cls: string; hasLeave: boolean; leaveColor?: string; hasHoliday: boolean; holidayName?: string }

// Ciblage d'eligibilite (demande client, 01/09) — meme filtre local que
// DashboardEmployee.vue : ce mini-calendrier resout le calendrier de
// l'utilisateur RH connecte (fetchCalendar() sans argument), un jour ferie
// non applicable a lui ne doit pas y apparaitre comme ferie.
const myEligibility = computed(() => {
  const u = auth.user
  if (!u || u.gender === undefined || u.isExpatriate === undefined) return null
  return { gender: u.gender, isExpatriate: u.isExpatriate, entityId: u.entityId ?? null }
})
const effectiveCalendar = computed(() => {
  const rule = myEligibility.value
  if (!rule) return calendarStore.calendar
  return { ...calendarStore.calendar, holidays: calendarStore.calendar.holidays.filter(h => isEligible(h, rule)) }
})

const calDays = computed((): CalDay[] => {
  const y = calYear.value
  const m = calMonth.value
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const firstDay    = (new Date(y, m, 1).getDay() + 6) % 7
  const todayObj    = new Date()
  const isThisMonth = todayObj.getFullYear() === y && todayObj.getMonth() === m
  const todayNum    = isThisMonth ? todayObj.getDate() : -1
  const result: CalDay[] = []

  for (let i = 0; i < firstDay; i++) result.push({ n: null, dateStr: null, cls: 'empty', hasLeave: false, hasHoliday: false })

  for (let d = 1; d <= daysInMonth; d++) {
    const mm      = String(m + 1).padStart(2, '0')
    const dd      = String(d).padStart(2, '0')
    const dateStr = `${y}-${mm}-${dd}`
    // Couleur du type de congé (definie a sa creation) plutot qu'une couleur
    // generique unique pour toute absence — voir showTooltip() plus bas qui
    // liste deja chaque demande avec sa propre couleur, cette cellule ne
    // montre qu'un aperçu (premiere demande trouvee ce jour-la).
    const dayLeave = leaves.all.find(
      l => l.status === 'Approved' && l.startDate <= dateStr && l.endDate >= dateStr
    )
    const holiday = isHoliday(new Date(y, m, d), effectiveCalendar.value)
    result.push({ n: d, dateStr, cls: d === todayNum ? 'today' : '', hasLeave: !!dayLeave, leaveColor: dayLeave?.leaveTypeColor, hasHoliday: holiday.isHoliday, holidayName: holiday.name })
  }
  return result
})

// ── Tooltip ───────────────────────────────────────────────────
const tooltip = reactive({
  visible: false,
  x: 0,
  y: 0,
  above: false,
  lines: [] as { text: string; color: string }[],
})

const tooltipStyle = computed(() => ({
  position: 'fixed' as const,
  left: tooltip.x + 'px',
  top:  tooltip.y + 'px',
  transform: `translateX(-50%)${tooltip.above ? ' translateY(-100%) translateY(-8px)' : ' translateY(8px)'}`,
  zIndex: 9999,
  pointerEvents: 'none' as const,
}))

function showTooltip(event: MouseEvent, day: CalDay) {
  const rect    = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const matches = leaves.all.filter(
    l => l.status === 'Approved' && l.startDate <= (day.dateStr ?? '') && l.endDate >= (day.dateStr ?? '')
  )
  const lines: { text: string; color: string }[] = []
  if (day.hasHoliday) lines.push({ text: `Férié · ${day.holidayName}`, color: 'var(--color-info)' })
  lines.push(...matches.map(l => ({ text: `${l.employeeName} · ${l.leaveTypeName}`, color: l.leaveTypeColor })))
  tooltip.lines = lines.length > 0 ? lines : [{ text: t('absence.no_absence'), color: '' }]
  tooltip.x     = rect.left + rect.width / 2
  tooltip.above = rect.top > window.innerHeight / 2
  tooltip.y     = tooltip.above ? rect.top : rect.bottom
  tooltip.visible = true
}

function hideTooltip() { tooltip.visible = false }
</script>
