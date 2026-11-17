<template>
  <div class="p-6 max-md:p-4 flex flex-col gap-4 min-w-0">

    <!-- ── En-tête ── -->
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div>
        <div class="flex items-center gap-3 flex-wrap">
          <h1 class="text-xl font-bold text-foreground">{{ title }}</h1>
          <span class="text-xs font-medium text-primary bg-tint rounded-full px-3 py-[3px]">{{ monthLabel }}</span>
        </div>
        <p class="text-xs text-muted-foreground mt-1">{{ subtitle }}</p>
      </div>
      <div class="flex items-center gap-2">
        <button :class="navBtn" title="Mois précédent" @click="shiftMonth(-1)"><ChevronLeft class="w-4 h-4" /></button>
        <button :class="navBtn" title="Mois suivant" @click="shiftMonth(1)"><ChevronRight class="w-4 h-4" /></button>
        <button class="px-3 py-1.5 text-xs font-medium border border-border rounded-md bg-card text-foreground hover:bg-background" @click="goToday">Aujourd'hui</button>
      </div>
    </div>

    <!-- ── Bandeau de portée : dit clairement ce que la personne voit ── -->
    <div class="flex items-center gap-2 text-xs rounded-lg px-3 py-2 border" :class="bannerClass">
      <component :is="bannerIcon" class="w-4 h-4 shrink-0" />
      <span>{{ bannerText }}</span>
    </div>

    <div v-if="store.error" class="text-sm text-danger bg-danger-bg rounded-lg px-3 py-2">{{ store.error }}</div>

    <!-- ── Indicateurs du jour ── -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div :class="kpiCard">
        <p class="text-[11px] text-muted-foreground">Présence ({{ kpiDayLabel }})</p>
        <p class="text-xl font-bold text-foreground mt-1">{{ kpi.rate }}% <span class="text-xs font-medium text-muted-foreground">({{ kpi.present }}/{{ kpi.total }})</span></p>
      </div>
      <div :class="kpiCard">
        <p class="text-[11px] text-muted-foreground">Absents ({{ kpiDayLabel }})</p>
        <p class="text-xl font-bold text-foreground mt-1">{{ kpi.absent }}</p>
      </div>
      <div v-if="detailed" :class="kpiCard">
        <p class="text-[11px] text-muted-foreground">Demandes en attente (mois)</p>
        <p class="text-xl font-bold text-foreground mt-1">{{ kpi.pending }}</p>
      </div>
      <div v-else :class="kpiCard">
        <p class="text-[11px] text-muted-foreground">Collaborateurs affichés</p>
        <p class="text-xl font-bold text-foreground mt-1">{{ filteredEmployees.length }}</p>
      </div>
      <div v-if="scope === 'all' && hasMilestones" :class="[kpiCard, 'border-warning/40']">
        <p class="text-[11px] text-muted-foreground">Jalons RH (mois)</p>
        <p class="text-xl font-bold text-warning mt-1">{{ kpi.milestones }}</p>
      </div>
      <div v-else-if="detailed" :class="kpiCard">
        <p class="text-[11px] text-muted-foreground">Collaborateurs affichés</p>
        <p class="text-xl font-bold text-foreground mt-1">{{ filteredEmployees.length }}</p>
      </div>
    </div>

    <!-- ── Filtres et mode d'affichage ── -->
    <div class="flex items-center justify-between gap-3 flex-wrap bg-card border border-border rounded-xl p-3">
      <div class="flex items-center gap-2 flex-wrap">
        <div class="relative">
          <Search class="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input v-model="search" type="text" placeholder="Filtrer par nom…"
            class="pl-8 pr-3 py-1.5 text-xs bg-background border border-border rounded-lg w-48 focus:outline-none focus:border-primary" />
        </div>
        <select v-if="units.length > 1" v-model="unitFilter"
          class="px-3 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:border-primary">
          <option value="">Toutes les entités</option>
          <option v-for="u in units" :key="u" :value="u">{{ u }}</option>
        </select>
        <div class="flex items-center gap-1 bg-background p-1 rounded-lg">
          <button v-for="p in statusPills" :key="p.key" type="button"
            class="px-2.5 py-1 rounded-md text-xs transition-colors"
            :class="statusFilter === p.key ? 'bg-card text-foreground font-semibold shadow-sm' : 'text-muted-foreground hover:text-foreground'"
            @click="statusFilter = p.key">{{ p.label }}</button>
        </div>
      </div>
      <div class="flex items-center gap-1 bg-background p-1 rounded-lg">
        <button type="button" class="px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors"
          :class="viewMode === 'matrix' ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'"
          @click="viewMode = 'matrix'"><Table2 class="w-3.5 h-3.5" /> Planning</button>
        <button type="button" class="px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors"
          :class="viewMode === 'calendar' ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'"
          @click="viewMode = 'calendar'"><CalendarDays class="w-3.5 h-3.5" /> Synthèse mensuelle</button>
      </div>
    </div>

    <!-- ── Légende ── -->
    <div class="flex items-center gap-x-4 gap-y-1 flex-wrap text-[11px] text-muted-foreground px-1">
      <span class="font-semibold text-foreground">Légende :</span>
      <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded border border-emerald-400 bg-emerald-100 inline-block"></span> Présent</span>
      <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded inline-block" :style="{ background: LEAVE_COLOR }"></span> Congé / absence</span>
      <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded inline-block border border-emerald-300" :style="{ background: `linear-gradient(90deg, #ecfdf5 50%, ${LEAVE_COLOR} 50%) border-box` }"></span> Demi-journée</span>
      <template v-if="detailed">
        <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded inline-block border-2 border-dashed border-slate-500" :style="{ background: `${LEAVE_COLOR}55` }"></span> En attente de validation</span>
        <span v-if="hasTimeEntries" class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-primary inline-block"></span> Saisie de temps (mission, hors site…)</span>
        <span v-if="scope === 'all' && hasMilestones" class="flex items-center gap-1.5"><Star class="w-3 h-3 text-warning" /> Jalon RH</span>
      </template>
      <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded inline-block bg-slate-300 border border-slate-400"></span> Week-end / jour férié</span>
    </div>

    <div v-if="store.data?.truncated" class="text-xs text-warning bg-warning-bg rounded-lg px-3 py-2">
      La liste est limitée aux premiers collaborateurs. Utilisez la recherche ou le filtre d'entité pour affiner.
    </div>

    <!-- ── Contenu ── -->
    <div v-if="store.loading && !store.data" class="text-sm text-muted-foreground px-1 py-8 text-center">Chargement du planning…</div>

    <div v-else-if="filteredEmployees.length === 0" class="text-sm text-muted-foreground bg-card border border-border rounded-xl px-4 py-10 text-center">
      Aucun collaborateur à afficher avec ces filtres.
    </div>

    <!-- Planning : une ligne par collaborateur, une colonne par jour -->
    <div v-else-if="viewMode === 'matrix'" class="bg-card border border-border rounded-xl overflow-auto max-h-[62vh]">
      <table class="border-collapse text-left w-max min-w-full">
        <thead class="sticky top-0 z-20 bg-background">
          <tr>
            <th class="sticky left-0 z-30 bg-background px-3 py-2 text-xs font-bold text-foreground border-r border-border min-w-[210px]">
              Collaborateur ({{ filteredEmployees.length }})
            </th>
            <th v-for="d in days" :key="d.ymd"
              class="px-0.5 py-1.5 text-center min-w-[34px] border-r border-border/60"
              :class="d.isToday ? 'bg-primary text-white' : (d.off ? 'bg-slate-200 text-slate-500' : 'text-foreground')"
              :title="d.holiday ?? ''">
              <div class="text-[9px] uppercase font-medium">{{ d.short }}</div>
              <div class="text-xs font-bold">{{ d.day }}</div>
            </th>
          </tr>
        </thead>
        <tbody>
          <template v-for="g in groups" :key="g.unit">
            <tr class="bg-background">
              <td class="sticky left-0 z-10 bg-background px-3 py-1 text-[10px] uppercase tracking-wider font-bold text-muted-foreground border-r border-border">
                {{ g.unit }} <span class="font-normal">({{ g.employees.length }})</span>
              </td>
              <td :colspan="days.length"></td>
            </tr>
            <tr v-for="e in g.employees" :key="e.id" class="border-t border-border/60 hover:bg-background/60">
              <td class="sticky left-0 z-10 bg-card px-3 py-1.5 border-r border-border cursor-pointer" @click="openDetail(e, null)">
                <p class="text-xs font-semibold text-foreground truncate max-w-[190px]">{{ e.name }}</p>
                <p v-if="e.position" class="text-[10px] text-muted-foreground truncate max-w-[190px]">{{ e.position }}</p>
              </td>
              <td v-for="d in days" :key="d.ymd" class="p-[3px] border-r border-border/40 text-center"
                :class="d.isToday ? 'bg-tint/60' : ''">
                <div v-if="d.off" class="h-6 rounded bg-slate-200"></div>
                <button v-else type="button" class="h-6 w-full rounded relative flex items-center justify-center"
                  :class="cellClass(e.id, d.ymd)" :style="cellStyle(e.id, d.ymd)"
                  :title="cellTitle(e, d.ymd)" @click="openDetail(e, d.ymd)">
                  <Star v-if="cellInfo(e.id, d.ymd).milestones.length" class="w-3 h-3 text-warning" />
                  <span v-else-if="cellInfo(e.id, d.ymd).times.length" class="w-1.5 h-1.5 rounded-full bg-primary"></span>
                </button>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <!-- Synthèse mensuelle : une case par jour avec les effectifs -->
    <div v-else class="bg-card border border-border rounded-xl overflow-hidden">
      <div class="grid grid-cols-7 text-center text-xs font-semibold text-muted-foreground bg-background border-b border-border">
        <div v-for="n in ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']" :key="n" class="py-2">{{ n }}</div>
      </div>
      <div class="grid grid-cols-7">
        <div v-for="(c, i) in calendarCells" :key="i"
          class="min-h-[92px] p-1.5 border-b border-r border-border/60 flex flex-col gap-1"
          :class="c.inMonth ? (c.off ? 'bg-slate-100' : 'bg-card') : 'bg-background/50 text-muted-foreground/40'">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold" :class="c.isToday ? 'bg-primary text-white w-6 h-6 rounded-full flex items-center justify-center' : ''">{{ c.day }}</span>
            <span v-if="c.inMonth && !c.off" class="text-[10px] font-bold px-1.5 py-0.5 rounded"
              :class="c.rate < 80 ? 'bg-danger-bg text-danger' : 'bg-success-bg text-success'">{{ c.rate }}%</span>
          </div>
          <template v-if="c.inMonth && !c.off">
            <div v-if="c.absent > 0" class="text-[10px] px-1.5 py-0.5 rounded bg-warning-bg text-warning truncate">{{ c.absent }} absent{{ c.absent > 1 ? 's' : '' }}</div>
            <div v-for="m in c.milestones" :key="m" class="text-[10px] px-1.5 py-0.5 rounded bg-primary text-white truncate">{{ m }}</div>
          </template>
          <div v-else-if="c.inMonth && c.holiday" class="text-[10px] text-muted-foreground truncate">{{ c.holiday }}</div>
        </div>
      </div>
    </div>

    <!-- ── Détail d'un collaborateur / d'un jour ── -->
    <Teleport to="body">
    <Transition name="drawer">
    <div v-if="open && detail" class="drawer-overlay fixed inset-0 z-[2000] bg-black/40 flex items-center justify-end" @click.self="open = false">
      <div class="drawer-panel bg-card w-full max-w-md h-full shadow-2xl flex flex-col">
        <div class="px-5 py-4 border-b border-border flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h3 class="font-bold text-foreground break-words">{{ detail.employee.name }}</h3>
            <p class="text-xs text-muted-foreground break-words">{{ [detail.employee.position, detail.employee.unit].filter(Boolean).join(' • ') }}</p>
          </div>
          <button class="text-muted-foreground hover:text-foreground p-1" title="Fermer" @click="open = false"><X class="w-4 h-4" /></button>
        </div>
        <div class="flex-1 overflow-y-auto p-5 flex flex-col gap-4 text-xs">
          <div v-if="detail.ymd">
            <h4 class="font-bold uppercase tracking-wider text-muted-foreground mb-2">Statut au {{ formatDay(detail.ymd) }}</h4>
            <div v-for="(l, i) in detailDay.lines" :key="i" class="flex items-start gap-2 p-2.5 rounded-lg border border-border mb-1.5">
              <span class="w-2.5 h-2.5 rounded-full shrink-0 mt-[3px]" :style="{ background: l.color }"></span>
              <span class="text-foreground font-medium break-words min-w-0">{{ l.text }}</span>
            </div>
            <p v-if="detailDay.lines.length === 0" class="text-muted-foreground">Présent (aucune absence enregistrée).</p>
          </div>
          <div>
            <h4 class="font-bold uppercase tracking-wider text-muted-foreground mb-2">Ce mois-ci</h4>
            <div v-for="(l, i) in detailMonth" :key="i" class="flex items-start gap-2 p-2.5 rounded-lg border border-border mb-1.5">
              <span class="w-2.5 h-2.5 rounded-full shrink-0 mt-[3px]" :style="{ background: l.color }"></span>
              <span class="flex flex-col gap-0.5 min-w-0">
                <span class="text-foreground font-medium break-words">{{ l.text }}</span>
                <span class="text-muted-foreground break-words">{{ l.when }}</span>
              </span>
            </div>
            <p v-if="detailMonth.length === 0" class="text-muted-foreground">Rien à signaler sur le mois.</p>
          </div>
          <p v-if="!detailed" class="flex items-center gap-2 text-muted-foreground bg-background rounded-lg p-3">
            <Lock class="w-3.5 h-3.5 shrink-0" /> Les motifs d'absence et les informations administratives ne sont pas affichés.
          </p>
        </div>
      </div>
    </div>
    </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ChevronLeft, ChevronRight, Search, Table2, CalendarDays, Star, Lock, Eye, Users, X } from 'lucide-vue-next'
