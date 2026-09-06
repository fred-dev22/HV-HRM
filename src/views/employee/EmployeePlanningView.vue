<template>
  <div class="p-6 max-w-[1100px] mx-auto max-md:p-4">

          <!-- ── En-tête ── -->
          <div class="flex items-center justify-between gap-4 mb-5 flex-wrap max-md:flex-col max-md:items-start">
            <div class="flex items-center gap-3">
              <h1 class="text-xl font-bold text-foreground">Mon Planning</h1>
              <span class="text-xs font-medium text-primary bg-primary/10 rounded-full px-3 py-[3px]">{{ monthYearLabel }}</span>
            </div>

            <div class="flex items-center gap-2 flex-wrap">
              <button :class="navBtn" @click="prevWeek" title="Semaine précédente">
                <ChevronLeft class="w-4 h-4" />
              </button>
              <span class="text-[13px] font-medium text-foreground whitespace-nowrap">{{ weekRangeLabel }}</span>
              <button :class="navBtn" @click="nextWeek" title="Semaine suivante">
                <ChevronRight class="w-4 h-4" />
              </button>
              <button :class="[L.btnOutline, '!px-3 !py-1.5 !text-xs']" @click="goToday">Aujourd'hui</button>
            </div>
          </div>

          <!-- ── Grille semaine ── -->
          <div class="overflow-x-auto mb-5">
            <div class="grid grid-cols-7 gap-2 min-w-[700px]" style="grid-template-columns: repeat(7, minmax(130px, 1fr))">
              <div
                v-for="day in weekDays"
                :key="day.date"
                class="rounded-[10px] border overflow-hidden min-h-[130px] flex flex-col"
                :class="dayCardClass(day)"
                :style="dayCardStyle(day)"
              >
                <!-- En-tête du jour -->
                <div class="flex items-center justify-between px-2.5 py-2 border-b border-border">
                  <span class="text-[11px] font-bold uppercase tracking-[0.06em]" :class="day.date === today ? 'text-primary' : 'text-muted-foreground'">{{ dayAbbr(day.date) }}</span>
                  <span class="text-lg font-bold" :class="day.date === today ? 'text-primary' : 'text-foreground'">{{ dayNum(day.date) }}</span>
                  <span v-if="day.date === today" class="ml-auto bg-primary text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full tracking-[0.03em]">Aujourd'hui</span>
                </div>

                <!-- Jour ouvrable normal -->
                <template v-if="day.isWorkingDay && !day.isAbsence && !day.isHoliday">
                  <div class="p-2.5 flex flex-col gap-1.5 flex-1">
                    <div :class="infoRow">
                      <Clock class="w-3.5 h-3.5 shrink-0" />
                      <span>{{ day.hours?.start }} → {{ day.hours?.end }}</span>
                    </div>
                    <div :class="infoRow">
                      <Coffee class="w-3.5 h-3.5 shrink-0" />
                      <span>Pause {{ day.hours?.breakStart }} → {{ day.hours?.breakEnd }}</span>
                    </div>
                    <div class="text-[11px] font-semibold text-primary mt-1">{{ effectiveHoursLabel(day.hours) }} effectives</div>
                  </div>
                </template>

                <!-- Jour absent (congé approuvé ou déclaré) -->
                <template v-else-if="day.isAbsence && ['Approved', 'Registered', 'Done', 'Regularized'].includes(day.absenceStatus ?? '')">
                  <div :class="bodyCentered">
                    <span
                      class="inline-block text-[11px] font-semibold rounded-md px-2 py-[3px] text-center break-words"
                      :style="day.absenceColor ? { color: day.absenceColor, backgroundColor: `${day.absenceColor}1A` } : undefined"
                    >{{ day.absenceType }}</span>
                    <span :class="[statusPill, 'bg-success-bg text-success']">Approuvé</span>
                  </div>
                </template>

                <!-- Jour absent (congé en attente) -->
                <template v-else-if="day.isAbsence && ['Pending', 'InApprovalN1', 'InApprovalN2', 'InApprovalN3', 'InApprovalN4'].includes(day.absenceStatus ?? '')">
                  <div :class="bodyCentered">
                    <span
                      class="inline-block text-[11px] font-semibold rounded-md px-2 py-[3px] text-center break-words"
                      :style="day.absenceColor ? { color: day.absenceColor, backgroundColor: `${day.absenceColor}1A` } : undefined"
                    >{{ day.absenceType }}</span>
                    <span :class="[statusPill, 'bg-warning-bg text-warning']">En attente de validation</span>
                  </div>
                </template>

                <!-- Jour férié -->
                <template v-else-if="day.isHoliday">
                  <div :class="bodyCentered">
                    <span class="text-xs font-semibold text-info text-center break-words mb-1">{{ day.holidayName }}</span>
                    <span :class="[statusPill, 'bg-info-bg text-info']">Jour férié</span>
                  </div>
                </template>

                <!-- Jour non ouvrable -->
                <template v-else>
                  <div :class="[bodyCentered, 'text-muted-foreground text-xs']">
                    <Moon class="w-5 h-5 mb-1" />
                    <span>Non ouvrable</span>
                  </div>
                </template>

              </div>
            </div>
          </div>

          <!-- ── Récapitulatif semaine ── -->
          <div class="bg-card border border-border rounded-[10px] p-5">
            <h2 class="text-sm font-semibold text-foreground mb-4">Résumé de la semaine</h2>
            <div class="grid grid-cols-3 gap-3 mb-4 max-md:grid-cols-1">
              <div :class="summaryItem">
                <Briefcase class="w-5 h-5 text-primary shrink-0" />
                <div class="flex flex-col gap-0.5">
                  <span class="text-lg font-bold text-foreground">{{ workedDays }}/{{ workableMax }}</span>
                  <span class="text-[11px] text-muted-foreground">Jours travaillés</span>
                </div>
              </div>
              <div :class="summaryItem">
                <CalendarOff class="w-5 h-5 text-primary shrink-0" />
                <div class="flex flex-col gap-0.5">
                  <span class="text-lg font-bold text-foreground">{{ absenceDays }}</span>
                  <span class="text-[11px] text-muted-foreground">Jour(s) d'absence</span>
                </div>
              </div>
              <div :class="summaryItem">
                <Clock class="w-5 h-5 text-primary shrink-0" />
                <div class="flex flex-col gap-0.5">
                  <span class="text-lg font-bold text-foreground">{{ effectiveHoursTotal }}</span>
                  <span class="text-[11px] text-muted-foreground">Heures effectives prévues</span>
                </div>
              </div>
            </div>

            <div class="pt-3 border-t border-border">
              <span class="text-xs font-semibold text-muted-foreground block mb-2.5">Soldes restants</span>
              <div class="flex gap-2 flex-wrap">
                <div v-for="b in balanceSummary" :key="b.label" class="flex items-center gap-1.5 bg-background border border-border rounded-full px-3 py-1 text-xs">
                  <span class="text-muted-foreground">{{ b.label }}</span>
                  <span class="font-bold text-primary">{{ b.days }}j</span>
                </div>
              </div>
            </div>
          </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ChevronLeft, ChevronRight, Clock, Coffee, Moon, Briefcase, CalendarOff } from 'lucide-vue-next'
