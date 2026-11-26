// Heures d'un jour de calendrier. Une fin avant le debut est un poste de nuit :
// elle tombe le lendemain, et la pause peut alors se placer avant ou apres minuit.
// Memes regles que le serveur (calendar-hours.ts).

export const toMinutes = (time: string): number => {
  if (!time) return 0
  const [h, m] = time.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

export const isOvernight = (start: string, end: string): boolean => !!start && !!end && toMinutes(end) < toMinutes(start)

/** Minutes entre deux heures, en passant minuit si la fin precede le debut. */
export const spanMinutes = (start: string, end: string): number => (toMinutes(end) - toMinutes(start) + 1440) % 1440

interface Day { start: string; end: string; breakEnabled: boolean; breakStart: string; breakEnd: string }

/** Minutes travaillees prevues, pause deduite. */
export function plannedMinutes(day: Day): number {
  const pause = day.breakEnabled ? spanMinutes(day.breakStart, day.breakEnd) : 0
  return Math.max(0, spanMinutes(day.start, day.end) - pause)
}

// Au-dela, une fin avant le debut est plutot une faute de saisie qu'un poste de nuit.
export const NIGHT_SHIFT_MAX_HOURS = 16

export function hoursProblem(day: Day): string | null {
  if (toMinutes(day.end) === toMinutes(day.start)) return 'Fin égale au début'
  if (isOvernight(day.start, day.end) && spanMinutes(day.start, day.end) > NIGHT_SHIFT_MAX_HOURS * 60) {
    return `Nuit de plus de ${NIGHT_SHIFT_MAX_HOURS} h : vérifiez`
  }
  return null
}

export function breakProblem(day: Day): string | null {
  if (!day.breakEnabled) return null
  const start = toMinutes(day.start)
  const overnight = isOvernight(day.start, day.end)
  // Poste de nuit : une heure anterieure au debut appartient au lendemain.
  const place = (value: number) => (overnight && value < start ? value + 1440 : value)
  const from = place(toMinutes(day.breakStart))
  const to = place(toMinutes(day.breakEnd))
  if (to <= from) return 'Fin avant début'
  if (from < start) return "Avant l'heure de début"
  if (to > toMinutes(day.end) + (overnight ? 1440 : 0)) return "Après l'heure de fin"
  return null
}