import { useAuthStore } from '../../stores/auth'
import { useCalendarStore } from '../../stores/calendar'
import { usePlanningStore, planningScopeFor, type PlanningEmployee, type PlanningLeave } from '../../stores/planning'
import { onDomainChanged } from '../../lib/realtime'

// Meme composant pour les trois entrees de menu : la portee reelle est decidee
// par le serveur (store.data.scope) ; avant la reponse on se base sur les
// permissions, avec la meme regle.
const auth = useAuthStore()
const store = usePlanningStore()
const calendarStore = useCalendarStore()

const navBtn = 'w-8 h-8 flex items-center justify-center border border-border rounded-md bg-card text-foreground cursor-pointer transition-colors hover:bg-background'
const kpiCard = 'bg-card border border-border rounded-xl p-3.5'

const scope = computed(() => store.data?.scope ?? planningScopeFor((c) => auth.hasAnyPermission(c)))
const detailed = computed(() => scope.value !== 'public')
const title = computed(() => (scope.value === 'team' ? 'Planning de mon équipe' : 'Planning global'))
const subtitle = computed(() => {
  if (scope.value === 'team') return 'Présences et absences des membres de votre équipe'
  if (scope.value === 'all') return "Vue d'ensemble des présences, absences et jalons RH de l'entreprise"
  return "Vue d'ensemble des présences et absences de l'entreprise"
})
const bannerText = computed(() => {
  if (scope.value === 'all') return "Vue complète : tous les collaborateurs, les types d'absence, les demandes en attente et les jalons RH."
  if (scope.value === 'team') return "Périmètre limité à votre équipe. Les jalons RH et les autres équipes ne sont pas affichés."
  return "Vue simplifiée : vous voyez qui est présent ou absent, sans motif ni information confidentielle."
})
const bannerIcon = computed(() => (scope.value === 'public' ? Lock : scope.value === 'team' ? Users : Eye))
const bannerClass = computed(() =>
  scope.value === 'public' ? 'bg-background text-muted-foreground border-border' : 'bg-tint text-primary border-transparent',
)

