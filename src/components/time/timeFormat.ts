// Affichage des horaires et durees du module Temps de travail.
// Les heures d'entree et de sortie sont des heures murales (comme les
// pointages importes) : on les lit dans le fuseau du navigateur.
import { confirmDialog } from '../../lib/confirm'
import { NIGHT_SHIFT_MAX_HOURS, isOvernight, spanMinutes } from '../../lib/scheduleHours'

export function clock(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '-'
}

/** "HH:mm" pour un champ <input type="time">, depuis un horodatage ISO. */
export function toTimeInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** 9.5 -> "9 h 30", 8 -> "8 h", 0.75 -> "45 min". */
export function formatHours(hours: number): string {
  const total = Math.round(hours * 60)
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`
}

/** Heure de sortie d'une saisie, marquee "(+1)" quand elle a lieu le lendemain. */
export function exitClock(entry: { clockIn: string | null; clockOut: string | null }): string {
  const { clockIn, clockOut } = entry
  const nextDay = !!clockIn && !!clockOut && new Date(clockIn).toDateString() !== new Date(clockOut).toDateString()
  return nextDay ? `${clock(clockOut)} (+1)` : clock(clockOut)
}

/**
 * Duree en heures entre deux "HH:mm". Une fin avant le debut est un poste de nuit
 * (sortie le lendemain). 0 si invalide : fin egale au debut, ou nuit de plus de 16 h.
 */
export function hoursBetween(start: string, end: string): number {
  if (!start || !end) return 0
  const minutes = spanMinutes(start, end)
  if (isOvernight(start, end) && minutes > NIGHT_SHIFT_MAX_HOURS * 60) return 0
  return Math.round((minutes / 60) * 100) / 100
}

export const isNightEntry = (start: string, end: string): boolean => isOvernight(start, end) && hoursBetween(start, end) > 0

export const TIMES_PROBLEM = `L'heure de fin doit différer de l'heure de début, et un poste de nuit ne dépasse pas ${NIGHT_SHIFT_MAX_HOURS} h.`

/**
 * Une sortie le lendemain se confirme, pour qu'une inversion des heures ne passe
 * pas inapercue. Vrai sans rien demander quand aucune saisie n'est de nuit.
 */
export async function confirmNight(periods: { start: string; end: string }[]): Promise<boolean> {
  const nights = periods.filter(p => isNightEntry(p.start, p.end))
  const first = nights[0]
  if (!first) return true
  const example = `de ${first.start} à ${first.end} le lendemain (${formatHours(hoursBetween(first.start, first.end))})`
  return confirmDialog(nights.length === 1
    ? `Poste de nuit : ${example}. Confirmer ?`
    : `${nights.length} saisies finissent le lendemain, par exemple ${example}. Confirmer ?`)
}

export function statusClass(status: string): string {
  if (status === 'Approved') return 'bg-success-bg text-success'
  if (status === 'Rejected') return 'bg-danger-bg text-danger'
  if (status === 'Cancelled') return 'bg-neutral-bg text-neutral'
  return 'bg-warning-bg text-warning'
}

/** Telecharge un fichier CSV (separateur ";" et BOM : s'ouvre correctement dans Excel). */
export function downloadCsv(fileName: string, header: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? '')
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const body = [header, ...rows].map(r => r.map(esc).join(';')).join('\r\n')
  const url = URL.createObjectURL(new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

export const HISTORY_LABELS: Record<string, string> = {
  CREATE: 'Saisie créée',
  UPDATE: 'Saisie modifiée',
  ADJUST: 'Heures ajustées',
  APPROVE: 'Approuvée',
  REJECT: 'Refusée',
  CANCEL: 'Annulée',
}
