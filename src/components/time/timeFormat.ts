// Affichage des horaires et durees du module Temps de travail.
// Les heures d'entree et de sortie sont des heures murales (comme les
// pointages importes) : on les lit dans le fuseau du navigateur.

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

/** Duree en heures entre deux "HH:mm" (0 si invalide ou fin avant debut). */
export function hoursBetween(start: string, end: string): number {
  if (!start || !end) return 0
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const minutes = eh! * 60 + em! - (sh! * 60 + sm!)
  return minutes > 0 ? Math.round((minutes / 60) * 100) / 100 : 0
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
