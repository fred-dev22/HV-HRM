import { describe, it, expect } from 'vitest'
import { checkOf, importResultOf, normalizeTime, validateTimeEntryRow } from './timeEntryImportConfig'
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

describe('controle et resultat d une ligne importee', () => {
  const result = { index: 0, action: 'conflict' as const, message: 'Chevauche : 07:00-12:00', warnings: [], canReplace: true }
  it('un conflit demande un choix et reste non importe sans lui', () => {
    expect(checkOf(result)).toMatchObject({ level: 'conflict', canReplace: true })
    expect(importResultOf(result)).toMatchObject({ success: false, skipped: true })
    expect(importResultOf(result).error).toContain('aucun choix')
  })
  it('un remplacement choisi est pret, une erreur est un echec', () => {
    expect(checkOf({ ...result, action: 'replace' }).level).toBe('ok')
    expect(importResultOf({ ...result, action: 'error', message: 'Matricule inconnu' })).toMatchObject({ success: false, skipped: false })
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
  it('accepte une entree seule, a completer ensuite', () => {
    expect(validateTimeEntryRow(row({ EntryType: 'mission', StartTime: '08:00' }))).toBeUndefined()
  })
  it('refuse un horaire mal forme, une fin egale au debut et une nuit de plus de 16 h', () => {
    expect(validateTimeEntryRow(row({ EntryType: 'mission', StartTime: 'midi', EndTime: '17:00' }))).toContain('HH:mm')
    expect(validateTimeEntryRow(row({ EntryType: 'mission', StartTime: '08:00', EndTime: '08:00' }))).toContain('différer')
    expect(validateTimeEntryRow(row({ EntryType: 'mission', StartTime: '13:00', EndTime: '12:00' }))).toContain('16 h')
  })
  it('accepte un poste de nuit', () => {
    expect(validateTimeEntryRow(row({ EntryType: 'mission', StartTime: '22:00', EndTime: '06:00' }))).toBeUndefined()
  })
  it('refuse une duree hors de 0 a 24 h', () => {
    expect(validateTimeEntryRow(row({ EntryType: 'mission', Hours: '30' }))).toBeDefined()
    expect(validateTimeEntryRow(row({ EntryType: 'mission', Hours: '0' }))).toBeDefined()
  })
})
