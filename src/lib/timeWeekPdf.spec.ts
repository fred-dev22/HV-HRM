import { describe, it, expect, vi } from 'vitest'
import { printWeek } from './timeWeekPdf'
import type { WeekDetail } from '../stores/timeWeeks'

const { save, tables } = vi.hoisted(() => ({ save: vi.fn(), tables: [] as { head: string[][]; body: string[][] }[] }))
vi.mock('jspdf', () => ({
  default: class {
    lastAutoTable = { finalY: 100 }
    setFontSize() {}
    text() {}
    save = save
  },
}))
vi.mock('jspdf-autotable', () => ({ default: (_doc: unknown, options: { head: string[][]; body: string[][] }) => tables.push(options) }))

const week: WeekDetail = {
  employee: { id: 'e', name: 'Employé Test', code: 'EMP001', service: 'DG' },
  weekStart: '2026-11-09', weekEnd: '2026-11-15', weekNumber: 46, status: 'Validated', isCadre: false,
  controlledBy: 'Chef', controlledAt: null, validatedBy: 'RH', validatedAt: null,
  days: Array.from({ length: 7 }, (_, i) => ({
    date: `2026-11-${String(9 + i).padStart(2, '0')}`, schedule: '8 h', holiday: false, leave: null, extraHours: 0, worked: 8, overtime: 0,
    panier: i === 0, permanence: false, corrected: false, incomplete: false, pendingEntryIds: [],
    punches: [{ start: '07:00', end: '15:00', nextDay: false, source: 'Morpho' as const, pending: false }],
  })),
  totals: { worked: 56, overtime: 16, hs130: 8, hs150: 8, night: 0, holiday: 0, panier: 1, permanenceAmount: 13000 },
  blockers: [], canEdit: false, canControl: false, canValidate: false, canReopen: true, history: [],
}

describe('impression de la semaine', () => {
  it('produit la grille des sept jours et les totaux, nomme par matricule et semaine', async () => {
    await printWeek(week)
    const [grid, totals] = tables
    expect(grid!.body).toHaveLength(7)
    expect(grid!.body[0]).toHaveLength(grid!.head[0]!.length)
    expect(grid!.body[0]!.slice(0, 4)).toEqual(['Lundi', '09/11', '07:00', '15:00'])
    expect(totals!.body[0]!.at(-1)).toBe('13 000')
    expect(save).toHaveBeenCalledWith('pointage-EMP001-semaine-46.pdf')
  })
})
