import { describe, it, expect } from 'vitest'
import { buildGlobalPdfRows, buildPdfRows, longDate, pdfHours } from './timesheetPdf'
import type { Timesheet } from '../stores/time'

const day = (date: string, required: number, worked: number) => ({
  date, required, worked, overtime: Math.max(0, Math.round((worked - required) * 100) / 100), absence: Math.max(0, Math.round((required - worked) * 100) / 100), in: null, out: null,
})

const sheet: Timesheet = {
  employee: { Id: 'e1', FullName: 'Harald Princio RANDRIAMBELINA', EmployeeNumber: '50861-9', Service: null },
  period: { from: '2026-01-01', to: '2026-01-05' },
  summary: { required: 16, worked: 28, overtime: 13.9, absence: 0 },
  days: [day('2026-01-01', 0, 13.9), day('2026-01-02', 8, 5.1), day('2026-01-03', 0, 0), day('2026-01-04', 0, 0), day('2026-01-05', 8, 9)],
}

describe('feuille de temps PDF', () => {
  it('formate les heures comme le systeme de pointage (une decimale, sans zero inutile)', () => {
    expect(pdfHours(8)).toBe('8h')
    expect(pdfHours(13.94)).toBe('13.9h')
    expect(pdfHours(0)).toBe('0h')
  })

  it('ecrit la periode avec le mois en toutes lettres, sans decalage de fuseau', () => {
    expect(longDate('2026-01-01')).toBe('01 janvier 2026')
    expect(longDate('2026-02-01')).toBe('01 février 2026')
  })

  it('note le jour ferie par son nom et le samedi/dimanche par "Weekend"', () => {
    const rows = buildPdfRows(sheet, { '2026-01-01': 'jour du nouvel an' })
    expect(rows.map((r) => r.day)).toEqual(['Jeu', 'Ven', 'Sam', 'Dim', 'Lun'])
    expect(rows[0]).toMatchObject({ date: '01/01', note: 'jour du nouvel an', muted: true, overtime: '+13.9h', required: '0h', worked: '13.9h' })
    expect(rows[1]).toMatchObject({ note: '', muted: false, overtime: '' })
    expect(rows[2]).toMatchObject({ note: 'Weekend', muted: true })
    expect(rows[3]).toMatchObject({ note: 'Weekend', muted: true })
    expect(rows[4]).toMatchObject({ date: '05/01', overtime: '+1h' })
  })

  it('rapport global : une ligne par employe, "-" sans heures supplementaires', () => {
    const rows = buildGlobalPdfRows([
      { name: 'A B', employeeNumber: '1', required: 168, worked: 161, overtime: 52.61, absence: 59.61 },
      { name: 'C D', employeeNumber: '2', required: 8, worked: 8, overtime: 0, absence: 0 },
    ])
    expect(rows[0]).toEqual(['A B', '1', '168h', '161h', '59.6h', '+52.6h'])
    expect(rows[1]).toEqual(['C D', '2', '8h', '8h', '0h', '-'])
  })
})
