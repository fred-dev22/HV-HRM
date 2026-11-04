import { describe, it, expect } from 'vitest'
import { normalizeTime, validateTimeEntryRow } from './timeEntryImportConfig'
import type { ParsedRow } from '../importTypes'

const row = (values: Record<string, string>): ParsedRow => ({ values, raw: {}, extra: {} })

describe('normalizeTime', () => {
  it('met les heures au format HH:mm', () => {
    expect(normalizeTime('8:00')).toBe('08:00')
    expect(normalizeTime('08:30')).toBe('08:30')
    expect(normalizeTime('8h30')).toBe('08:30')
    expect(normalizeTime('17 h')).toBe('17:00')
  })
  it('laisse vide ou illisible tel quel', () => {
    expect(normalizeTime('')).toBe('')
    expect(normalizeTime(undefined)).toBe('')
    expect(normalizeTime('midi')).toBe('midi')
  })
})

describe('validateTimeEntryRow', () => {
  it('accepte horaires valides ou duree seule', () => {
    expect(validateTimeEntryRow(row({ EntryType: 'mission', StartTime: '8:00', EndTime: '17:00' }))).toBeUndefined()
    expect(validateTimeEntryRow(row({ EntryType: 'travail_hors_site', Hours: '6,5' }))).toBeUndefined()
  })
  it('panier et permanence n\'ont besoin ni d\'horaires ni de duree', () => {
    expect(validateTimeEntryRow(row({ EntryType: 'panier' }))).toBeUndefined()
    expect(validateTimeEntryRow(row({ EntryType: 'permanence' }))).toBeUndefined()
  })
  it('refuse l\'absence d\'horaires et de duree', () => {
    expect(validateTimeEntryRow(row({ EntryType: 'mission' }))).toContain('durée')
  })
  it('refuse un horaire seul, mal forme ou une fin avant le debut', () => {
    expect(validateTimeEntryRow(row({ EntryType: 'mission', StartTime: '08:00' }))).toContain('ET')
    expect(validateTimeEntryRow(row({ EntryType: 'mission', StartTime: 'midi', EndTime: '17:00' }))).toContain('HH:mm')
    expect(validateTimeEntryRow(row({ EntryType: 'mission', StartTime: '17:00', EndTime: '08:00' }))).toContain('après')
  })
  it('refuse une duree hors de 0 a 24 h', () => {
    expect(validateTimeEntryRow(row({ EntryType: 'mission', Hours: '30' }))).toBeDefined()
    expect(validateTimeEntryRow(row({ EntryType: 'mission', Hours: '0' }))).toBeDefined()
  })
})
