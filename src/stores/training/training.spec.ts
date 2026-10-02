import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import {
  useCourseStore, useSessionStore, useEnrollmentStore, useProviderStore, useBudgetStore,
} from './index'

beforeEach(() => setActivePinia(createPinia()))

const coursePayload = {
  title: 'Cours de test', category: 'Test', durationHours: 7, maxParticipants: 10,
  description: 'x', budgetAllocated: 100000,
}

function enrollPayload(sessionId: string, employeeId: string) {
  return {
    sessionId, courseTitle: 'T', sessionScheduledAt: '2026-10-06T08:30',
    employeeId, employeeName: employeeId, entityName: 'DG', requestedByName: employeeId,
  }
}

describe('catalogue (cours)', () => {
  it('cree un cours en preparation sans session ni budget utilise', () => {
    const store = useCourseStore()
    const c = store.create(coursePayload)
    expect(c.status).toBe('InPreparation')
    expect(c.sessionsCount).toBe(0)
    expect(c.budgetUsed).toBe(0)
    expect(store.items[0]!.id).toBe(c.id)
  })

  it('ne reutilise jamais un code de reference apres une suppression', () => {
    const store = useCourseStore()
    const a = store.create(coursePayload)
    const b = store.create(coursePayload)
    store.remove(a.id)
    const c = store.create(coursePayload)
    const codes = [b.referenceCode, c.referenceCode]
    expect(new Set(codes).size).toBe(2)
    expect(store.items.filter(x => x.referenceCode === c.referenceCode)).toHaveLength(1)
  })
})

describe('sessions', () => {
  it('planifier une session incremente sessionsCount du cours', () => {
    const courses = useCourseStore()
    const sessions = useSessionStore()
    const course = courses.items.find(c => c.id === 'crs-1')!
    const before = course.sessionsCount
    const s = sessions.schedule({
      courseId: 'crs-1', courseTitle: course.title, scheduledAt: '2026-11-01T09:00',
      endAt: '2026-11-01T17:00', mode: 'InPerson', location: 'Salle', trainerName: 'X', capacity: 5,
    })
    expect(s.status).toBe('Scheduled')
    expect(s.enrolledCount).toBe(0)
    expect(courses.items.find(c => c.id === 'crs-1')!.sessionsCount).toBe(before + 1)
  })

  it('ne peut etre marquee terminee ou annulee que si elle est planifiee', () => {
    const sessions = useSessionStore()
    sessions.markDone('ses-3') // deja Done
    sessions.cancel('ses-3')
    expect(sessions.items.find(s => s.id === 'ses-3')!.status).toBe('Done')
  })

  it('annuler une session annule ses inscriptions actives et libere les places', () => {
    const sessions = useSessionStore()
    const enrollments = useEnrollmentStore()
    const countBefore = sessions.items.find(s => s.id === 'ses-1')!.enrolledCount
    sessions.cancel('ses-1')
    expect(sessions.items.find(s => s.id === 'ses-1')!.status).toBe('Cancelled')
    const active = enrollments.items.filter(e => e.sessionId === 'ses-1' && ['Requested', 'Approved'].includes(e.status))
    expect(active).toHaveLength(0)
    expect(enrollments.items.find(e => e.id === 'enr-1')!.status).toBe('Cancelled')
    expect(enrollments.items.find(e => e.id === 'enr-2')!.status).toBe('Cancelled')
    expect(sessions.items.find(s => s.id === 'ses-1')!.enrolledCount).toBe(countBefore - 2)
  })
})