import * as L from '../../lib/listClasses'
import { useAuthStore }     from '../../stores/auth'
import { useCalendarStore } from '../../stores/calendar'
import { useLeaveRequestStore } from '../../stores/leaveRequests'
import { useLeaveTransactionStore } from '../../stores/leaveTransactions'
import { generateWeekPlanning } from '../../utils/calendar'
import { isEligible } from '../../lib/eligibility'
import type { DayPlanning, WorkingHours } from '../../types'

const auth          = useAuthStore()
const calendarStore = useCalendarStore()
const leaveStore    = useLeaveRequestStore()
const balanceStore  = useLeaveTransactionStore()
if (!calendarStore.calendar.id) calendarStore.fetchCalendar()
if (calendarStore.holidays.length === 0) calendarStore.fetchHolidays(new Date().getFullYear())
if (leaveStore.mine.length === 0) leaveStore.fetchMine()
if (balanceStore.myBalances.length === 0) balanceStore.fetchMyBalances()

// ── Classes du design system ─────────────────────────────────
const navBtn = 'w-8 h-8 flex items-center justify-center border border-border rounded-md bg-card text-foreground cursor-pointer transition-colors hover:bg-background'
const infoRow = 'flex items-center gap-1.5 text-[11px] text-muted-foreground'
const bodyCentered = 'p-2.5 flex flex-col gap-1.5 flex-1 items-center justify-center text-center'
const statusPill = 'inline-flex items-center text-[10px] font-bold rounded-full px-2 py-0.5 uppercase tracking-[0.05em]'
const summaryItem = 'flex items-center gap-3 p-3 bg-background rounded-lg'

