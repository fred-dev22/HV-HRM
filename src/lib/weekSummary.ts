// Semaine d'horaires en clair, les jours qui se suivent avec le meme horaire reunis.
import type { WorkingDays } from '../types'
import { isOvernight } from './scheduleHours'

const DAYS: [keyof WorkingDays, string][] = [
  ['monday', 'Lundi'], ['tuesday', 'Mardi'], ['wednesday', 'Mercredi'], ['thursday', 'Jeudi'],
  ['friday', 'Vendredi'], ['saturday', 'Samedi'], ['sunday', 'Dimanche'],
]

export interface WeekSummaryLine { days: string; hours: string }

export function weekSummary(week: WorkingDays): WeekSummaryLine[] {
  const groups: { first: string; last: string; hours: string }[] = []
  for (const [key, name] of DAYS) {
    const day = week[key]
    const hours = day.enabled
      ? `${day.start}-${day.end}${isOvernight(day.start, day.end) ? ' le lendemain' : ''}${day.breakEnabled ? ` (pause ${day.breakStart}-${day.breakEnd})` : ' (sans pause)'}`
      : 'Repos'
    const previous = groups[groups.length - 1]
    if (previous?.hours === hours) previous.last = name
    else groups.push({ first: name, last: name, hours })
  }
  return groups.map(g => ({
    days: g.first === g.last ? g.first : `${g.first} à ${g.last.toLowerCase()}`,
    hours: g.hours,
  }))
}
