import type {
  CompanyCalendar, WorkingDays, DayPlanning, LeaveRequestStatus,
} from '../types'

const DAY_KEYS: (keyof WorkingDays)[] = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
]

// Statuts qui occupent visuellement une case du planning — tout sauf
// Draft/Rejected/Returned/Cancelled (jamais confirmes ou plus d'actualite).
const VISIBLE_ON_PLANNING: LeaveRequestStatus[] = [
  'Pending', 'InApprovalN1', 'InApprovalN2', 'InApprovalN3', 'InApprovalN4',
  'Approved', 'Registered', 'Done', 'Regularized',
]

function parseLocal(dateStr: string): Date {
  const p = dateStr.split('-').map(Number)
  return new Date(p[0] ?? 0, (p[1] ?? 1) - 1, p[2] ?? 1)
}

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function isHoliday(
  date: Date,
  calendar: CompanyCalendar,
): { isHoliday: boolean; name?: string } {
  const yyyy      = date.getFullYear()
  const mm        = String(date.getMonth() + 1).padStart(2, '0')
  const dd        = String(date.getDate()).padStart(2, '0')
  const fullDate  = `${yyyy}-${mm}-${dd}`
  const monthDay  = `${mm}-${dd}`

  for (const h of calendar.holidays) {
    // Un férié récurrent garde sa date complète en base ("2000-06-26" par
    // ex., voir mapHoliday()) — seuls mois/jour comptent pour la récurrence,
    // d'où le slice(5) plutôt qu'une comparaison sur la chaîne complète (qui
    // ne matchait jamais avant ce correctif, aucun férié annuel n'était donc
    // jamais détecté nulle part dans l'app).
    if (h.isRecurring  && h.date.slice(5) === monthDay) return { isHoliday: true, name: h.name }
    if (!h.isRecurring && h.date === fullDate)          return { isHoliday: true, name: h.name }
  }
  return { isHoliday: false }
}

export function isWorkingDay(date: Date, calendar: CompanyCalendar): boolean {
  const dayKey    = DAY_KEYS[date.getDay()] as keyof WorkingDays
  const dayConfig = calendar.workingDays[dayKey]
  if (!dayConfig.enabled) return false
  return !isHoliday(date, calendar).isHoliday
}

