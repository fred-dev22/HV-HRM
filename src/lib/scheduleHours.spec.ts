import { describe, expect, it } from 'vitest'
import { breakProblem, hoursProblem, isOvernight, plannedMinutes } from './scheduleHours'

const day = (start: string, end: string, breakStart = '', breakEnd = '') =>
  ({ start, end, breakEnabled: !!breakStart, breakStart, breakEnd })

describe('horaires de jour et de nuit', () => {
  it('compte les heures prevues en passant minuit', () => {
    expect(plannedMinutes(day('08:00', '17:00', '12:00', '13:00'))).toBe(480)
    expect(plannedMinutes(day('22:00', '06:00'))).toBe(480)
    expect(plannedMinutes(day('22:00', '06:00', '01:00', '02:00'))).toBe(420)
    expect(plannedMinutes(day('22:00', '06:00', '23:30', '00:30'))).toBe(420)
    expect(isOvernight('22:00', '06:00')).toBe(true)
    expect(isOvernight('08:00', '17:00')).toBe(false)
  })

  it('accepte une pause avant ou apres minuit et refuse une pause hors horaire', () => {
    expect(breakProblem(day('22:00', '06:00', '01:00', '02:00'))).toBeNull()
    expect(breakProblem(day('22:00', '06:00', '23:00', '01:00'))).toBeNull()
    expect(breakProblem(day('22:00', '06:00', '12:00', '13:00'))).toBe("Après l'heure de fin")
    expect(breakProblem(day('08:00', '17:00', '07:00', '09:00'))).toBe("Avant l'heure de début")
    expect(breakProblem(day('08:00', '17:00', '13:00', '12:00'))).toBe('Fin avant début')
  })

  it('refuse une fin egale au debut et une nuit de plus de 16 h', () => {
    expect(hoursProblem(day('08:00', '08:00'))).toBe('Fin égale au début')
    expect(hoursProblem(day('22:00', '06:00'))).toBeNull()
    expect(hoursProblem(day('18:00', '10:00'))).toBeNull()
    expect(hoursProblem(day('18:00', '17:00'))).toBe('Nuit de plus de 16 h : vérifiez')
  })
})
