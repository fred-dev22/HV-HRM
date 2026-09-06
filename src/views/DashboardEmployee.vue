<template>
  <div class="px-7 py-6 max-md:p-4">

        <div class="flex items-center justify-between mb-3.5">
          <div>
            <div class="text-lg font-semibold">{{ t('dashboard.welcome_employee') }}</div>
            <div class="text-[13px] text-muted-foreground">{{ auth.user?.name }}</div>
          </div>
          <button :class="btnPrimary" @click="openModal()">
            <Plus class="w-4 h-4" /> {{ t('absence.new') }}
          </button>
        </div>

        <div class="grid grid-cols-4 gap-2.5 mb-3.5 max-md:grid-cols-2">
          <div v-for="b in balanceStore.myBalances" :key="b.leaveTypeId" :class="kpiCard" class="border-t-[3px]" :style="{ borderTopColor: b.color }">
            <div :class="kpiLabel">{{ b.leaveTypeName }}</div>
            <div :class="kpiValue" :style="{ color: b.color }">{{ b.balance }}</div>
            <div :class="kpiSub">j disponible{{ b.balance > 1 ? 's' : '' }}</div>
          </div>
          <div v-if="balanceStore.myBalances.length === 0" class="col-span-4 text-[13px] text-muted-foreground italic px-1">
            Aucun type de congé actif configuré.
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3 max-md:grid-cols-1">
          <div :class="card">
            <div :class="cardHeader">
              <div :class="cardTitle">
                <List class="w-4 h-4 text-primary" /> {{ t('absence.my_requests') }}
              </div>
              <router-link :to="{ name: 'employee-absences' }" class="text-xs text-info no-underline hover:underline">
                {{ t('absence.history') }}
              </router-link>
            </div>
            <div v-for="r in myRequests" :key="r.id" class="flex items-center gap-2.5 py-[9px] border-b border-border last:border-b-0">
              <div class="flex-1">
                <div class="text-sm font-medium">
                  {{ r.leaveTypeName }}
                  <span v-if="r.employeeId !== auth.user?.id" class="text-xs font-normal text-muted-foreground">· {{ r.employeeName }}</span>
                </div>
                <div class="text-xs text-muted-foreground">
                  {{ formatDate(r.startDate) }} → {{ formatDate(r.endDate) }} · {{ r.daysCount }} jour{{ r.daysCount > 1 ? 's' : '' }}
                  <span v-if="r.createdByName && r.createdByName !== r.employeeName"> · créé par {{ r.createdByName }}</span>
                </div>
              </div>
              <StatusPill :status="r.status" />
              <button v-if="r.employeeId === auth.user?.id && CANCELLABLE.has(r.status)" class="px-2.5 py-[5px] rounded text-[10px] font-medium cursor-pointer bg-warning-bg text-warning" @click="cancelRequest(r.id)">
                {{ t('absence.actions.cancel') }}
              </button>
              <router-link v-else :to="{ name: 'employee-absences' }" class="px-2.5 py-[5px] rounded text-xs font-medium cursor-pointer bg-background text-muted-foreground no-underline">{{ t('absence.actions.view') }}</router-link>
            </div>
            <div class="flex gap-2 flex-wrap mt-3 pt-2.5 border-t border-border">
              <button :class="[btnOutline, 'text-[11px]']" @click="openModal()">
                <Plus class="w-4 h-4" /> {{ t('absence.new') }}
              </button>
              <button v-if="MISSIONS_EXPENSES_ENABLED" :class="[btnOutline, 'text-[11px]']" @click="router.push({ name: 'employee-missions' })">
                <Plane class="w-4 h-4" /> {{ t('nav.my_missions') }}
              </button>
            </div>
          </div>

          <div :class="card">
            <div :class="cardHeader">
              <div :class="cardTitle">
                <Calendar class="w-4 h-4 text-primary" /> <span class="capitalize">{{ calTitle }}</span>
              </div>
              <div class="flex gap-1">
                <button :class="calNavBtn" @click="prevMonth"><ChevronLeft class="w-3 h-3" /></button>
                <button :class="calNavBtn" @click="nextMonth"><ChevronRight class="w-3 h-3" /></button>
              </div>
            </div>
            <div class="grid grid-cols-7 gap-0.5">
              <div v-for="(d, i) in weekDays" :key="i" class="text-xs text-muted-foreground text-center py-[3px] font-medium">{{ d }}</div>
              <div
                v-for="(day, i) in calDays" :key="i"
                class="text-xs text-center py-[5px] px-0.5 rounded cursor-pointer text-foreground hover:bg-background"
                :class="dayClass(day)"
                :style="dayStyle(day)"
                :title="day.holidayName"
              >
                {{ day.n ?? '' }}
              </div>
            </div>
            <div class="flex gap-3 mt-2.5 flex-wrap">
              <span :class="legClass"><span class="w-2 h-2 rounded-full shrink-0 bg-success"></span>Mon absence approuvée (couleur du type)</span>
              <span :class="legClass"><span class="w-2 h-2 rounded-full shrink-0 bg-info"></span>Jour férié</span>
              <span :class="legClass"><span class="w-2 h-2 rounded-full shrink-0 bg-primary"></span>Aujourd'hui</span>
            </div>
          </div>
        </div>

  </div>

  <!-- Modale nouvelle demande -->
  <AbsenceCreate
    v-if="showModal"
    :initial-leave-type-id="modalInitialType || undefined"
    @close="showModal = false"
    @created="showToast(t('absence.submitted_toast'))"
  />

  <!-- Toast -->
  <div v-if="toastMsg" class="fixed bottom-6 right-6 bg-success-bg text-success px-[18px] py-3 rounded-lg text-[13px] font-medium flex items-center gap-2 shadow-[0_4px_12px_rgba(0,0,0,0.12)] z-[2000]">
    <Check class="w-4 h-4" /> {{ toastMsg }}
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Plus, List, Plane, Calendar, Check, ChevronLeft, ChevronRight } from 'lucide-vue-next'
import AbsenceCreate from '../components/absences/AbsenceCreate.vue'
import { StatusPill } from '../components'
import { formatDate } from '../lib/date'
import { confirmDialog } from '../lib/confirm'
import { isHoliday } from '../utils/calendar'
import { isEligible } from '../lib/eligibility'
import { useAuthStore }             from '../stores/auth'
import { useLeaveRequestStore }     from '../stores/leaveRequests'
import { useLeaveTypesStore }       from '../stores/leaveTypes'
import { useLeaveTransactionStore } from '../stores/leaveTransactions'
import { useCalendarStore }         from '../stores/calendar'
import { MISSIONS_EXPENSES_ENABLED } from '../config/features'

