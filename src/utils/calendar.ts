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

// Jour de la semaine normalement travaille, SANS tenir compte des jours
// feries (contrairement a isWorkingDay). Retour client du 29/09 : un ferie
// ne doit jamais repousser la date de fin/reprise d'un conge, seulement
// faire baisser le nombre de jours decomptes (voir calculateEndDate). Utilise
// uniquement pour positionner la date de fin ; chargedWorkingDays/getResumeDate
// continuent d'utiliser isWorkingDay (un ferie reste bien exclu du decompte,
// et on ne peut evidemment pas reprendre le travail un jour ferie).
export function isWeeklyWorkDay(date: Date, calendar: CompanyCalendar): boolean {
  const dayKey = DAY_KEYS[date.getDay()] as keyof WorkingDays
  return calendar.workingDays[dayKey].enabled
}

// Moment de reprise apres `dateStr` (dernier jour de l'absence) : un dernier
// jour "am" (matinee seule consommee) rend l'apres-midi du meme jour si
// c'est un jour ouvre, tout le reste (journee entiere consommee) rend le
// prochain jour ouvre au complet. Retour client du 23/09 : avant, la reprise
// etait toujours "lendemain matin", meme quand seule la matinee du dernier
// jour etait utilisee (le beneficiaire aurait du reprendre l'apres-midi
// meme, pas attendre le lendemain).
export function getResumeDate(
  dateStr: string,
  endPeriod: 'full' | 'am' | 'pm',
  calendar: CompanyCalendar,
): { date: string; period: 'am' | 'pm' } {
  if (endPeriod === 'am' && isWorkingDay(parseLocal(dateStr), calendar)) {
    return { date: dateStr, period: 'pm' }
  }
  const resumeDay = parseLocal(dateStr)
  resumeDay.setDate(resumeDay.getDate() + 1)
  while (!isWorkingDay(resumeDay, calendar)) {
    resumeDay.setDate(resumeDay.getDate() + 1)
  }
  return { date: fmt(resumeDay), period: 'am' }
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// Vrai si `date` est une absence complete au sens de la demande — seuls
// startDate/endDate peuvent porter une demi-journee, tout jour strictement
// entre les deux est forcement une absence complete. Retour client du 23/09 :
// au debut, "Matin" compte desormais la journee entiere (comme "Journee
// entiere" avant elle, retiree des choix), seul "Apres-midi" ampute cette
// premiere journee, d'ou l'asymetrie avec la fin, ou tout ce qui n'est pas
// "full" (matin ou apres-midi) reste une demi-journee.
function isFullyAbsentDay(
  date: Date, startDate: Date, startPeriod: string, endDate: Date, endPeriod: string,
): boolean {
  if (sameDay(date, startDate) && startPeriod === 'pm') return false
  if (sameDay(date, endDate) && endPeriod !== 'full') return false
  return true
}

// Regime "local" (voir Employee.isExpatriate, reunion Dominique du 12/06) :
// un vendredi PLEINEMENT absent avale le week-end qui suit dans le decompte
// (meme si la demande continue au-dela — verifie pour CHAQUE vendredi de la
// periode, pas seulement le dernier jour), une simple demi-journee de
// presence le vendredi protege le week-end. Un jour ferie a l'interieur de ce
// week-end avale n'est en revanche jamais compte (retour client du 08/09) —
// seuls les jours non-travailles par le calendrier hebdomadaire le sont,
// meme si le curseur doit quand meme le traverser pour atteindre la reprise.
// countCalendarDays (LeaveType.countCalendarDays, retour client du 08/09) :
// bascule sur un decompte calendaire pur, tous les jours comptent (weekends
// et feries inclus), la regle du week-end avale ne s'applique alors plus
// (un weekend est deja compte normalement, voir plus bas).
// Miroir exact de computeWorkingDays cote backend (source de verite pour ce
// qui est reellement debite) — ceci n'est qu'un apercu avant soumission.
function chargedWorkingDays(
  startDate: Date, endDate: Date,
  startPeriod: 'full' | 'am' | 'pm', endPeriod: 'full' | 'am' | 'pm',
  calendar: CompanyCalendar, isExpatriate: boolean, countCalendarDays = false,
): number {
  let count = 0
  const cur = new Date(startDate)
  if (countCalendarDays) {
    while (cur <= endDate) {
      count += isFullyAbsentDay(cur, startDate, startPeriod, endDate, endPeriod) ? 1 : 0.5
      cur.setDate(cur.getDate() + 1)
    }
    return count
  }
  while (cur <= endDate) {
    if (isWorkingDay(cur, calendar)) {
      const fullyAbsent = isFullyAbsentDay(cur, startDate, startPeriod, endDate, endPeriod)
      count += fullyAbsent ? 1 : 0.5
      if (!isExpatriate && cur.getDay() === 5 && fullyAbsent) {
        const cursor = new Date(cur)
        cursor.setDate(cursor.getDate() + 1)
        while (!isWorkingDay(cursor, calendar)) {
          if (!isHoliday(cursor, calendar).isHoliday) count++
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
  countCalendarDays = false,
): {
  endDate:           string
  endPeriod:         'full' | 'am' | 'pm'
  resumeDate:        string
  resumePeriod:      'am' | 'pm'
  actualWorkingDays: number
  chargedDays:       number
} {
  // Decompte calendaire (LeaveType.countCalendarDays) : tout jour compte.
  // Sinon, isWeeklyWorkDay (pas isWorkingDay) : un jour ferie occupe quand
  // meme sa place dans le decompte des jours demandes (retour client du
  // 29/09), sinon un ferie repousserait la date de fin/reprise au lieu de
  // simplement faire baisser le nombre de jours reellement factures (voir
  // chargedWorkingDays, qui lui continue d'exclure les feries du total).
  const countsDay = (d: Date) => countCalendarDays || isWeeklyWorkDay(d, calendar)

  // Compte en demi-journees (unites de 0.5) plutot qu'en jours flottants :
  // "Matin" au debut vaut une journee PLEINE (2 unites), "Apres-midi" une
  // demi (1 unite), chaque jour compte ensuite fournit 2 unites jusqu'a
  // epuisement de la demande. Retour client du 23/09 (Journee entiere
  // retiree des choix de debut, seuls Matin/Apres-midi restent).
  let remainingUnits  = Math.round(workingDays * 2)
  const current        = parseLocal(startDate)
  let lastWorkingDay    = new Date(current)
  let lastDayUnits: 1 | 2 = 2
  // Ce que le dernier jour compte pouvait fournir : 1 pour une premiere journee
  // commencee l'apres-midi, 2 sinon.
  let lastSupply: 1 | 2   = 2
  let first             = true

  while (remainingUnits > 0) {
    if (countsDay(current)) {
      const supply = first && startPeriod === 'pm' ? 1 : 2
      const use    = Math.min(remainingUnits, supply)
      remainingUnits -= use
      lastWorkingDay   = new Date(current)
      lastDayUnits     = use as 1 | 2
      lastSupply       = supply as 1 | 2
      first            = false
    }
    if (remainingUnits <= 0) break
    current.setDate(current.getDate() + 1)
  }

  // "am" = seule la matinee du dernier jour est absente (reprise l'apres-midi
  // meme). Une premiere journee commencee l'apres-midi et consommee en entier
  // (0.5 j) n'est PAS une matinee : l'absence va jusqu'a la fin de la journee,
  // la reprise est le jour ouvre suivant (retour client du 13/10).
  const endPeriod = lastDayUnits === 1 && lastSupply === 2 ? 'am' : 'full'
  const chargedDays = chargedWorkingDays(parseLocal(startDate), lastWorkingDay, startPeriod, endPeriod, calendar, isExpatriate, countCalendarDays)
  const resume = getResumeDate(fmt(lastWorkingDay), endPeriod, calendar)

  return {
    endDate:           fmt(lastWorkingDay),
    endPeriod,
    resumeDate:        resume.date,
    resumePeriod:      resume.period,
    actualWorkingDays: workingDays,
    chargedDays,
  }
}

// Nombre de jours ouvres demandes entre deux dates (demi-journees de bord
// prises en compte, jamais le week-end "avale" — voir chargedWorkingDays
// pour le total reellement decompte du solde). En decompte calendaire
// (countCalendarDays), tous les jours comptent : ce total et celui de
// getChargedDaysBetween deviennent alors identiques (pas de notion de
// week-end avale a part).
export function getWorkingDaysBetween(
  startDate:   string,
  endDate:     string,
  calendar:    CompanyCalendar,
  startPeriod: 'full' | 'am' | 'pm' = 'full',
  endPeriod:   'full' | 'am' | 'pm' = 'full',
  countCalendarDays = false,
): number {
  let count = 0
  const current = parseLocal(startDate)
  const end     = parseLocal(endDate)
  const sd      = parseLocal(startDate)
  const ed      = parseLocal(endDate)
  while (current <= end) {
    if (countCalendarDays || isWorkingDay(current, calendar)) {
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
  countCalendarDays = false,
): number {
  return chargedWorkingDays(parseLocal(startDate), parseLocal(endDate), startPeriod, endPeriod, calendar, isExpatriate, countCalendarDays)
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
