import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api, getApiErrorMessage } from '../lib/api'
import { withToast } from '../lib/withToast'
import type {
  CompanyCalendar, WorkingDays, WorkingHours,
  Holiday, HolidayScope,
} from '../types'

// ── Backend <-> frontend mapping ────────────────────────────────
// Calendar.workDays is a normalized one-row-per-day table server-side
// (productive247-hrm-backend: CalendarWorkDay); the frontend keeps working
// with the friendlier WorkingDays object (keyed by day, "HH:MM" strings) —
// the store is the only place that translates between the two.
interface BackendWorkDay {
  Id?: string
  DayOfWeek: string
  IsEnabled: boolean
  StartTime: string | null
  EndTime: string | null
  BreakEnabled: boolean
  BreakStartTime: string | null
  BreakEndTime: string | null
}
interface BackendCalendar {
  Id: string
  Name: string
  IsDefault: boolean
  EmployeeCategoryId: string | null
  CreatedBy: string
  CreatedAt: string
  ModifiedBy: string | null
  ModifiedAt: string | null
  workDays: BackendWorkDay[]
  createdByEmployee: { FullName: string }
  modifiedByEmployee: { FullName: string } | null
}

function resolveUpdatedBy(data: BackendCalendar): string {
  return (data.modifiedByEmployee ?? data.createdByEmployee).FullName
}
interface BackendHoliday {
  Id: string
  Name: string
  Date: string
  IsRecurring: boolean
  HolidayType: HolidayScope
  OrganizationUnitId: string | null
  AppliesToGender: string | null
  AppliesToExpatriate: boolean | null
  CreatedBy: string
  CreatedAt: string
}

const DAY_KEY_TO_BACKEND: Record<keyof WorkingDays, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday',
  friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
}
const BACKEND_TO_DAY_KEY = Object.fromEntries(
  Object.entries(DAY_KEY_TO_BACKEND).map(([k, v]) => [v, k]),
) as Record<string, keyof WorkingDays>

function isoToHHMM(iso: string | null): string {
  return iso ? iso.slice(11, 16) : ''
}
function hhmmToIso(hhmm: string): string {
  return `2000-01-01T${hhmm || '00:00'}:00.000Z`
}