const today = new Date().toISOString().split('T')[0] ?? ''

// Memes ensembles de statuts que le contenu interne du jour (lignes 55/63
// du template) — utilisaient auparavant 'approved'/'pending' en minuscules,
// qui ne correspondent a aucune valeur reelle de LeaveRequestStatus
// (toujours PascalCase, ex: 'Approved'), rendant ces deux branches mortes.
const APPROVED_LIKE_STATUSES = ['Approved', 'Registered', 'Done', 'Regularized']
const PENDING_LIKE_STATUSES  = ['Pending', 'InApprovalN1', 'InApprovalN2', 'InApprovalN3', 'InApprovalN4']

function dayCardClass(day: DayPlanning): string {
  if (day.date === today) return '!bg-primary/10 !border-2 !border-primary'
  if (day.isWorkingDay && !day.isAbsence && !day.isHoliday) return 'bg-card border-border'
  // Absence (approuvée ou en attente) : couleur portée par dayCardStyle()
  // (celle du type de congé, définie à sa création) — pas de classe fixe ici.
  if (day.isAbsence && (APPROVED_LIKE_STATUSES.includes(day.absenceStatus ?? '') || PENDING_LIKE_STATUSES.includes(day.absenceStatus ?? ''))) return ''
  if (day.isHoliday) return 'bg-info-bg border-info'
  return 'bg-background border-border opacity-60'
}

// Chaque type de congé s'affiche avec sa propre couleur (LeaveType.Color,
// choisie à la création du type) plutôt qu'une couleur générique unique —
// Tailwind ne pouvant pas exprimer une couleur arbitraire venant de la
// donnée, on passe par un style inline calculé depuis le hex.
function dayCardStyle(day: DayPlanning): Record<string, string> {
  if (day.date === today) return {}
  const isVisibleAbsence = day.isAbsence && (APPROVED_LIKE_STATUSES.includes(day.absenceStatus ?? '') || PENDING_LIKE_STATUSES.includes(day.absenceStatus ?? ''))
  if (!isVisibleAbsence || !day.absenceColor) return {}
  return { backgroundColor: `${day.absenceColor}1A`, borderColor: day.absenceColor }
}

// ── Week navigation ───────────────────────────────────────────
function parseLocal(dateStr: string): Date {
  const p = dateStr.split('-').map(Number)
  return new Date(p[0] ?? 0, (p[1] ?? 1) - 1, p[2] ?? 1)
}

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getMonday(date: Date): Date {
  const d   = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d
}

const currentWeekStart = ref(fmt(getMonday(new Date())))

function prevWeek() {
  const d = parseLocal(currentWeekStart.value)
  d.setDate(d.getDate() - 7)
  currentWeekStart.value = fmt(d)
}

function nextWeek() {
  const d = parseLocal(currentWeekStart.value)
  d.setDate(d.getDate() + 7)
  currentWeekStart.value = fmt(d)
}