const auth   = useAuthStore()
const leaves = useLeaveRequestStore()
const leaveTypesStore = useLeaveTypesStore()
const balanceStore     = useLeaveTransactionStore()
const calendarStore    = useCalendarStore()
const { t, locale }  = useI18n()
const router = useRouter()

if (leaves.mine.length === 0) leaves.fetchMine()
if (leaveTypesStore.leaveTypes.length === 0) leaveTypesStore.fetchAll()
// Toujours rafraîchi (pas de garde "si vide") : le solde peut changer suite
// à une approbation décidée par un tiers pendant que ce tableau de bord
// reste ouvert en arrière-plan — un solde figé sur son état d'avant
// approbation induirait l'employé en erreur sur ses jours réellement pris.
balanceStore.fetchMyBalances()
if (!calendarStore.calendar.id) calendarStore.fetchCalendar()
if (calendarStore.holidays.length === 0) calendarStore.fetchHolidays(new Date().getFullYear())

// ── Classes du design system ─────────────────────────────────
const btnPrimary = 'px-4 py-[7px] rounded-md text-[13px] font-medium cursor-pointer flex items-center gap-1.5 bg-primary text-primary-foreground transition-colors hover:bg-primary/90'
const btnOutline = 'px-4 py-[7px] rounded-md text-[13px] font-medium cursor-pointer flex items-center gap-1.5 bg-card text-foreground border border-border transition-colors hover:bg-background'
const kpiCard = 'bg-card border border-border rounded-lg px-3.5 py-3'
const kpiLabel = 'text-[13px] text-muted-foreground mb-1'
const kpiValue = 'text-[28px] font-semibold leading-none'
const kpiSub = 'text-xs text-muted-foreground mt-[3px]'
const card = 'bg-card border border-border rounded-lg p-3.5'
const cardHeader = 'flex items-center justify-between mb-3'
const cardTitle = 'flex items-center gap-1.5 text-sm font-semibold'
const legClass = 'flex items-center gap-1.5 text-[11px] text-muted-foreground'
const calNavBtn = 'border border-border rounded w-[22px] h-[22px] flex items-center justify-center cursor-pointer text-muted-foreground transition-colors hover:bg-background hover:text-foreground'