// ── Mois affiché ──
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
const pad = (n: number) => String(n).padStart(2, '0')
const ymdOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const todayYmd = ymdOf(new Date())
const cursor = ref({ y: new Date().getFullYear(), m: new Date().getMonth() })
const monthLabel = computed(() => `${MONTHS[cursor.value.m]!.charAt(0).toUpperCase()}${MONTHS[cursor.value.m]!.slice(1)} ${cursor.value.y}`)
const monthFrom = computed(() => `${cursor.value.y}-${pad(cursor.value.m + 1)}-01`)
const monthTo = computed(() => ymdOf(new Date(cursor.value.y, cursor.value.m + 1, 0)))

function shiftMonth(delta: number) {
  const d = new Date(cursor.value.y, cursor.value.m + delta, 1)
  cursor.value = { y: d.getFullYear(), m: d.getMonth() }
}
function goToday() {
  const d = new Date()
  cursor.value = { y: d.getFullYear(), m: d.getMonth() }
}
function formatDay(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number)
  return `${d} ${MONTHS[(m ?? 1) - 1]} ${y}`
}

// ── Jours du mois (week-ends et jours fériés grisés) ──
const holidayMap = computed(() => {
  const map = new Map<string, string>()
  for (const h of calendarStore.holidays) {
    const [, mm, dd] = h.date.split('-')
    const key = h.isRecurring ? `${cursor.value.y}-${mm}-${dd}` : h.date
    map.set(key, h.name)
  }
  return map
})
interface Day { ymd: string; day: number; short: string; off: boolean; isToday: boolean; holiday: string | null }
function buildDay(date: Date): Day {
  const ymd = ymdOf(date)
  const wd = date.getDay()
  const holiday = holidayMap.value.get(ymd) ?? null
  return { ymd, day: date.getDate(), short: SHORT[wd]!, off: wd === 0 || wd === 6 || !!holiday, isToday: ymd === todayYmd, holiday }
}
const days = computed<Day[]>(() => {
  const count = new Date(cursor.value.y, cursor.value.m + 1, 0).getDate()
  return Array.from({ length: count }, (_, i) => buildDay(new Date(cursor.value.y, cursor.value.m, i + 1)))
})