describe('inscriptions', () => {
  it('une demande valide est creee et occupe une place', () => {
    const sessions = useSessionStore()
    const enrollments = useEnrollmentStore()
    const before = sessions.items.find(s => s.id === 'ses-1')!.enrolledCount
    const e = enrollments.request(enrollPayload('ses-1', 'emp-9'))
    expect(e.status).toBe('Requested')
    expect(sessions.items.find(s => s.id === 'ses-1')!.enrolledCount).toBe(before + 1)
  })

  it('refuse une inscription quand la session est pleine', () => {
    const sessions = useSessionStore()
    const enrollments = useEnrollmentStore()
    // ses-2 : capacite 8, 7 inscrits
    enrollments.request(enrollPayload('ses-2', 'emp-20'))
    expect(sessions.items.find(s => s.id === 'ses-2')!.enrolledCount).toBe(8)
    expect(() => enrollments.request(enrollPayload('ses-2', 'emp-21'))).toThrow(/compl[èe]te/i)
    expect(sessions.items.find(s => s.id === 'ses-2')!.enrolledCount).toBe(8)
  })

  it('refuse un doublon pour le meme employe et la meme session', () => {
    const enrollments = useEnrollmentStore()
    // emp-1 est deja approuve sur ses-1
    expect(() => enrollments.request(enrollPayload('ses-1', 'emp-1'))).toThrow(/d[ée]j[àa]/i)
  })

  it('refuse une session inconnue, terminee ou annulee', () => {
    const enrollments = useEnrollmentStore()
    expect(() => enrollments.request(enrollPayload('ses-inconnue', 'emp-9'))).toThrow()
    expect(() => enrollments.request(enrollPayload('ses-3', 'emp-9'))).toThrow(/planifi/i) // Done
  })

  it('un refus ou une annulation liberent la place, une approbation non', () => {
    const sessions = useSessionStore()
    const enrollments = useEnrollmentStore()
    const base = sessions.items.find(s => s.id === 'ses-1')!.enrolledCount
    const e1 = enrollments.request(enrollPayload('ses-1', 'emp-30'))
    const e2 = enrollments.request(enrollPayload('ses-1', 'emp-31'))
    expect(sessions.items.find(s => s.id === 'ses-1')!.enrolledCount).toBe(base + 2)
    enrollments.approve(e1.id)
    expect(sessions.items.find(s => s.id === 'ses-1')!.enrolledCount).toBe(base + 2)
    enrollments.reject(e2.id)
    expect(sessions.items.find(s => s.id === 'ses-1')!.enrolledCount).toBe(base + 1)
    enrollments.cancel(e1.id)
    expect(sessions.items.find(s => s.id === 'ses-1')!.enrolledCount).toBe(base)
  })

  it('ne libere pas deux fois la meme place', () => {
    const sessions = useSessionStore()
    const enrollments = useEnrollmentStore()
    const e = enrollments.request(enrollPayload('ses-1', 'emp-40'))
    const afterRequest = sessions.items.find(s => s.id === 'ses-1')!.enrolledCount
    enrollments.reject(e.id)
    enrollments.cancel(e.id)
    expect(sessions.items.find(s => s.id === 'ses-1')!.enrolledCount).toBe(afterRequest - 1)
  })

  it('approuver ou refuser ne fonctionne que sur une demande en attente', () => {
    const enrollments = useEnrollmentStore()
    enrollments.approve('enr-5') // deja Rejected
    expect(enrollments.items.find(e => e.id === 'enr-5')!.status).toBe('Rejected')
    enrollments.reject('enr-1') // deja Approved
    expect(enrollments.items.find(e => e.id === 'enr-1')!.status).toBe('Approved')
  })

  it('marquer present ne fonctionne que sur une inscription approuvee', () => {
    const enrollments = useEnrollmentStore()
    enrollments.markAttended('enr-2') // Requested
    expect(enrollments.items.find(e => e.id === 'enr-2')!.status).toBe('Requested')
    enrollments.markAttended('enr-1') // Approved
    const e = enrollments.items.find(x => x.id === 'enr-1')!
    expect(e.status).toBe('Attended')
    expect(e.attendanceSheetSigned).toBe(true)
  })

  it('evaluation a chaud : uniquement apres presence, echeance a froid a +3 mois', () => {
    const enrollments = useEnrollmentStore()
    enrollments.submitHotEvaluation('enr-2', { score: 5, comment: 'x', date: '2026-10-10' }) // pas present
    expect(enrollments.items.find(e => e.id === 'enr-2')!.hotEvaluation).toBeUndefined()
    enrollments.markAttended('enr-1')
    enrollments.submitHotEvaluation('enr-1', { score: 4, comment: 'bien', date: '2026-10-10' })
    const e = enrollments.items.find(x => x.id === 'enr-1')!
    expect(e.hotEvaluation?.score).toBe(4)
    expect(e.coldEvaluationDueAt).toBe('2027-01-10')
  })

  it('evaluation a froid : uniquement apres une evaluation a chaud', () => {
    const enrollments = useEnrollmentStore()
    enrollments.submitColdEvaluation('enr-3', { score: 3, comment: 'ok', date: '2026-11-20' })
    expect(enrollments.items.find(e => e.id === 'enr-3')!.coldEvaluation?.score).toBe(3)
    enrollments.markAttended('enr-1')
    enrollments.submitColdEvaluation('enr-1', { score: 2, comment: 'x', date: '2026-11-20' }) // pas de chaud
    expect(enrollments.items.find(e => e.id === 'enr-1')!.coldEvaluation).toBeUndefined()
  })

  it('evaluations a froid a relancer : presents, evalues a chaud, echeance depassee, sans evaluation a froid', () => {
    const enrollments = useEnrollmentStore()
    expect(enrollments.coldEvalsDue.map(e => e.id)).not.toContain('enr-3') // echeance dans le futur
    enrollments.markAttended('enr-1')
    enrollments.submitHotEvaluation('enr-1', { score: 4, comment: 'x', date: '2025-01-10' }) // echeance 2025-04-10
    expect(enrollments.coldEvalsDue.map(e => e.id)).toContain('enr-1')
    enrollments.submitColdEvaluation('enr-1', { score: 4, comment: 'x', date: '2026-10-03' })
    expect(enrollments.coldEvalsDue.map(e => e.id)).not.toContain('enr-1')
  })
})

