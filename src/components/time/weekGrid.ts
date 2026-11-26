// Grille de la semaine : passage entre les pointages d'un jour et les colonnes de
// l'ecran (trois paires entree / sortie, plus la sortie du lendemain).
import type { WeekDay, WeekDayChange, PunchSource } from '../../stores/timeWeeks'

export const PAIR_COUNT = 3

export interface DayDraft {
  pairs: { start: string; end: string }[]
  nextDayOut: string
  panier: boolean
  permanence: boolean
}

export function draftOf(day: WeekDay): DayDraft {
  const pairs = Array.from({ length: PAIR_COUNT }, (_, i) => {
    const p = day.punches[i]
    return { start: p?.start ?? '', end: p && !p.nextDay ? (p.end ?? '') : '' }
  })
  const night = day.punches.slice(0, PAIR_COUNT).find(p => p.nextDay)
  return { pairs, nextDayOut: night?.end ?? '', panier: day.panier, permanence: day.permanence }
}

/** Pourquoi les heures d'un jour ne se modifient pas ici, ou null. */
export function lockReason(day: WeekDay): string | null {
  if (day.pendingEntryIds.length) return "Approuvez d'abord les saisies en attente de ce jour."
  if (day.punches.length > PAIR_COUNT) return `${day.punches.length} périodes ce jour : modifiez les saisies correspondantes.`
  return null
}

const hoursKey = (d: DayDraft) => JSON.stringify([d.pairs, d.nextDayOut])

/** Changement a envoyer pour un jour, null s'il n'a pas bouge, ou un message d'erreur. */
export function changeOf(day: WeekDay, draft: DayDraft): WeekDayChange | string | null {
  const initial = draftOf(day)
  const change: WeekDayChange = { Date: day.date }
  if (hoursKey(draft) !== hoursKey(initial)) {
    const pairs: { Start?: string; End?: string; NextDay?: boolean }[] = draft.pairs
      .filter(p => p.start || p.end)
      .map(p => ({ Start: p.start || undefined, End: p.end || undefined }))
    if (draft.nextDayOut) {
      // La sortie du lendemain ferme la derniere periode restee sans sortie.
      const open = [...pairs].reverse().find(p => p.Start && !p.End)
      if (!open) return `${dayLabel(day.date)} : la sortie du lendemain demande une entrée sans sortie.`
      open.End = draft.nextDayOut
      open.NextDay = true
    }
    change.Punches = pairs
  }
  if (draft.panier !== initial.panier) change.Panier = draft.panier
  if (draft.permanence !== initial.permanence) change.Permanence = draft.permanence
  return Object.keys(change).length > 1 ? change : null
}

const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
export const dayName = (date: string) => DAY_NAMES[new Date(`${date}T00:00:00Z`).getUTCDay()]!
export const isWeekend = (date: string) => [0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay())
export const dayLabel = (date: string) => `${dayName(date)} ${date.slice(8, 10)}/${date.slice(5, 7)}`

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
export function mondayOf(date: string): string {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay()
  return addDays(date, dow === 0 ? -6 : 1 - dow)
}

export const SOURCE_LABELS: Record<PunchSource, string> = {
  Morpho: 'Pointeuse (Morpho)', Manual: 'Saisie manuelle', Import: 'Import de fichier', Corrected: 'Corrigé',
}
export const SOURCE_CLASSES: Record<PunchSource, string> = {
  Morpho: 'bg-info-bg border-info',
  Manual: 'bg-warning-bg border-warning',
  Import: 'bg-success-bg border-success',
  Corrected: 'bg-danger-bg border-danger',
}