const myRequests = computed(() => leaves.mine.slice(0, 5))

// Une fois Approved/Registered, seul le RH/manager peut encore annuler
// administrativement — plus le demandeur lui-même (voir AbsenceWorkflowActions.vue).
const CANCELLABLE = new Set(['Draft', 'Pending', 'InApprovalN1', 'InApprovalN2', 'InApprovalN3', 'InApprovalN4'])
async function cancelRequest(id: string) {
  if (await confirmDialog('Annuler cette demande ?')) leaves.cancel(id)
}

// ── Modale ───────────────────────────────────────────────────
const showModal        = ref(false)
const modalInitialType = ref('')

function openModal() {
  modalInitialType.value = ''
  showModal.value = true
}

// ── Toast ────────────────────────────────────────────────────
const toastMsg = ref('')
function showToast(msg: string) {
  toastMsg.value = msg
  setTimeout(() => { toastMsg.value = '' }, 3000)
}

// ── Calendrier (mois réel, mes absences + jours fériés) ───────
const weekDays = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

// Ciblage d'eligibilite (demande client, 01/09) — un jour ferie non
// applicable a l'utilisateur connecte (genre/statut expatrie/entite) ne doit
// pas apparaitre comme ferie sur SON calendrier personnel. Filtre localement
// (calendarStore.holidays reste le cache global exhaustif, voir
// AbsenceCreate.vue) ; gender/isExpatriate absents (session ouverte avant ce
// correctif) => on ne filtre rien plutot que de risquer de masquer a tort un
// jour ferie qui s'applique bien a lui.
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

interface CalDay { n: number | null; cls: string; hasLeave: boolean; leaveColor?: string; hasHoliday: boolean; holidayName?: string }

const MINE_APPROVED_LIKE = new Set(['Approved', 'Registered', 'Done', 'Regularized'])
const calDays = computed((): CalDay[] => {
  const y = calYear.value
  const m = calMonth.value
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const firstDay    = (new Date(y, m, 1).getDay() + 6) % 7
  const todayObj    = new Date()
  const isThisMonth = todayObj.getFullYear() === y && todayObj.getMonth() === m
  const todayNum    = isThisMonth ? todayObj.getDate() : -1
  const result: CalDay[] = []

  for (let i = 0; i < firstDay; i++) result.push({ n: null, cls: 'empty', hasLeave: false, hasHoliday: false })

  for (let d = 1; d <= daysInMonth; d++) {
    const mm      = String(m + 1).padStart(2, '0')
    const dd      = String(d).padStart(2, '0')
    const dateStr = `${y}-${mm}-${dd}`
    // Couleur du type de congé (definie a sa creation) plutot qu'une couleur
    // generique unique pour toute absence.
    const dayLeave = leaves.mine.find(
      l => MINE_APPROVED_LIKE.has(l.status) && l.startDate <= dateStr && l.endDate >= dateStr
    )
    const holiday = isHoliday(new Date(y, m, d), effectiveCalendar.value)
    result.push({ n: d, cls: d === todayNum ? 'today' : '', hasLeave: !!dayLeave, leaveColor: dayLeave?.leaveTypeColor, hasHoliday: holiday.isHoliday, holidayName: holiday.name })
  }
  return result
})

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
</script>
