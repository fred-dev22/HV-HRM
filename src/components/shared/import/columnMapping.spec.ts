import { describe, it, expect } from 'vitest'
import { resolveColumnMapping, mappingToRemember, normalizeHeader } from './columnMapping'

const expected = [{ csvHeader: 'Matricule' }, { csvHeader: 'Début' }, { csvHeader: 'Fin' }]

describe('resolveColumnMapping', () => {
  it('reconnait les colonnes par leur nom, sans accent ni casse', () => {
    expect(resolveColumnMapping(expected, ['matricule', 'DEBUT', 'Fin'])).toEqual({ Matricule: 'matricule', 'Début': 'DEBUT', Fin: 'Fin' })
  })
  it('laisse vide ce qui manque', () => {
    expect(resolveColumnMapping(expected, ['Matricule'])).toEqual({ Matricule: 'Matricule', 'Début': '', Fin: '' })
  })
  it("reprend l'association memorisee si la colonne existe encore", () => {
    const saved = { Matricule: 'Employee ID', 'Début': 'Arrivée' }
    expect(resolveColumnMapping(expected, ['Employee ID', 'Fin'], saved)).toEqual({ Matricule: 'Employee ID', 'Début': '', Fin: 'Fin' })
  })
  it("le nom exact prime sur l'association memorisee", () => {
    expect(resolveColumnMapping(expected, ['Matricule', 'Employee ID'], { Matricule: 'Employee ID' }).Matricule).toBe('Matricule')
  })
})

describe('mappingToRemember', () => {
  it("ne garde que les associations differentes du nom attendu", () => {
    expect(mappingToRemember({ Matricule: 'Employee ID', 'Début': 'debut', Fin: '' })).toEqual({ Matricule: 'Employee ID' })
  })
})

describe('normalizeHeader', () => {
  it('ignore accents, casse et espaces', () => {
    expect(normalizeHeader('  Début ')).toBe('debut')
  })
})