describe('prestataires', () => {
  it('cree un prestataire actif et enregistre une evaluation', () => {
    const store = useProviderStore()
    const p = store.create({ name: 'P', contactName: 'C', email: 'a@b.c', phone: '1', specialties: 's' } as never)
    expect(p.status).toBe('active')
    store.submitEvaluation(p.id, 4.5)
    const updated = store.items.find(x => x.id === p.id)!
    expect(updated.lastEvaluationScore).toBe(4.5)
    expect(updated.lastEvaluationDate).toBe(new Date().toISOString().slice(0, 10))
    store.setStatus(p.id, 'inactive')
    expect(store.items.find(x => x.id === p.id)!.status).toBe('inactive')
  })

  it('refuse une note hors de 0 a 5', () => {
    const store = useProviderStore()
    store.submitEvaluation('prov-1', 9)
    expect(store.items.find(p => p.id === 'prov-1')!.lastEvaluationScore).toBe(4.2)
  })
})

describe('budget', () => {
  it('une demande en attente n entre pas dans les totaux avant approbation', () => {
    const store = useBudgetStore()
    const allocatedBefore = store.totalAllocated
    const line = store.requestBudget({ year: 2027, entityName: 'DG', courseTitle: 'Nouveau', allocated: 1000000 } as never)
    expect(line.requestStatus).toBe('Pending')
    expect(line.used).toBe(0)
    expect(store.totalAllocated).toBe(allocatedBefore)
    store.approve(line.id)
    expect(store.totalAllocated).toBe(allocatedBefore + 1000000)
  })

  it('un refus reste exclu des totaux et une demande deja decidee ne change plus', () => {
    const store = useBudgetStore()
    const before = store.totalAllocated
    store.reject('bud-5')
    expect(store.items.find(b => b.id === 'bud-5')!.requestStatus).toBe('Rejected')
    store.approve('bud-5') // deja refusee
    expect(store.items.find(b => b.id === 'bud-5')!.requestStatus).toBe('Rejected')
    expect(store.totalAllocated).toBe(before)
  })
})
