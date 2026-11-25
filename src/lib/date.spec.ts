import { describe, expect, it } from 'vitest'
import { toDateInput } from './date'

// Un champ <input type="date"> reste vide s'il reçoit la date ISO complète du backend.
describe('toDateInput', () => {
  it('ramène une date ISO au format du champ, sans décalage de fuseau', () => {
    expect(toDateInput('2024-01-15T00:00:00.000Z')).toBe('2024-01-15')
    expect(toDateInput('2024-01-15')).toBe('2024-01-15')
  })

  it('renvoie une chaîne vide si la date est absente ou illisible', () => {
    expect(toDateInput(null)).toBe('')
    expect(toDateInput(undefined)).toBe('')
    expect(toDateInput('')).toBe('')
    expect(toDateInput('15/01/2024')).toBe('')
  })
})
