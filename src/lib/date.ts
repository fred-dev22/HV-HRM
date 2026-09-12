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

// Horodatage "intelligent" pour un instant precis (notifications, journal
// d'activite...) — contrairement a formatDate ci-dessus, la valeur porte une
// vraie heure (DateTime Prisma), donc new Date() est correct ici (pas de
// decalage minuit-UTC a eviter). Paliers : "a l'instant" / "il y a N min" /
// "aujourd'hui a HH:mm" / "hier a HH:mm" / date complete + heure au-dela.
export function formatRelativeDateTime(iso: string | null | undefined): string {
  if (!iso) return '-'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso

  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  const hm = `${hh}h${mm}`

  const now = new Date()
  const diffMin = Math.floor((now.getTime() - date.getTime()) / 60_000)
  if (diffMin < 1) return "à l'instant"
  if (diffMin < 60) return `il y a ${diffMin} minute${diffMin > 1 ? 's' : ''}`

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const dayDiff = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000)
  if (dayDiff === 0) return `aujourd'hui à ${hm}`
  if (dayDiff === 1) return `hier à ${hm}`
  return `${formatDate(iso)} à ${hm}`
}

const WEEKDAYS_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']

// Horodatage "parlant" pour un entretien planifie (ou passe) — a utiliser
// partout ou une date+heure d'entretien est affichee (liste, fiche, widget
// tableau de bord, RSVP public). Paliers : "aujourd'hui"/"demain"/"hier" a
// HHhMM, "<jour> prochain"/"<jour> dernier" a HHhMM dans la semaine qui suit/
// precede, date complete + heure au-dela.
export function formatInterviewDateTime(iso: string | null | undefined): string {
  if (!iso) return '-'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso

  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  const hm = `${hh}h${mm}`

  const now = new Date()
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const dayDiff = Math.round((startOfDay(date) - startOfDay(now)) / 86_400_000)

  if (dayDiff === 0) return `aujourd'hui à ${hm}`
  if (dayDiff === 1) return `demain à ${hm}`
  if (dayDiff === -1) return `hier à ${hm}`
  if (dayDiff > 1 && dayDiff <= 6) return `${WEEKDAYS_FR[date.getDay()]} prochain à ${hm}`
  if (dayDiff < -1 && dayDiff >= -6) return `${WEEKDAYS_FR[date.getDay()]} dernier à ${hm}`
  return `${formatDate(iso)} à ${hm}`
}
