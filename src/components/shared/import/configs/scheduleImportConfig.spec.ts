import { describe, it, expect } from 'vitest'
import { parseDays, normalizeTime, validateScheduleRow, type ScheduleLookups } from './scheduleImportConfig'
import type { ParsedRow } from '../importTypes'

const row = (values: Record<string, string>): ParsedRow => ({ values, raw: {}, extra: {} })
const lookups: ScheduleLookups = {
  findCategoryId: (t) => (t.toLowerCase() === 'production' ? 'cat1' : undefined),
  findEmployeeId: (t) => (t.toUpperCase() === 'EMP001' ? 'emp1' : undefined),
}

describe('parseDays', () => {
  it('un jour, une plage, une liste, tous', () => {
    expect(parseDays('Samedi')).toEqual(['Saturday'])
    expect(parseDays('Lundi-Vendredi')).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'])
    expect(parseDays('lun au mer')).toEqual(['Monday', 'Tuesday', 'Wednesday'])
    expect(parseDays('Lundi, Mercredi et Vendredi')).toEqual(['Monday', 'Wednesday', 'Friday'])
    expect(parseDays('Tous')).toHaveLength(7)
    expect(parseDays('Jours ouvrés')).toHaveLength(5)
  })
  it('plage a cheval sur la fin de semaine, sans doublon', () => {
    expect(parseDays('Samedi-Lundi')).toEqual(['Monday', 'Saturday', 'Sunday'])
    expect(parseDays('Lundi, Lundi-Mardi')).toEqual(['Monday', 'Tuesday'])
  })
  it('refuse un mot inconnu ou vide', () => {
    expect(parseDays('Lundiii')).toBeNull()
    expect(parseDays('')).toBeNull()
    expect(parseDays(undefined)).toBeNull()
  })
})

describe('normalizeTime', () => {
  it('met au format HH:mm', () => {
    expect(normalizeTime('8:00')).toBe('08:00')
    expect(normalizeTime('8h30')).toBe('08:30')
    expect(normalizeTime('')).toBe('')
  })
})

describe('validateScheduleRow', () => {
  const ok = { Scope: 'global', Days: 'Lundi-Vendredi', StartTime: '08:00', EndTime: '17:00', BreakStartTime: '12:00', BreakEndTime: '13:00' }
  it('accepte une ligne valide, un jour de repos et une portee categorie ou employe', () => {
    expect(validateScheduleRow(row(ok), lookups)).toBeUndefined()
    expect(validateScheduleRow(row({ Scope: 'global', Days: 'Dimanche' }), lookups)).toBeUndefined()
    expect(validateScheduleRow(row({ ...ok, Scope: 'category', Target: 'Production' }), lookups)).toBeUndefined()
    expect(validateScheduleRow(row({ ...ok, Scope: 'employee', Target: 'EMP001' }), lookups)).toBeUndefined()
  })
  it('signale une cible introuvable ou manquante', () => {
    expect(validateScheduleRow(row({ ...ok, Scope: 'category', Target: 'Inconnue' }), lookups)).toContain('introuvable')
    expect(validateScheduleRow(row({ ...ok, Scope: 'employee' }), lookups)).toContain('matricule')
  })
  it('signale des jours non reconnus', () => {
    expect(validateScheduleRow(row({ ...ok, Days: 'Lundiii' }), lookups)).toContain('Jours non reconnus')
  })
  it('signale des heures incoherentes', () => {
    expect(validateScheduleRow(row({ ...ok, EndTime: '' }), lookups)).toContain('ET')
    expect(validateScheduleRow(row({ ...ok, StartTime: '18:00' }), lookups)).toContain('après')
    expect(validateScheduleRow(row({ ...ok, StartTime: 'midi' }), lookups)).toContain('HH:mm')
    expect(validateScheduleRow(row({ ...ok, BreakEndTime: '' }), lookups)).toContain('pause')
    expect(validateScheduleRow(row({ ...ok, BreakStartTime: '07:00' }), lookups)).toContain('comprise')
  })
})