// ── Filtres ──
const search = ref('')
const unitFilter = ref('')
const statusFilter = ref<'all' | 'absence' | 'time' | 'milestone'>('all')
const viewMode = ref<'matrix' | 'calendar'>('matrix')

const employees = computed(() => store.data?.employees ?? [])
const units = computed(() => [...new Set(employees.value.map((e) => e.unit).filter((u): u is string => !!u))].sort())
const hasTimeEntries = computed(() => (store.data?.timeEntries.length ?? 0) > 0)
const hasMilestones = computed(() => (store.data?.milestones.length ?? 0) > 0)
const statusPills = computed(() => {
  const pills: Array<{ key: typeof statusFilter.value; label: string }> = [
    { key: 'all', label: 'Tout' },
    { key: 'absence', label: 'Absences' },
  ]
  if (detailed.value && hasTimeEntries.value) pills.push({ key: 'time', label: 'Saisies de temps' })
  if (scope.value === 'all' && hasMilestones.value) pills.push({ key: 'milestone', label: 'Jalons RH' })
  return pills
})

// ── Index par collaborateur et par jour ──
interface CellInfo {
  leaves: Array<PlanningLeave & { half: 'am' | 'pm' | null }>
  times: Array<{ entryType: string | null; hours: number }>
  milestones: string[]
}
const EMPTY: CellInfo = { leaves: [], times: [], milestones: [] }
const index = computed(() => {
  const map = new Map<string, Map<string, CellInfo>>()
  const cell = (empId: string, ymd: string): CellInfo => {
    let byDay = map.get(empId)
    if (!byDay) { byDay = new Map(); map.set(empId, byDay) }
    let c = byDay.get(ymd)
    if (!c) { c = { leaves: [], times: [], milestones: [] }; byDay.set(ymd, c) }
    return c
  }
  const data = store.data
  if (!data) return map
  for (const l of data.leaves) {
    const from = l.start < monthFrom.value ? monthFrom.value : l.start
    const to = l.end > monthTo.value ? monthTo.value : l.end
    for (const d of days.value) {
      if (d.ymd < from || d.ymd > to) continue
      let half: 'am' | 'pm' | null = null
      if (l.start === l.end) half = l.startPeriod === 'am' || l.startPeriod === 'pm' ? l.startPeriod : (l.endPeriod === 'am' || l.endPeriod === 'pm' ? l.endPeriod : null)
      else if (d.ymd === l.start && l.startPeriod === 'pm') half = 'pm'
      else if (d.ymd === l.end && l.endPeriod === 'am') half = 'am'
      cell(l.employeeId, d.ymd).leaves.push({ ...l, half })
    }
  }
  for (const t of data.timeEntries) cell(t.employeeId, t.date).times.push({ entryType: t.entryType, hours: t.hours })
  for (const m of data.milestones) cell(m.employeeId, m.date).milestones.push(m.label)
  return map
})
const cellInfo = (empId: string, ymd: string): CellInfo => index.value.get(empId)?.get(ymd) ?? EMPTY