// "lundi 12 mars à 16h30"
function formatUpdatedAt(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const datePart = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${datePart} à ${d.getHours()}h${minutes}`
}

const EMPTY_DAY = { enabled: false, start: '', end: '', breakEnabled: false, breakStart: '', breakEnd: '' }
const DEFAULT_WORKDAY = { enabled: true, start: '08:00', end: '17:00', breakEnabled: true, breakStart: '12:00', breakEnd: '14:00' }

// Point de depart raisonnable pour une toute nouvelle instance (aucun
// calendrier en base) — lundi a vendredi 08h-17h, plutot qu'une semaine
// entierement vide qui obligerait a tout cocher a la main des l'onboarding.
function defaultWorkingDays(): WorkingDays {
  return {
    monday: { ...DEFAULT_WORKDAY }, tuesday: { ...DEFAULT_WORKDAY }, wednesday: { ...DEFAULT_WORKDAY },
    thursday: { ...DEFAULT_WORKDAY }, friday: { ...DEFAULT_WORKDAY },
    saturday: { ...EMPTY_DAY }, sunday: { ...EMPTY_DAY },
  }
}
function emptyWorkingDays(): WorkingDays {
  return {
    monday: { ...EMPTY_DAY }, tuesday: { ...EMPTY_DAY }, wednesday: { ...EMPTY_DAY },
    thursday: { ...EMPTY_DAY }, friday: { ...EMPTY_DAY }, saturday: { ...EMPTY_DAY }, sunday: { ...EMPTY_DAY },
  }
}

function mapWorkingDaysFromBackend(workDays: BackendWorkDay[]): WorkingDays {
  const result = emptyWorkingDays()
  for (const wd of workDays) {
    const key = BACKEND_TO_DAY_KEY[wd.DayOfWeek]
    if (!key) continue
    result[key] = {
      enabled: wd.IsEnabled,
      start: isoToHHMM(wd.StartTime),
      end: isoToHHMM(wd.EndTime),
      breakEnabled: wd.BreakEnabled,
      breakStart: isoToHHMM(wd.BreakStartTime),
      breakEnd: isoToHHMM(wd.BreakEndTime),
    }
  }
  return result
}

function mapWorkingDaysToBackend(workingDays: WorkingDays): BackendWorkDay[] {
  return (Object.keys(DAY_KEY_TO_BACKEND) as (keyof WorkingDays)[]).map((key) => {
    const day = workingDays[key]
    return {
      DayOfWeek: DAY_KEY_TO_BACKEND[key],
      IsEnabled: day.enabled,
      StartTime: day.enabled ? hhmmToIso(day.start) : null,
      EndTime: day.enabled ? hhmmToIso(day.end) : null,
      BreakEnabled: day.enabled && day.breakEnabled,
      BreakStartTime: day.enabled && day.breakEnabled ? hhmmToIso(day.breakStart) : null,
      BreakEndTime: day.enabled && day.breakEnabled ? hhmmToIso(day.breakEnd) : null,
    }
  })
}

function mapHoliday(raw: BackendHoliday): Holiday {
  return {
    id: raw.Id,
    name: raw.Name,
    date: raw.Date.slice(0, 10),
    isRecurring: raw.IsRecurring,
    holidayType: raw.HolidayType,
    organizationUnitId: raw.OrganizationUnitId ?? undefined,
    appliesToGender: (raw.AppliesToGender as 'M' | 'F' | null) ?? undefined,
    appliesToExpatriate: raw.AppliesToExpatriate ?? undefined,
  }
}

export const useCalendarStore = defineStore('calendar', () => {
  // ── State ────────────────────────────────────────────────────
  const calendarId   = ref('')
  const calendarName = ref('Calendrier standard HV')
  const isDefault    = ref(true)
  const workingDays  = ref<WorkingDays>(emptyWorkingDays())
  const updatedAt    = ref('')
  const updatedBy    = ref('')

  // Dernier etat confirme par le serveur (ou point de depart d'un brouillon
  // pas encore sauvegarde) — compare a `workingDays` pour savoir si des
  // modifications non enregistrees existent (voir isDirty). WorkingDaysConfig
  // ecrit directement dans `workingDays`, donc c'est le seul moyen de
  // distinguer "affiche" de "sauvegarde".
  const savedWorkingDays = ref<WorkingDays>(emptyWorkingDays())
  const isDirty = computed(() => JSON.stringify(workingDays.value) !== JSON.stringify(savedWorkingDays.value))

  // Renseigne uniquement quand l'etat courant est un brouillon "categorie
  // sans calendrier dedie" (voir fetchCalendarByCategory) — indique a
  // updateWorkingDays() de creer un nouveau calendrier scope a cette
  // categorie au lieu de mettre a jour le calendrier global par defaut.
  const pendingCategoryId = ref<string | null>(null)

  const holidays = ref<Holiday[]>([])

  const loading = ref(false)
  const error   = ref<string | null>(null)

  // Vue agregee retro-compatible avec l'ancien CompanyCalendar mocke —
  // utils/calendar.ts et plusieurs composants (AbsenceCreate,
  // EmployeePlanningView) attendent workingDays + holidays sur un seul objet.
  const calendar = computed<CompanyCalendar>(() => ({
    id: calendarId.value,
    workingDays: workingDays.value,
    holidays: holidays.value,
    updatedAt: updatedAt.value,
    updatedBy: updatedBy.value,
  }))

  // ── Getters ───────────────────────────────────────────────────
  const annualHolidays   = computed(() => holidays.value.filter(h => h.isRecurring))
  const ponctualHolidays = computed(() => holidays.value.filter(h => !h.isRecurring))

  const DAY_KEYS: (keyof WorkingDays)[] = [
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  ]

  function toMinutes(t: string): number {
    if (!t) return 0
    const p = t.split(':').map(Number)
    return (p[0] ?? 0) * 60 + (p[1] ?? 0)
  }

  function formatMinutes(min: number): string {
    const h = Math.floor(min / 60)
    const m = min % 60
    return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
  }

  const daysPerWeek = computed(() =>
    DAY_KEYS.filter(k => workingDays.value[k].enabled).length,
  )

  // Bloque l'enregistrement quand un jour actif a des heures incohérentes
  // (fin avant/à début, pause hors plage) — voir test #03 du plan de tests :
  // le message d'erreur s'affichait sans jamais empêcher la sauvegarde.
  const hasWorkingDaysError = computed(() =>
    DAY_KEYS.some((key) => {
      const day = workingDays.value[key]
      if (!day.enabled) return false
      if (toMinutes(day.end) <= toMinutes(day.start)) return true
      if (day.breakEnabled) {
        const bStart = toMinutes(day.breakStart)
        const bEnd = toMinutes(day.breakEnd)
        if (bEnd <= bStart) return true
        if (bStart < toMinutes(day.start)) return true
        if (bEnd > toMinutes(day.end)) return true
      }
      return false
    }),
  )

  const weeklyMinutes = computed(() =>
    DAY_KEYS.reduce((total, key) => {
      const day = workingDays.value[key]
      if (!day.enabled) return total
      const work  = toMinutes(day.end) - toMinutes(day.start)
      const pause = day.breakEnabled ? toMinutes(day.breakEnd) - toMinutes(day.breakStart) : 0
      return total + Math.max(0, work - pause)
    }, 0),
  )

  // ── Actions — Calendar / WorkingDays ────────────────────────────
  // Copie profonde (pas juste le niveau racine) — WorkingDaysConfig mute les
  // objets de jour en place via v-model, un spread superficiel partagerait
  // les memes references et isDirty resterait toujours faux.
  function cloneWorkingDays(wd: WorkingDays): WorkingDays {
    const result = {} as WorkingDays
    for (const key of Object.keys(wd) as (keyof WorkingDays)[]) {
      result[key] = { ...wd[key] }
    }
    return result
  }

  function applyCalendarResponse(data: BackendCalendar) {
    calendarId.value   = data.Id
    calendarName.value = data.Name
    isDefault.value    = data.IsDefault
    workingDays.value  = mapWorkingDaysFromBackend(data.workDays)
    updatedAt.value    = formatUpdatedAt(data.ModifiedAt ?? data.CreatedAt)
    updatedBy.value    = resolveUpdatedBy(data)
    pendingCategoryId.value = null
    savedWorkingDays.value = cloneWorkingDays(workingDays.value)
  }

  // Pas encore de calendrier par defaut (ex: toute nouvelle instance, avant
  // que l'onboarding n'en cree un) — pas bloquant : on propose un point de
  // depart lundi-vendredi plutot qu'une semaine vide, et updateWorkingDays()
  // cree le calendrier des la premiere sauvegarde.
  function resetToNoCalendarDraft() {
    calendarId.value = ''
    pendingCategoryId.value = null
    workingDays.value = defaultWorkingDays()
    savedWorkingDays.value = cloneWorkingDays(workingDays.value)
    error.value = "Aucun calendrier n'est encore configuré"
  }

  // employeeId optionnel : resout le calendrier applicable a cet employe
  // (celui de sa categorie s'il en a un de dedie, sinon le global) — omis,
  // resout pour l'utilisateur courant. Voir GET /calendars/resolve. Utilise
  // par les ecrans "cote employe" (dashboard, planning, demande d'absence)
  // qui veulent savoir quel calendrier S'APPLIQUE A QUELQU'UN — PAS par
  // Configuration > Calendrier, qui doit voir/editer le calendrier par
  // defaut lui-meme quelle que soit la categorie de l'admin connecte (voir
  // fetchDefaultCalendar).
  async function fetchCalendar(employeeId?: string) {
    loading.value = true
    error.value = null
    try {
      const { data } = await api.get<BackendCalendar>('/calendars/resolve', {
        params: employeeId ? { employeeId } : undefined,
      })
      applyCalendarResponse(data)
    } catch (err) {
      resetToNoCalendarDraft()
    } finally {
      loading.value = false
    }
  }

  // Charge le calendrier par defaut (IsDefault=true) lui-meme, independamment
  // de la categorie de l'admin connecte — c'est ce que "Global (par défaut)"
  // doit afficher/editer dans Configuration > Calendrier. fetchCalendar()
  // (resolve) ne convient pas ici : un admin dont la propre categorie a un
  // calendrier dedie verrait CE calendrier au lieu du vrai calendrier global.
  async function fetchDefaultCalendar() {
    loading.value = true
    error.value = null
    try {
      const { data } = await api.get<BackendCalendar>('/calendars/default')
      applyCalendarResponse(data)
    } catch (err) {
      resetToNoCalendarDraft()
    } finally {
      loading.value = false
    }
  }

  // Charge le calendrier dedie d'une categorie s'il existe (retourne true),
  // sinon affiche en lecture les horaires ACTUELS du calendrier global (pas
  // un brouillon generique lundi-vendredi figE) — une categorie sans
  // calendrier dedie suit le global, donc sa vue doit refleter tout
  // changement fait sur celui-ci (voir decision du 05/08). Retourne false
  // dans ce cas ; updateWorkingDays() cree le calendrier de categorie
  // (decouple du global) a la premiere sauvegarde. Utilise par l'ecran
  // Configuration > Calendrier (bascule "Par catégorie").
  async function fetchCalendarByCategory(employeeCategoryId: string): Promise<boolean> {
    loading.value = true
    error.value = null
    try {
      const { data } = await api.get<BackendCalendar[]>('/calendars')
      const existing = data.find((c) => c.EmployeeCategoryId === employeeCategoryId)
      if (existing) {
        applyCalendarResponse(existing)
        return true
      }
      const globalCalendar = data.find((c) => c.IsDefault)
      calendarId.value = ''
      calendarName.value = ''
      isDefault.value = false
      workingDays.value = globalCalendar ? mapWorkingDaysFromBackend(globalCalendar.workDays) : defaultWorkingDays()
      savedWorkingDays.value = cloneWorkingDays(workingDays.value)
      updatedAt.value = globalCalendar ? formatUpdatedAt(globalCalendar.ModifiedAt ?? globalCalendar.CreatedAt) : ''
      updatedBy.value = globalCalendar ? resolveUpdatedBy(globalCalendar) : ''
      pendingCategoryId.value = employeeCategoryId
      return false
    } catch (err) {
      error.value = getApiErrorMessage(err, 'Impossible de charger le calendrier de cette catégorie')
      throw err
    } finally {
      loading.value = false
    }
  }

  // Calendriers de categorie actuellement configures (EmployeeCategoryId
  // non nul) — alimente les annotations "calendrier dédié" du selecteur de
  // categorie dans CalendarView.vue.
  async function fetchConfiguredCategoryCalendars(): Promise<{ id: string; employeeCategoryId: string }[]> {
    const { data } = await api.get<BackendCalendar[]>('/calendars')
    return data
      .filter((c): c is BackendCalendar & { EmployeeCategoryId: string } => c.EmployeeCategoryId != null)
      .map((c) => ({ id: c.Id, employeeCategoryId: c.EmployeeCategoryId }))
  }

  async function updateWorkingDays(days: WorkingDays, newCalendarName?: string) {
    workingDays.value = { ...days }
    error.value = null
    return withToast('Enregistrement du calendrier en cours…', async () => {
      try {
        // Aucun calendrier charge : soit une instance neuve sans calendrier
        // par defaut (voir fetchCalendar), soit une categorie sans
        // calendrier dedie (voir fetchCalendarByCategory) — on cree au lieu
        // de PATCHer un Id inexistant, scope a la categorie le cas echeant.
        if (!calendarId.value) {
          const { data } = await api.post<BackendCalendar>('/calendars', {
            Name: newCalendarName || calendarName.value || 'Calendrier standard',
            IsDefault: !pendingCategoryId.value,
            EmployeeCategoryId: pendingCategoryId.value ?? undefined,
            WorkDays: mapWorkingDaysToBackend(days),
          })
          applyCalendarResponse(data)
          return
        }
        const { data } = await api.patch<BackendCalendar>(`/calendars/${calendarId.value}`, {
          WorkDays: mapWorkingDaysToBackend(days),
        })
        workingDays.value = mapWorkingDaysFromBackend(data.workDays)
        savedWorkingDays.value = cloneWorkingDays(workingDays.value)
        updatedAt.value    = formatUpdatedAt(data.ModifiedAt ?? data.CreatedAt)
        updatedBy.value    = resolveUpdatedBy(data)
      } catch (err) {
        error.value = getApiErrorMessage(err, 'Impossible de mettre à jour les jours ouvrables')
        throw err
      }
    }, () => error.value ?? 'Impossible de mettre à jour les jours ouvrables')
  }

  // Supprime le calendrier dedie d'une categorie — elle retombe sur le
  // calendrier global. Ne touche pas au calendrier par defaut lui-meme
  // (voir CalendarService.remove, qui le refuse explicitement).
  async function deleteCategoryCalendar(id: string, employeeCategoryId: string) {
    error.value = null
    return withToast('Suppression en cours…', async () => {
      try {
        await api.delete(`/calendars/${id}`)
        await fetchCalendarByCategory(employeeCategoryId)
      } catch (err) {
        error.value = getApiErrorMessage(err, 'Impossible de supprimer ce calendrier')
        throw err
      }
    }, () => error.value ?? 'Impossible de supprimer ce calendrier')
  }

  async function updateWorkingHours(hours: WorkingHours) {
    const days = { ...workingDays.value }
    for (const key of Object.keys(days) as (keyof WorkingDays)[]) {
      if (days[key].enabled) {
        days[key] = { ...days[key], start: hours.start, end: hours.end, breakStart: hours.breakStart, breakEnd: hours.breakEnd }
      }
    }
    await updateWorkingDays(days)
  }

  // ── Actions — Holidays ───────────────────────────────────────────
  async function fetchHolidays(year: number, organizationUnitId?: string) {
    loading.value = true
    error.value = null
    try {
      const { data } = await api.get<BackendHoliday[]>(`/holidays/year/${year}`, {
        params: organizationUnitId ? { organizationUnitId } : undefined,
      })
      holidays.value = data.map(mapHoliday)
    } catch (err) {
      error.value = getApiErrorMessage(err, 'Impossible de charger les jours fériés')
      throw err
    } finally {
      loading.value = false
    }
  }

  async function addHoliday(holiday: Omit<Holiday, 'id'>) {
    error.value = null
    return withToast('Création du jour férié en cours…', async () => {
      try {
        const { data } = await api.post<BackendHoliday>('/holidays', {
          Name: holiday.name,
          Date: holiday.date,
          IsRecurring: holiday.isRecurring,
          HolidayType: holiday.holidayType,
          OrganizationUnitId: holiday.organizationUnitId ?? undefined,
          AppliesToGender: holiday.appliesToGender ?? undefined,
          AppliesToExpatriate: holiday.appliesToExpatriate ?? undefined,
        })
        const mapped = mapHoliday(data)
        holidays.value.push(mapped)
        return mapped
      } catch (err) {
        error.value = getApiErrorMessage(err, "Impossible de créer le jour férié")
        throw err
      }
    }, () => error.value ?? "Impossible de créer le jour férié")
  }

  async function removeHoliday(id: string) {
    error.value = null
    return withToast('Suppression en cours…', async () => {
      try {
        await api.delete(`/holidays/${id}`)
        holidays.value = holidays.value.filter(h => h.id !== id)
      } catch (err) {
        error.value = getApiErrorMessage(err, 'Impossible de supprimer le jour férié')
        throw err
      }
    }, () => error.value ?? 'Impossible de supprimer le jour férié')
  }

  async function updateHoliday(id: string, data: Partial<Holiday>) {
    error.value = null
    return withToast('Enregistrement en cours…', async () => {
      try {
        const body: Record<string, unknown> = {}
        if (data.name !== undefined) body.Name = data.name
        if (data.date !== undefined) body.Date = data.date
        if (data.isRecurring !== undefined) body.IsRecurring = data.isRecurring
        if (data.holidayType !== undefined) body.HolidayType = data.holidayType
        if (data.organizationUnitId !== undefined) body.OrganizationUnitId = data.organizationUnitId
        if (data.appliesToGender !== undefined) body.AppliesToGender = data.appliesToGender
        if (data.appliesToExpatriate !== undefined) body.AppliesToExpatriate = data.appliesToExpatriate
        const { data: updated } = await api.patch<BackendHoliday>(`/holidays/${id}`, body)
        const mapped = mapHoliday(updated)
        const idx = holidays.value.findIndex(h => h.id === id)
        if (idx !== -1) holidays.value[idx] = mapped
        return mapped
      } catch (err) {
        error.value = getApiErrorMessage(err, 'Impossible de mettre à jour le jour férié')
        throw err
      }
    }, () => error.value ?? 'Impossible de mettre à jour le jour férié')
  }

  return {
    calendar,
    calendarId,
    calendarName,
    isDefault,
    pendingCategoryId,
    isDirty,
    holidays,
    loading,
    error,
    annualHolidays,
    ponctualHolidays,
    daysPerWeek,
    weeklyMinutes,
    hasWorkingDaysError,
    toMinutes,
    formatMinutes,
    fetchCalendar,
    fetchDefaultCalendar,
    fetchCalendarByCategory,
    fetchConfiguredCategoryCalendars,
    updateWorkingDays,
    updateWorkingHours,
    deleteCategoryCalendar,
    fetchHolidays,
    addHoliday,
    removeHoliday,
    updateHoliday,
  }
})
