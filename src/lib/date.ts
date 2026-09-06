// Formatte une date backend (YYYY-MM-DD ou ISO complet type
// 2026-07-29T00:00:00.000Z) en DD-MM-YYYY. Extrait directement les chiffres
// du préfixe de la chaîne plutôt que de passer par `new Date()` — un
// `@db.Date` Prisma sérialise en minuit UTC, et `new Date(iso).getDate()`
// décale d'un jour dans les fuseaux horaires négatifs (ex: UTC-3).
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  const [, y, mo, d] = m
  return `${d}-${mo}-${y}`
}

// Date du jour en YYYY-MM-DD (heure locale, pas UTC) — utilisé comme borne
// `max` sur les champs date de naissance / date d'embauche, qui n'ont
// aucune raison d'accepter une date future.
export function todayIso(): string {
  const now = new Date()
  const y = now.getFullYear()
  const mo = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${mo}-${d}`
}