// Absent = demande confirmee sur la journee entiere (une demi-journee ou une
// demande encore en attente ne retire pas la personne de l'effectif).
const isAbsentFull = (empId: string, ymd: string) =>
  cellInfo(empId, ymd).leaves.some((l) => !l.pending && !l.half)

function employeeMatches(e: PlanningEmployee): boolean {
  if (search.value && !e.name.toLowerCase().includes(search.value.toLowerCase())) return false
  if (unitFilter.value && e.unit !== unitFilter.value) return false
  if (statusFilter.value === 'all') return true
  const byDay = index.value.get(e.id)
  if (!byDay) return false
  const cells = [...byDay.values()]
  if (statusFilter.value === 'absence') return cells.some((c) => c.leaves.length > 0)
  if (statusFilter.value === 'time') return cells.some((c) => c.times.length > 0)
  return cells.some((c) => c.milestones.length > 0)
}
const filteredEmployees = computed(() => employees.value.filter(employeeMatches))
const groups = computed(() => {
  const by = new Map<string, PlanningEmployee[]>()
  for (const e of filteredEmployees.value) {
    const k = e.unit ?? 'Sans entité'
    if (!by.has(k)) by.set(k, [])
    by.get(k)!.push(e)
  }
  return [...by.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([unit, list]) => ({ unit, employees: list }))
})