function goToday() {
  currentWeekStart.value = fmt(getMonday(new Date()))
}

// ── Week labels ───────────────────────────────────────────────
const MONTHS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]
const DAYS_FR_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

const weekEndDate = computed(() => {
  const d = parseLocal(currentWeekStart.value)
  d.setDate(d.getDate() + 6)
  return d
})

const weekRangeLabel = computed(() => {
  const start = parseLocal(currentWeekStart.value)
  const end   = weekEndDate.value
  const sm    = MONTHS_FR[start.getMonth()]
  const em    = MONTHS_FR[end.getMonth()]
  const sy    = start.getFullYear()
  const ey    = end.getFullYear()
  if (sy === ey && start.getMonth() === end.getMonth()) {
    return `Semaine du ${start.getDate()} au ${end.getDate()} ${sm} ${ey}`
  }
  return `Semaine du ${start.getDate()} ${sm} au ${end.getDate()} ${em} ${ey}`
})

const monthYearLabel = computed(() => {
  const d = parseLocal(currentWeekStart.value)
  const m = MONTHS_FR[d.getMonth()] ?? 'mois'
  return `${m.charAt(0).toUpperCase() + m.slice(1)} ${d.getFullYear()}`
})

// Ciblage d'eligibilite (demande client, 01/09) — meme filtre local que
// DashboardEmployee.vue : un jour ferie non applicable a l'utilisateur
// connecte ne doit pas apparaitre comme ferie sur SON planning.
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

// ── Planning data ─────────────────────────────────────────────
const weekDays = computed<DayPlanning[]>(() =>
  generateWeekPlanning(
    currentWeekStart.value,
    effectiveCalendar.value,
    leaveStore.mine.map(l => ({
      startDate: l.startDate,
      endDate:   l.endDate,
      type:      l.leaveTypeName,
      status:    l.status,
      color:     l.leaveTypeColor,
    })),
  ),
)

// ── Day helpers ───────────────────────────────────────────────
function dayAbbr(dateStr: string): string {
  return DAYS_FR_SHORT[parseLocal(dateStr).getDay()] ?? ''
}

function dayNum(dateStr: string): string {
  return String(parseLocal(dateStr).getDate())
}

function effectiveHoursLabel(hours?: WorkingHours): string {
  if (!hours) return '0h'
  const toMin  = (t: string) => { const p = t.split(':').map(Number); return (p[0] ?? 0) * 60 + (p[1] ?? 0) }
  const effMin = Math.max(0, toMin(hours.end) - toMin(hours.start) - (toMin(hours.breakEnd) - toMin(hours.breakStart)))
  const h = Math.floor(effMin / 60)
  const m = effMin % 60
  return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
}

// ── Summary ───────────────────────────────────────────────────
const workableMax = computed(() =>
  weekDays.value.filter(d => {
    const day = parseLocal(d.date).getDay()
    return day !== 0 && day !== 6
  }).length,
)

const workedDays = computed(() =>
  weekDays.value.filter(d => d.isWorkingDay && !d.isAbsence).length,
)

const absenceDays = computed(() =>
  weekDays.value.filter(d => d.isAbsence).length,
)

const effectiveHoursTotal = computed(() => {
  const toMin = (t: string) => { const p = t.split(':').map(Number); return (p[0] ?? 0) * 60 + (p[1] ?? 0) }
  let totalMin = 0
  for (const d of weekDays.value) {
    if (!d.isWorkingDay || d.isAbsence || !d.hours) continue
    const workMin  = toMin(d.hours.end)      - toMin(d.hours.start)
    const breakMin = toMin(d.hours.breakEnd) - toMin(d.hours.breakStart)
    totalMin += Math.max(0, workMin - breakMin)
  }
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
})

const balanceSummary = computed(() =>
  balanceStore.myBalances
    .filter(b => b.daysPerYear > 0)
    .slice(0, 4)
    .map(b => ({ label: b.leaveTypeName, days: b.balance })),
)
</script>
