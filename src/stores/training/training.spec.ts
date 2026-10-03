import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('../../lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  getApiErrorMessage: (_e: unknown, fallback: string) => fallback,
}))

import { api } from '../../lib/api'
import {
  useCourseStore, useSessionStore, useEnrollmentStore, useProviderStore, useBudgetStore,
  toLocalNaive,
} from './index'
import type { Course, TrainingSession, Enrollment, BudgetLine } from './index'

const get = vi.mocked(api.get)
const post = vi.mocked(api.post)
const patch = vi.mocked(api.patch)

beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
})

// Meme logique de composantes locales que le helper : independant du fuseau.
function localNaive(iso: string) {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

const course = (over: Partial<Course> = {}): Course => ({
  id: 'c1', referenceCode: 'FOR-2026-001', title: 'Excel', category: 'Bureautique', description: 'd',
  durationHours: 7, maxParticipants: 10, status: 'InPreparation', budgetAllocated: 100,
  budgetUsed: 0, sessionsCount: 0, createdAt: '2026-10-01', ...over,
})
const session = (over: Partial<TrainingSession> = {}): TrainingSession => ({
  id: 's1', referenceCode: 'SES-2026-001', courseId: 'c1', courseTitle: 'Excel',
  scheduledAt: '2026-10-06T05:30:00.000Z', endAt: '2026-10-06T13:30:00.000Z', mode: 'InPerson',
  trainerName: 'T', status: 'Scheduled', capacity: 10, enrolledCount: 0, ...over,
})
const enrollment = (over: Partial<Enrollment> = {}): Enrollment => ({
  id: 'e1', sessionId: 's1', courseTitle: 'Excel', sessionScheduledAt: '2026-10-06T05:30:00.000Z',
  employeeId: 'emp1', employeeName: 'A', entityName: 'DG', requestedByName: 'B',
  requestedAt: '2026-10-01', status: 'Requested', ...over,
})

describe('conversion de dates', () => {
  it('toLocalNaive donne YYYY-MM-DDTHH:mm en composantes locales', () => {
    expect(toLocalNaive('2026-10-06T05:30:00.000Z')).toBe(localNaive('2026-10-06T05:30:00.000Z'))
    expect(toLocalNaive('2026-10-06T05:30:00.000Z')).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  })

  it('fetchAll des sessions convertit scheduledAt et endAt', async () => {
    get.mockResolvedValue({ data: [session()] })
    const store = useSessionStore()
    await store.fetchAll()
    expect(get).toHaveBeenCalledWith('/training/sessions')
    expect(store.items[0]!.scheduledAt).toBe(localNaive('2026-10-06T05:30:00.000Z'))
    expect(store.items[0]!.endAt).toBe(localNaive('2026-10-06T13:30:00.000Z'))
    expect(store.loaded).toBe(true)
    expect(store.loading).toBe(false)
  })

  it('fetchAll des inscriptions convertit sessionScheduledAt et garde les jours', async () => {
    get.mockResolvedValue({ data: [enrollment({ coldEvaluationDueAt: '2027-01-10' })] })
    const store = useEnrollmentStore()
    await store.fetchAll()
    expect(store.items[0]!.sessionScheduledAt).toBe(localNaive('2026-10-06T05:30:00.000Z'))
    expect(store.items[0]!.requestedAt).toBe('2026-10-01')
    expect(store.items[0]!.coldEvaluationDueAt).toBe('2027-01-10')
  })

  it('schedule envoie scheduledAt et endAt en ISO UTC et met la liste a jour', async () => {
    post.mockResolvedValue({ data: session({ id: 's9' }) })
    get.mockResolvedValue({ data: [] })
    const store = useSessionStore()
    await store.schedule({
      courseId: 'c1', scheduledAt: '2026-10-06T08:30', endAt: '2026-10-06T16:30',
      mode: 'InPerson', location: 'Salle', trainerName: 'T', capacity: 10,
    })
    const [url, body] = post.mock.calls[0]! as [string, Record<string, unknown>]
    expect(url).toBe('/training/sessions')
    expect(body.scheduledAt).toBe(new Date('2026-10-06T08:30').toISOString())
    expect(body.endAt).toBe(new Date('2026-10-06T16:30').toISOString())
    expect(body.courseId).toBe('c1')
    expect(store.items.map(s => s.id)).toEqual(['s9'])
  })
})

describe('cours', () => {
  it('create insere la ligne renvoyee par le serveur', async () => {
    post.mockResolvedValue({ data: course() })
    const store = useCourseStore()
    await store.create({ title: 'Excel', category: 'B', description: 'd', durationHours: 7, maxParticipants: 10, budgetAllocated: 100 })
    expect(post).toHaveBeenCalledWith('/training/courses', expect.objectContaining({ title: 'Excel' }))
    expect(store.items).toHaveLength(1)
  })

  it('setStatus fait un PATCH et remplace la ligne existante', async () => {
    get.mockResolvedValue({ data: [course()] })
    patch.mockResolvedValue({ data: course({ status: 'InProgress' }) })
    const store = useCourseStore()
    await store.fetchAll()
    await store.setStatus('c1', 'InProgress')
    expect(patch).toHaveBeenCalledWith('/training/courses/c1', { status: 'InProgress' })
    expect(store.items).toHaveLength(1)
    expect(store.items[0]!.status).toBe('InProgress')
    expect(store.inProgressCount).toBe(1)
    expect(store.inPreparationCount).toBe(0)
  })

  it('une erreur est relancee et laisse items inchange', async () => {
    get.mockResolvedValue({ data: [course()] })
    const err = new Error('refus serveur')
    patch.mockRejectedValue(err)
    const store = useCourseStore()
    await store.fetchAll()
    await expect(store.setStatus('c1', 'Archived')).rejects.toBe(err)
    expect(store.items[0]!.status).toBe('InPreparation')
  })

  it('fetchAll remet loading a false meme en cas d erreur', async () => {
    get.mockRejectedValue(new Error('boom'))
    const store = useCourseStore()
    await expect(store.fetchAll()).rejects.toThrow('boom')
    expect(store.loading).toBe(false)
    expect(store.loaded).toBe(false)
  })
})

describe('sessions', () => {
  it('cancel remplace la session et recharge les inscriptions', async () => {
    get.mockImplementation(async (url: string) => {
      if (url === '/training/sessions') return { data: [session()] }
      return { data: [enrollment({ status: 'Cancelled' })] }
    })
    post.mockResolvedValue({ data: session({ status: 'Cancelled' }) })
    const sessions = useSessionStore()
    const enrollments = useEnrollmentStore()
    await sessions.fetchAll()
    await sessions.cancel('s1')
    expect(post).toHaveBeenCalledWith('/training/sessions/s1/cancel')
    expect(sessions.items[0]!.status).toBe('Cancelled')
    expect(get).toHaveBeenCalledWith('/training/enrollments')
    expect(enrollments.items[0]!.status).toBe('Cancelled')
  })

  it('markDone appelle /done', async () => {
    post.mockResolvedValue({ data: session({ status: 'Done' }) })
    const store = useSessionStore()
    await store.markDone('s1')
    expect(post).toHaveBeenCalledWith('/training/sessions/s1/done')
    expect(store.items[0]!.status).toBe('Done')
  })

  it('upcoming ne garde que les sessions planifiees, triees par date', async () => {
    get.mockResolvedValue({ data: [
      session({ id: 'late', scheduledAt: '2026-12-01T08:00:00.000Z' }),
      session({ id: 'done', status: 'Done' }),
      session({ id: 'soon', scheduledAt: '2026-10-02T08:00:00.000Z' }),
    ] })
    const store = useSessionStore()
    await store.fetchAll()
    expect(store.upcoming.map(s => s.id)).toEqual(['soon', 'late'])
  })
})

describe('inscriptions', () => {
  it('request envoie sessionId et employeeId, insere la ligne et recharge les sessions', async () => {
    post.mockResolvedValue({ data: enrollment() })
    get.mockResolvedValue({ data: [session({ enrolledCount: 1 })] })
    const enrollments = useEnrollmentStore()
    const sessions = useSessionStore()
    await enrollments.request({ sessionId: 's1', employeeId: 'emp1' })
    expect(post).toHaveBeenCalledWith('/training/enrollments', { sessionId: 's1', employeeId: 'emp1' })
    expect(enrollments.items).toHaveLength(1)
    expect(sessions.items[0]!.enrolledCount).toBe(1)
  })

  it('request relance l erreur du serveur (session complete) sans rien inserer', async () => {
    const err = Object.assign(new Error('Cette session est complète'), { isAxiosError: true })
    post.mockRejectedValue(err)
    const store = useEnrollmentStore()
    await expect(store.request({ sessionId: 's1', employeeId: 'emp1' })).rejects.toBe(err)
    expect(store.items).toHaveLength(0)
    expect(get).not.toHaveBeenCalled()
  })

  it('approve et markAttended mettent a jour la ligne depuis la reponse', async () => {
    get.mockResolvedValue({ data: [enrollment()] })
    post.mockResolvedValueOnce({ data: enrollment({ status: 'Approved' }) })
    post.mockResolvedValueOnce({ data: enrollment({ status: 'Attended', attendanceSheetSigned: true }) })
    const store = useEnrollmentStore()
    await store.fetchAll()
    await store.approve('e1')
    expect(store.items[0]!.status).toBe('Approved')
    await store.markAttended('e1')
    expect(post).toHaveBeenLastCalledWith('/training/enrollments/e1/attend', undefined)
    expect(store.items[0]!.status).toBe('Attended')
    expect(store.items).toHaveLength(1)
  })

  it('reject et cancel rechargent les sessions (places liberees)', async () => {
    get.mockResolvedValue({ data: [] })
    post.mockResolvedValue({ data: enrollment({ status: 'Rejected' }) })
    const store = useEnrollmentStore()
    await store.reject('e1')
    expect(get).toHaveBeenCalledWith('/training/sessions')
    get.mockClear()
    post.mockResolvedValue({ data: enrollment({ status: 'Cancelled' }) })
    await store.cancel('e1')
    expect(get).toHaveBeenCalledWith('/training/sessions')
  })

  it('submitHotEvaluation envoie le corps et prend coldEvaluationDueAt du serveur', async () => {
    const evaluation = { score: 4, comment: 'ok', date: '2026-10-10' }
    post.mockResolvedValue({ data: enrollment({ status: 'Attended', hotEvaluation: evaluation, coldEvaluationDueAt: '2027-01-10' }) })
    const store = useEnrollmentStore()
    await store.submitHotEvaluation('e1', evaluation)
    expect(post).toHaveBeenCalledWith('/training/enrollments/e1/hot-evaluation', evaluation)
    expect(store.items[0]!.coldEvaluationDueAt).toBe('2027-01-10')
  })

  it('coldEvalsDue garde les presences evaluees a chaud, sans eval a froid, echues', async () => {
    const hot = { score: 4, comment: 'ok', date: '2026-01-01' }
    get.mockResolvedValue({ data: [
      enrollment({ id: 'due', status: 'Attended', hotEvaluation: hot, coldEvaluationDueAt: '2026-04-01' }),
      enrollment({ id: 'future', status: 'Attended', hotEvaluation: hot, coldEvaluationDueAt: '2999-01-01' }),
      enrollment({ id: 'done', status: 'Attended', hotEvaluation: hot, coldEvaluationDueAt: '2026-04-01', coldEvaluation: hot }),
      enrollment({ id: 'nohot', status: 'Attended', coldEvaluationDueAt: '2026-04-01' }),
    ] })
    const store = useEnrollmentStore()
    await store.fetchAll()
    expect(store.coldEvalsDue.map(e => e.id)).toEqual(['due'])
  })

  it('pendingRequests ne garde que le statut Requested', async () => {
    get.mockResolvedValue({ data: [enrollment({ id: 'a' }), enrollment({ id: 'b', status: 'Approved' })] })
    const store = useEnrollmentStore()
    await store.fetchAll()
    expect(store.pendingRequests.map(e => e.id)).toEqual(['a'])
  })
})

describe('prestataires', () => {
  it('submitEvaluation poste la note et remplace le prestataire', async () => {
    const provider = { id: 'p1', name: 'P', contactName: 'c', email: 'e', phone: '1', specialties: 's', nextEvaluationDueAt: '2026-12-01', status: 'active' as const }
    get.mockResolvedValue({ data: [provider] })
    post.mockResolvedValue({ data: { ...provider, lastEvaluationScore: 4.5 } })
    const store = useProviderStore()
    await store.fetchAll()
    await store.submitEvaluation('p1', 4.5)
    expect(post).toHaveBeenCalledWith('/training/providers/p1/evaluate', { score: 4.5 })
    expect(store.items[0]!.lastEvaluationScore).toBe(4.5)
  })
})

describe('budget', () => {
  const line = (over: Partial<BudgetLine>): BudgetLine => ({
    id: 'b1', year: 2026, entityName: 'DG', allocated: 1000, used: 400, requestStatus: 'Approved', ...over,
  })

  it('totalAllocated et totalUsed excluent les lignes non approuvees', async () => {
    get.mockResolvedValue({ data: [
      line({ id: 'a' }),
      line({ id: 'b', allocated: 500, used: 100, requestStatus: 'Pending' }),
      line({ id: 'c', allocated: 700, used: 50, requestStatus: 'Rejected' }),
    ] })
    const store = useBudgetStore()
    await store.fetchAll()
    expect(store.totalAllocated).toBe(1000)
    expect(store.totalUsed).toBe(400)
  })

  it('approve remplace la ligne par la reponse du serveur', async () => {
    get.mockResolvedValue({ data: [line({ requestStatus: 'Pending' })] })
    post.mockResolvedValue({ data: line({ requestStatus: 'Approved' }) })
    const store = useBudgetStore()
    await store.fetchAll()
    await store.approve('b1')
    expect(post).toHaveBeenCalledWith('/training/budget/b1/approve')
    expect(store.items[0]!.requestStatus).toBe('Approved')
  })
})