// ── Rendu des cases ──
const FALLBACK_COLOR = '#94a3b8'
// Une seule couleur pour tout type de conge : le type se lit au survol et dans le tiroir.
const LEAVE_COLOR = '#f59e0b'
function cellClass(empId: string, ymd: string): string {
  const c = cellInfo(empId, ymd)
  if (c.leaves.length === 0) return 'border border-emerald-300 bg-emerald-50 hover:bg-emerald-100'
  if (c.leaves.every((l) => l.pending)) return 'border-2 border-dashed border-slate-500'
  // Demi-journee : la moitie libre garde le look "present", le contour reste visible.
  return c.leaves[0]?.half ? 'border border-emerald-300' : 'border border-transparent'
}
const FREE_HALF = '#ecfdf5'
function cellStyle(empId: string, ymd: string): Record<string, string> {
  const l = cellInfo(empId, ymd).leaves[0]
  if (!l) return {}
  const fill = l.pending ? `${LEAVE_COLOR}55` : LEAVE_COLOR
  // backgroundOrigin: la bordure fait partie du fond, sinon le degrade se repete sous le
  // contour et laisse une fine bande de couleur au bord oppose.
  const base = { backgroundOrigin: 'border-box' }
  if (l.half === 'am') return { ...base, background: `linear-gradient(90deg, ${fill} 50%, ${FREE_HALF} 50%) border-box` }
  if (l.half === 'pm') return { ...base, background: `linear-gradient(90deg, ${FREE_HALF} 50%, ${fill} 50%) border-box` }
  return { background: fill }
}
const TIME_LABELS: Record<string, string> = {
  mission: 'Mission', reunion_exterieure: 'Réunion extérieure', travail_hors_site: 'Travail hors site',
  travail_sur_site: 'Travail sur site', permanence: 'Permanence', panier: 'Panier',
}
function cellLines(empId: string, ymd: string): Array<{ text: string; color: string }> {
  const c = cellInfo(empId, ymd)
  const lines: Array<{ text: string; color: string }> = []
  for (const l of c.leaves) {
    const half = l.half === 'am' ? ' (matin)' : l.half === 'pm' ? ' (après-midi)' : ''
    lines.push(detailed.value
      ? { text: `${l.typeName ?? 'Absence'}${half}${l.pending ? ' - en attente de validation' : ''}`, color: l.color || FALLBACK_COLOR }
      : { text: `Absent${half}`, color: FALLBACK_COLOR })
  }
  for (const t of c.times) lines.push({ text: `${TIME_LABELS[t.entryType ?? ''] ?? 'Saisie de temps'} (${t.hours} h)`, color: '#2563eb' })
  for (const m of c.milestones) lines.push({ text: m, color: '#d97706' })
  return lines
}
function cellTitle(e: PlanningEmployee, ymd: string): string {
  const lines = cellLines(e.id, ymd).map((l) => l.text)
  return `${e.name} (${formatDay(ymd)}) : ${lines.length ? lines.join(', ') : 'Présent'}`
}

