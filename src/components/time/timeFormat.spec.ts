import { beforeEach, describe, expect, it, vi } from 'vitest'
import { confirmNight, exitClock, hoursBetween, isNightEntry } from './timeFormat'

const { confirmDialog } = vi.hoisted(() => ({ confirmDialog: vi.fn() }))
vi.mock('../../lib/confirm', () => ({ confirmDialog }))

describe('durees et sorties du lendemain', () => {
  beforeEach(() => confirmDialog.mockReset())

  it('compte les nuits jusqu a 16 h', () => {
    expect(hoursBetween('08:00', '17:30')).toBe(9.5)
    expect(hoursBetween('22:00', '06:00')).toBe(8)
    expect(hoursBetween('13:00', '12:00')).toBe(0)
    expect(hoursBetween('08:00', '08:00')).toBe(0)
    expect(isNightEntry('22:00', '06:00')).toBe(true)
    expect(isNightEntry('08:00', '17:00')).toBe(false)
  })

  it('marque la sortie du lendemain', () => {
    expect(exitClock({ clockIn: '2026-11-16T22:00:00', clockOut: '2026-11-17T06:00:00' })).toBe('06:00 (+1)')
    expect(exitClock({ clockIn: '2026-11-16T08:00:00', clockOut: '2026-11-16T17:00:00' })).toBe('17:00')
    expect(exitClock({ clockIn: '2026-11-16T08:00:00', clockOut: null })).toBe('-')
  })

  it('ne demande confirmation que pour une nuit', async () => {
    expect(await confirmNight([{ start: '08:00', end: '17:00' }])).toBe(true)
    expect(confirmDialog).not.toHaveBeenCalled()
    confirmDialog.mockResolvedValue(false)
    expect(await confirmNight([{ start: '22:00', end: '06:00' }])).toBe(false)
    expect(confirmDialog.mock.calls[0]![0]).toBe('Poste de nuit : de 22:00 à 06:00 le lendemain (8 h). Confirmer ?')
  })
})
