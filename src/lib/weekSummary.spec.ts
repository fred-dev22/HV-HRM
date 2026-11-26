import { describe, expect, it } from 'vitest'
import { weekSummary } from './weekSummary'

const work = { enabled: true, start: '07:00', end: '16:00', breakEnabled: true, breakStart: '12:00', breakEnd: '13:00' }
const rest = { enabled: false, start: '', end: '', breakEnabled: false, breakStart: '', breakEnd: '' }

describe('weekSummary', () => {
  it('reunit les jours qui se suivent avec le meme horaire', () => {
    const lines = weekSummary({
      monday: work, tuesday: work, wednesday: work, thursday: work,
      friday: { ...work, end: '12:00', breakEnabled: false }, saturday: rest, sunday: rest,
    })
    expect(lines).toEqual([
      { days: 'Lundi à jeudi', hours: '07:00-16:00 (pause 12:00-13:00)' },
      { days: 'Vendredi', hours: '07:00-12:00 (sans pause)' },
      { days: 'Samedi à dimanche', hours: 'Repos' },
    ])
  })
})