// ── Indicateurs : le jour d'aujourd'hui s'il est dans le mois, sinon le 1er jour ouvre ──
const kpiDay = computed(() => days.value.find((d) => d.isToday) ?? days.value.find((d) => !d.off) ?? days.value[0])
const kpiDayLabel = computed(() => (kpiDay.value?.isToday ? "aujourd'hui" : kpiDay.value ? formatDay(kpiDay.value.ymd) : ''))
const kpi = computed(() => {
  const list = filteredEmployees.value
  const ymd = kpiDay.value?.ymd ?? ''
  const absent = list.filter((e) => isAbsentFull(e.id, ymd)).length
  const total = list.length
  let pending = 0
  let milestones = 0
  for (const e of list) {
    for (const c of index.value.get(e.id)?.values() ?? []) {
      pending += c.leaves.filter((l) => l.pending).length > 0 ? 1 : 0
      milestones += c.milestones.length
    }
  }
  return { total, absent, present: total - absent, rate: total ? Math.round(((total - absent) / total) * 100) : 0, pending, milestones }
})

// ── Synthèse mensuelle ──
const calendarCells = computed(() => {
  const first = new Date(cursor.value.y, cursor.value.m, 1)
  const offset = (first.getDay() + 6) % 7
  const total = Math.ceil((offset + days.value.length) / 7) * 7
  const list = filteredEmployees.value
  return Array.from({ length: total }, (_, i) => {
    const date = new Date(cursor.value.y, cursor.value.m, i - offset + 1)
    const inMonth = date.getMonth() === cursor.value.m
    const d = buildDay(date)
    let absent = 0
    const milestones: string[] = []
    if (inMonth && !d.off) {
      for (const e of list) {
        if (isAbsentFull(e.id, d.ymd)) absent++
        for (const m of cellInfo(e.id, d.ymd).milestones) milestones.push(`${e.name.split(' ')[0]} : ${m}`)
      }
    }
    const rate = list.length ? Math.round(((list.length - absent) / list.length) * 100) : 0
    return { ...d, inMonth, absent, rate, milestones: milestones.slice(0, 3), holiday: d.holiday }
  })
})

