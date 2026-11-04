import { describe, it, expect } from 'vitest'
import { dayPartOf, firstNameOf } from './greeting'

const at = (h: number, m = 0) => new Date(2026, 10, 4, h, m)

describe('dayPartOf', () => {
  it('bonjour avant midi, apres-midi jusqu\'a 18 h, soir ensuite', () => {
    expect(dayPartOf(at(0))).toBe('morning')
    expect(dayPartOf(at(11, 59))).toBe('morning')
    expect(dayPartOf(at(12))).toBe('afternoon')
    expect(dayPartOf(at(17, 59))).toBe('afternoon')
    expect(dayPartOf(at(18))).toBe('evening')
    expect(dayPartOf(at(23, 30))).toBe('evening')
  })
})

describe('firstNameOf', () => {
  it('prend le prenom, sinon le premier mot du nom', () => {
    expect(firstNameOf({ firstName: 'Fredy', name: 'Fredy Pone' })).toBe('Fredy')
    expect(firstNameOf({ name: 'Alice Rakoto' })).toBe('Alice')
    expect(firstNameOf(null)).toBe('')
  })
})