// Prochain jour ouvre suivant `dateStr` — utilise pour la date de reprise
// affichee, aussi bien depuis calculateEndDate que depuis un choix explicite
// de date de fin (voir AbsenceCreate.vue onEndDateChange).
export function getResumeDate(dateStr: string, calendar: CompanyCalendar): string {
  const resumeDay = parseLocal(dateStr)
  resumeDay.setDate(resumeDay.getDate() + 1)
  while (!isWorkingDay(resumeDay, calendar)) {
    resumeDay.setDate(resumeDay.getDate() + 1)
  }
  return fmt(resumeDay)
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// Vrai si `date` est une absence complete au sens de la demande — seuls
// startDate/endDate peuvent porter une demi-journee (period != 'full'),
// tout jour strictement entre les deux est forcement une absence complete.
function isFullyAbsentDay(
  date: Date, startDate: Date, startPeriod: string, endDate: Date, endPeriod: string,
): boolean {
  if (sameDay(date, startDate) && startPeriod !== 'full') return false
  if (sameDay(date, endDate) && endPeriod !== 'full') return false
  return true
}

// Regime "local" (voir Employee.isExpatriate, reunion Dominique du 12/06) :
// un vendredi PLEINEMENT absent avale le week-end qui suit dans le decompte
// (meme si la demande continue au-dela — verifie pour CHAQUE vendredi de la
// periode, pas seulement le dernier jour), une simple demi-journee de
// presence le vendredi protege le week-end. Miroir exact de
// computeWorkingDays cote backend (source de verite pour ce qui est
// reellement debite) — ceci n'est qu'un apercu avant soumission.
function chargedWorkingDays(
  startDate: Date, endDate: Date,
  startPeriod: 'full' | 'am' | 'pm', endPeriod: 'full' | 'am' | 'pm',
  calendar: CompanyCalendar, isExpatriate: boolean,
): number {
  let count = 0
  const cur = new Date(startDate)
  while (cur <= endDate) {
    if (isWorkingDay(cur, calendar)) {
      const fullyAbsent = isFullyAbsentDay(cur, startDate, startPeriod, endDate, endPeriod)
      count += fullyAbsent ? 1 : 0.5
      if (!isExpatriate && cur.getDay() === 5 && fullyAbsent) {
        const cursor = new Date(cur)
        cursor.setDate(cursor.getDate() + 1)
        while (!isWorkingDay(cursor, calendar)) {
          count++
          cursor.setDate(cursor.getDate() + 1)
        }
      }
    }
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

export function calculateEndDate(
  startDate:    string,
  workingDays:  number,
  calendar:     CompanyCalendar,
  startPeriod:  'full' | 'am' | 'pm' = 'full',
  isExpatriate = false,
): {
  endDate:           string
  endPeriod:         'full' | 'am' | 'pm'
  resumeDate:        string
  actualWorkingDays: number
  chargedDays:       number
} {
  let count          = startPeriod === 'full' ? 0 : 0.5
  const increment    = startPeriod === 'full' ? 1 : 0.5
  let current        = parseLocal(startDate)
  let lastWorkingDay = parseLocal(startDate)

  if (isWorkingDay(current, calendar)) {
    count += increment
    lastWorkingDay = new Date(current)
  }

  while (count < workingDays) {
    current = new Date(current)
    current.setDate(current.getDate() + 1)
    if (isWorkingDay(current, calendar)) {
      const remaining = workingDays - count
      if (remaining <= 0.5) {
        count += 0.5
        lastWorkingDay = new Date(current)
        break
      }
      count += 1
      lastWorkingDay = new Date(current)
    }
  }

  const endPeriod = count % 1 === 0.5 ? 'am' : 'full'
  const chargedDays = chargedWorkingDays(parseLocal(startDate), lastWorkingDay, startPeriod, endPeriod, calendar, isExpatriate)

  return {
    endDate:           fmt(lastWorkingDay),
    endPeriod,
    resumeDate:        getResumeDate(fmt(lastWorkingDay), calendar),
    actualWorkingDays: count,
    chargedDays,
  }
}

// Nombre de jours ouvres demandes entre deux dates (demi-journees de bord
// prises en compte, jamais le week-end "avale" — voir chargedWorkingDays
// pour le total reellement decompte du solde).
export function getWorkingDaysBetween(
  startDate:   string,
  endDate:     string,
  calendar:    CompanyCalendar,
  startPeriod: 'full' | 'am' | 'pm' = 'full',
  endPeriod:   'full' | 'am' | 'pm' = 'full',
): number {
  let count = 0
  const current = parseLocal(startDate)
  const end     = parseLocal(endDate)
  const sd      = parseLocal(startDate)
  const ed      = parseLocal(endDate)
  while (current <= end) {
    if (isWorkingDay(current, calendar)) {
      count += isFullyAbsentDay(current, sd, startPeriod, ed, endPeriod) ? 1 : 0.5
    }
    current.setDate(current.getDate() + 1)
  }
  return count
}

// Total reellement decompte du solde entre deux dates (inclut le week-end
// "avale" pour un employe local, voir chargedWorkingDays) — utilise par
// AbsenceCreate.vue pour l'apercu quand l'utilisateur choisit la date de fin
// directement plutot que par nombre de jours.
export function getChargedDaysBetween(
  startDate:   string,
  endDate:     string,
  calendar:    CompanyCalendar,
  startPeriod: 'full' | 'am' | 'pm' = 'full',
  endPeriod:   'full' | 'am' | 'pm' = 'full',
  isExpatriate = false,
): number {
  return chargedWorkingDays(parseLocal(startDate), parseLocal(endDate), startPeriod, endPeriod, calendar, isExpatriate)
}

export function generateWeekPlanning(
  weekStart: string,
  calendar:  CompanyCalendar,
  absences:  Array<{
    startDate: string
    endDate:   string
    type:      string
    status:    LeaveRequestStatus
    color?:    string
  }>,
): DayPlanning[] {
  const days  : DayPlanning[] = []
  const anchor = parseLocal(weekStart)

  for (let i = 0; i < 7; i++) {
    const current  = parseLocal(weekStart)
    current.setDate(anchor.getDate() + i)

    const dateStr       = fmt(current)
    const holidayCheck  = isHoliday(current, calendar)
    const working       = isWorkingDay(current, calendar)
    const dayKey        = DAY_KEYS[current.getDay()] as keyof WorkingDays
    const dayConfig     = calendar.workingDays[dayKey]

    const absence = absences.find(
      a =>
        a.startDate <= dateStr &&
        a.endDate   >= dateStr &&
        VISIBLE_ON_PLANNING.includes(a.status),
    )

    days.push({
      date:          dateStr,
      isWorkingDay:  working,
      isHoliday:     holidayCheck.isHoliday,
      holidayName:   holidayCheck.name,
      isAbsence:     !!absence,
      absenceType:   absence?.type,
      absenceStatus: absence?.status,
      absenceColor:  absence?.color,
      hours: working ? {
        start:      dayConfig.start,
        end:        dayConfig.end,
        breakStart: dayConfig.breakEnabled ? dayConfig.breakStart : '',
        breakEnd:   dayConfig.breakEnabled ? dayConfig.breakEnd   : '',
      } : undefined,
    })
  }
  return days
}
