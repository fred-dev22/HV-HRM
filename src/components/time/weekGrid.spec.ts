import { describe, it, expect } from 'vitest'
import { changeOf, draftOf, lockReason, mondayOf } from './weekGrid'
import type { WeekDay } from '../../stores/timeWeeks'

const day = (over: Partial<WeekDay> = {}): WeekDay => ({
  date: '2026-11-16', schedule: '8 h', hours: '07:00-16:00', pause: '12:00-13:00', holiday: false, leave: null, punches: [], extraHours: 0, worked: 0, overtime: 0,
  panier: false, permanence: false, corrected: false, incomplete: false, pendingEntryIds: [], travelDeducted: 0, ...over,
})
const punch = (start: string | null, end: string | null, nextDay = false) => ({ start, end, nextDay, source: 'Morpho' as const, pending: false })

describe('grille de la semaine', () => {
  it('place la sortie du lendemain dans sa colonne', () => {
    const draft = draftOf(day({ punches: [punch('21:00', '05:00', true)] }))
    expect(draft.pairs[0]).toEqual({ start: '21:00', end: '' })
    expect(draft.nextDayOut).toBe('05:00')
  })

  it("un jour non touche n'envoie rien", () => {
    const d = day({ punches: [punch('07:00', '12:00')] })
    expect(changeOf(d, draftOf(d))).toBeNull()
  })

  it('envoie les periodes modifiees, sans les vides', () => {
    const d = day({ punches: [punch('07:00', null)] })
    const draft = draftOf(d)
    draft.pairs[0]!.end = '12:00'
    draft.pairs[1] = { start: '13:00', end: '17:00' }
    expect(changeOf(d, draft)).toEqual({ Date: d.date, Punches: [{ Start: '07:00', End: '12:00' }, { Start: '13:00', End: '17:00' }] })
  })

  it('la sortie du lendemain ferme la periode ouverte, sinon message', () => {
    const d = day()
    const draft = draftOf(d)
    draft.nextDayOut = '05:00'
    expect(changeOf(d, draft)).toContain('lendemain')
    draft.pairs[0]!.start = '21:00'
    expect(changeOf(d, draft)).toMatchObject({ Punches: [{ Start: '21:00', End: '05:00', NextDay: true }] })
  })

  it("une case seule n'envoie que cette case", () => {
    const d = day()
    expect(changeOf(d, { ...draftOf(d), panier: true })).toEqual({ Date: d.date, Panier: true })
  })

  it('verrouille un jour avec saisie en attente ou plus de trois periodes', () => {
    expect(lockReason(day({ pendingEntryIds: ['a'] }))).toContain('attente')
    expect(lockReason(day({ punches: Array(4).fill(punch('01:00', '02:00')) }))).toContain('4')
    expect(lockReason(day())).toBeNull()
  })

  it('trouve le lundi de la semaine', () => {
    expect(mondayOf('2026-11-22')).toBe('2026-11-16')
  })
})