// ── Détail ──
// `open` pilote l'animation ; `detail` reste en place pendant la fermeture pour que le contenu ne disparaisse pas avant la fin du glissement.
const detail = ref<{ employee: PlanningEmployee; ymd: string | null } | null>(null)
const open = ref(false)
function openDetail(employee: PlanningEmployee, ymd: string | null) { detail.value = { employee, ymd }; open.value = true }
const detailDay = computed(() => ({ lines: detail.value?.ymd ? cellLines(detail.value.employee.id, detail.value.ymd) : [] }))
const detailMonth = computed(() => {
  const emp = detail.value?.employee
  if (!emp) return []
  const rows: Array<{ text: string; color: string; when: string }> = []
  const f = (ymd: string) => formatDay(ymd).replace(/ \d{4}$/, '')
  for (const l of store.data?.leaves ?? []) {
    if (l.employeeId !== emp.id) continue
    rows.push({
      text: detailed.value ? `${l.typeName ?? 'Absence'}${l.pending ? ' (en attente)' : ''}` : 'Absent',
      color: detailed.value ? l.color || FALLBACK_COLOR : FALLBACK_COLOR,
      when: l.start === l.end ? f(l.start) : `${f(l.start)} au ${f(l.end)}`,
    })
  }
  for (const t of store.data?.timeEntries ?? []) {
    if (t.employeeId === emp.id) rows.push({ text: TIME_LABELS[t.entryType ?? ''] ?? 'Saisie de temps', color: '#2563eb', when: f(t.date) })
  }
  for (const m of store.data?.milestones ?? []) {
    if (m.employeeId === emp.id) rows.push({ text: m.label, color: '#d97706', when: f(m.date) })
  }
  return rows
})

// ── Chargement : silencieux après le premier, relu sur événement temps réel ──
function load() { return store.fetch(monthFrom.value, monthTo.value) }
if (calendarStore.holidays.length === 0) calendarStore.fetchHolidays(new Date().getFullYear())
watch([monthFrom, monthTo], load)
let stopListening: (() => void) | null = null
onMounted(() => {
  load()
  stopListening = onDomainChanged('leave', () => { load() })
})
onBeforeUnmount(() => stopListening?.())
</script>

<style scoped>
/* Tiroir : fond qui s'estompe, panneau qui glisse depuis la droite. */
.drawer-enter-active, .drawer-leave-active { transition: opacity 0.22s ease; }
.drawer-enter-active .drawer-panel, .drawer-leave-active .drawer-panel { transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1); }
.drawer-enter-from, .drawer-leave-to { opacity: 0; }
.drawer-enter-from .drawer-panel, .drawer-leave-to .drawer-panel { transform: translateX(100%); }
@media (prefers-reduced-motion: reduce) {
  .drawer-enter-active, .drawer-leave-active, .drawer-enter-active .drawer-panel, .drawer-leave-active .drawer-panel { transition: none; }
}
</style>
