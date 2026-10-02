/**
 * Module Formation (design uniquement, données fictives), même approche
 * que le module Recrutement avant son branchement au vrai backend : stores
 * Pinia locaux, CRUD sur des tableaux en mémoire, aucun appel réseau. Les
 * noms des actions (create/update/remove…) restent volontairement alignés
 * sur ceux des autres modules pour que le passage à un vrai backend plus
 * tard reste un simple remplacement du corps de fonction.
 */
import { defineStore } from 'pinia'
import type {
  Course, CourseStatus,
  TrainingSession, SessionStatus, SessionMode,
  Enrollment, EnrollmentStatus, EvaluationEntry,
  Provider, ProviderStatus,
  BudgetLine, BudgetRequestStatus,
} from './types'

export type {
  Course, CourseStatus,
  TrainingSession, SessionStatus, SessionMode,
  Enrollment, EnrollmentStatus, EvaluationEntry,
  Provider, ProviderStatus,
  BudgetLine, BudgetRequestStatus,
}

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

// Prochain code de référence (ex. FOR-2026-005) : numéro le plus élevé déjà
// utilisé + 1, jamais "nombre d'éléments + 1" qui recréerait un code existant
// après une suppression.
function nextReferenceCode(prefix: string, existingCodes: string[]): string {
  const max = existingCodes.reduce((highest, code) => {
    const n = Number(code.split('-').pop())
    return Number.isFinite(n) && n > highest ? n : highest
  }, 0)
  return `${prefix}-${new Date().getFullYear()}-${String(max + 1).padStart(3, '0')}`
}

const isValidScore = (score: number) => Number.isFinite(score) && score >= 0 && score <= 5

// Statuts d'inscription qui occupent une place dans la session.
const SEAT_HOLDING: EnrollmentStatus[] = ['Requested', 'Approved', 'Attended']

// ═══════════════════════════════════════════════════════════════
// Catalogue de formations
// ═══════════════════════════════════════════════════════════════
const MOCK_COURSES: Course[] = [
  {
    id: 'crs-1', referenceCode: 'FOR-2026-001', title: 'Excel avancé pour la finance',
    category: 'Bureautique', description: 'Tableaux croisés dynamiques, macros de base, modélisation financière.',
    durationHours: 21, maxParticipants: 12, providerId: 'prov-1', providerName: 'Skillup Madagascar',
    status: 'InProgress', budgetAllocated: 3500000, budgetUsed: 2100000, sessionsCount: 2,
    createdAt: '2026-07-02',
  },
  {
    id: 'crs-2', referenceCode: 'FOR-2026-002', title: 'Management d\'équipe pour nouveaux managers',
    category: 'Leadership', description: 'Fondamentaux du management : délégation, feedback, gestion des conflits.',
    durationHours: 14, maxParticipants: 10, providerId: 'prov-2', providerName: 'Cabinet RH Plus',
    status: 'InPreparation', budgetAllocated: 5000000, budgetUsed: 0, sessionsCount: 1,
    createdAt: '2026-09-10',
  },
  {
    id: 'crs-3', referenceCode: 'FOR-2026-003', title: 'Sécurité et gestes de premiers secours',
    category: 'HSE', description: 'Formation obligatoire annuelle : prévention des accidents, gestes de premiers secours.',
    durationHours: 7, maxParticipants: 20, providerId: 'prov-3', providerName: 'SST Formation',
    status: 'Archived', budgetAllocated: 1800000, budgetUsed: 1750000, sessionsCount: 3,
    createdAt: '2026-03-15',
  },
  {
    id: 'crs-4', referenceCode: 'FOR-2026-004', title: 'Anglais professionnel, niveau intermédiaire',
    category: 'Langues', description: 'Communication écrite et orale en contexte professionnel, 1h30/semaine.',
    durationHours: 30, maxParticipants: 8, providerId: 'prov-1', providerName: 'Skillup Madagascar',
    status: 'InProgress', budgetAllocated: 4200000, budgetUsed: 1400000, sessionsCount: 4,
    createdAt: '2026-06-20',
  },
]

export const useCourseStore = defineStore('training-courses', {
  state: () => ({ items: structuredClone(MOCK_COURSES) as Course[] }),
  getters: {
    inProgressCount: (state) => state.items.filter(c => c.status === 'InProgress').length,
    inPreparationCount: (state) => state.items.filter(c => c.status === 'InPreparation').length,
  },
  actions: {
    create(payload: Omit<Course, 'id' | 'referenceCode' | 'status' | 'budgetUsed' | 'sessionsCount' | 'createdAt'>) {
      const course: Course = {
        ...payload,
        id: uid('crs'),
        referenceCode: nextReferenceCode('FOR', this.items.map(c => c.referenceCode)),
        status: 'InPreparation',
        budgetUsed: 0,
        sessionsCount: 0,
        createdAt: new Date().toISOString().slice(0, 10),
      }
      this.items.unshift(course)
      return course
    },
    update(id: string, patch: Partial<Course>) {
      const item = this.items.find(c => c.id === id)
      if (item) Object.assign(item, patch)
    },
    setStatus(id: string, status: CourseStatus) {
      this.update(id, { status })
    },
    remove(id: string) {
      this.items = this.items.filter(c => c.id !== id)
    },
  },
})

// ═══════════════════════════════════════════════════════════════
// Sessions planifiées
// ═══════════════════════════════════════════════════════════════
const MOCK_SESSIONS: TrainingSession[] = [
  {
    id: 'ses-1', referenceCode: 'SES-2026-001', courseId: 'crs-1', courseTitle: 'Excel avancé pour la finance',
    scheduledAt: '2026-10-06T08:30', endAt: '2026-10-08T16:30', mode: 'InPerson',
    location: 'Salle de formation, Direction Generale', trainerName: 'Hery Andriamanantena',
    status: 'Scheduled', capacity: 12, enrolledCount: 9,
  },
  {
    id: 'ses-2', referenceCode: 'SES-2026-002', courseId: 'crs-4', courseTitle: 'Anglais professionnel, niveau intermédiaire',
    scheduledAt: '2026-09-29T17:00', endAt: '2026-09-29T18:30', mode: 'VideoCall',
    meetingLink: 'https://meet.google.com/hv-anglais-sept', trainerName: 'Sarah Lindqvist',
    status: 'Scheduled', capacity: 8, enrolledCount: 7,
  },
  {
    id: 'ses-3', referenceCode: 'SES-2026-003', courseId: 'crs-3', courseTitle: 'Sécurité et gestes de premiers secours',
    scheduledAt: '2026-08-18T08:00', endAt: '2026-08-18T15:00', mode: 'InPerson',
    location: 'Cour arrière, siège HV', trainerName: 'Tojo Ravelojaona',
    status: 'Done', capacity: 20, enrolledCount: 18,
  },
  {
    id: 'ses-4', referenceCode: 'SES-2026-004', courseId: 'crs-1', courseTitle: 'Excel avancé pour la finance',
    scheduledAt: '2026-07-14T08:30', endAt: '2026-07-16T16:30', mode: 'InPerson',
    location: 'Salle de formation, Direction Generale', trainerName: 'Hery Andriamanantena',
    status: 'Done', capacity: 12, enrolledCount: 11,
  },
]

export const useSessionStore = defineStore('training-sessions', {
  state: () => ({ items: structuredClone(MOCK_SESSIONS) as TrainingSession[] }),
  getters: {
    upcoming: (state) => state.items.filter(s => s.status === 'Scheduled')
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)),
  },
  actions: {
    schedule(payload: Omit<TrainingSession, 'id' | 'referenceCode' | 'status' | 'enrolledCount'>) {
      const session: TrainingSession = {
        ...payload,
        id: uid('ses'),
        referenceCode: nextReferenceCode('SES', this.items.map(s => s.referenceCode)),
        status: 'Scheduled',
        enrolledCount: 0,
      }
      this.items.unshift(session)
      const course = useCourseStore()
      course.update(payload.courseId, { sessionsCount: (course.items.find(c => c.id === payload.courseId)?.sessionsCount ?? 0) + 1 })
      return session
    },
    update(id: string, patch: Partial<TrainingSession>) {
      const item = this.items.find(s => s.id === id)
      if (item) Object.assign(item, patch)
    },
    // Seule une session encore planifiée peut être terminée ou annulée.
    markDone(id: string) {
      if (this.items.find(s => s.id === id)?.status === 'Scheduled') this.update(id, { status: 'Done' })
    },
    // Annuler une session annule aussi ses inscriptions en cours et libère
    // leurs places (sinon des demandes "Approuvée" resteraient sur une
    // session qui n'aura jamais lieu).
    cancel(id: string) {
      if (this.items.find(s => s.id === id)?.status !== 'Scheduled') return
      this.update(id, { status: 'Cancelled' })
      useEnrollmentStore().cancelForSession(id)
    },
  },
})

// ═══════════════════════════════════════════════════════════════
// Inscriptions (couvre la demande de formation + la présence)
// ═══════════════════════════════════════════════════════════════
const MOCK_ENROLLMENTS: Enrollment[] = [
  {
    id: 'enr-1', sessionId: 'ses-1', courseTitle: 'Excel avancé pour la finance', sessionScheduledAt: '2026-10-06T08:30',
    employeeId: 'emp-1', employeeName: 'Voahangy Razafindrakoto', entityName: 'Direction Generale',
    requestedByName: 'Voahangy Razafindrakoto', requestedAt: '2026-09-12', status: 'Approved',
  },
  {
    id: 'enr-2', sessionId: 'ses-1', courseTitle: 'Excel avancé pour la finance', sessionScheduledAt: '2026-10-06T08:30',
    employeeId: 'emp-2', employeeName: 'Fenosoa Ramanantsoa', entityName: 'Direction Generale',
    requestedByName: 'Hery Andriamanantena', requestedAt: '2026-09-14', status: 'Requested',
  },
  {
    id: 'enr-3', sessionId: 'ses-3', courseTitle: 'Sécurité et gestes de premiers secours', sessionScheduledAt: '2026-08-18T08:00',
    employeeId: 'emp-3', employeeName: 'Tojo Ravelojaona', entityName: 'Direction Generale',
    requestedByName: 'Tojo Ravelojaona', requestedAt: '2026-08-01', status: 'Attended', attendanceSheetSigned: true,
    hotEvaluation: { score: 4.5, comment: 'Formation très pratique, formateur clair.', date: '2026-08-18' },
    coldEvaluationDueAt: '2026-11-18',
  },
  {
    id: 'enr-4', sessionId: 'ses-4', courseTitle: 'Excel avancé pour la finance', sessionScheduledAt: '2026-07-14T08:30',
    employeeId: 'emp-1', employeeName: 'Voahangy Razafindrakoto', entityName: 'Direction Generale',
    requestedByName: 'Voahangy Razafindrakoto', requestedAt: '2026-06-30', status: 'Attended', attendanceSheetSigned: true,
    hotEvaluation: { score: 4, comment: 'Bon contenu, rythme un peu rapide.', date: '2026-07-16' },
    coldEvaluationDueAt: '2026-10-16',
    coldEvaluation: { score: 4, comment: 'Utilise les TCD régulièrement depuis la formation.', date: '2026-10-18' },
  },
  {
    id: 'enr-5', sessionId: 'ses-2', courseTitle: 'Anglais professionnel, niveau intermédiaire', sessionScheduledAt: '2026-09-29T17:00',
    employeeId: 'emp-4', employeeName: 'Njaka Rasoanaivo', entityName: 'Direction Generale',
    requestedByName: 'Njaka Rasoanaivo', requestedAt: '2026-09-05', status: 'Rejected',
  },
]

export const useEnrollmentStore = defineStore('training-enrollments', {
  state: () => ({ items: structuredClone(MOCK_ENROLLMENTS) as Enrollment[] }),
  getters: {
    pendingRequests: (state) => state.items.filter(e => e.status === 'Requested'),
    coldEvalsDue: (state) => state.items.filter(e =>
      e.status === 'Attended' && e.hotEvaluation && !e.coldEvaluation && e.coldEvaluationDueAt
      && e.coldEvaluationDueAt <= new Date().toISOString().slice(0, 10)),
  },
  actions: {
    // Une inscription occupe une place tant qu'elle n'est ni refusée ni
    // annulée. Les règles sont ici (et pas seulement dans le formulaire) pour
    // qu'aucun autre écran ne puisse les contourner.
    request(payload: Omit<Enrollment, 'id' | 'status' | 'requestedAt'>) {
      const session = useSessionStore().items.find(x => x.id === payload.sessionId)
      if (!session) throw new Error('Session introuvable')
      if (session.status !== 'Scheduled') throw new Error("Cette session n'est plus planifiée")
      if (session.enrolledCount >= session.capacity) throw new Error('Cette session est complète')
      const alreadyEnrolled = this.items.some(e =>
        e.sessionId === payload.sessionId && e.employeeId === payload.employeeId && SEAT_HOLDING.includes(e.status))
      if (alreadyEnrolled) throw new Error('Cet employé est déjà inscrit à cette session')

      const enrollment: Enrollment = { ...payload, id: uid('enr'), status: 'Requested', requestedAt: new Date().toISOString().slice(0, 10) }
      this.items.unshift(enrollment)
      session.enrolledCount += 1
      return enrollment
    },
    approve(id: string) { this.transition(id, ['Requested'], 'Approved') },
    reject(id: string) { this.transition(id, ['Requested'], 'Rejected') },
    cancel(id: string) { this.transition(id, ['Requested', 'Approved'], 'Cancelled') },
    setStatus(id: string, status: EnrollmentStatus) {
      const item = this.items.find(e => e.id === id)
      if (!item) return
      const wasHoldingSeat = SEAT_HOLDING.includes(item.status)
      item.status = status
      if (wasHoldingSeat && !SEAT_HOLDING.includes(status)) this.releaseSeat(item.sessionId)
    },
    // Ne change le statut que depuis un statut de départ autorisé : approuver
    // une demande déjà refusée, ou refuser une demande déjà approuvée, est
    // ignoré au lieu d'écraser silencieusement la décision précédente.
    transition(id: string, from: EnrollmentStatus[], to: EnrollmentStatus) {
      const item = this.items.find(e => e.id === id)
      if (item && from.includes(item.status)) this.setStatus(id, to)
    },
    releaseSeat(sessionId: string) {
      const session = useSessionStore().items.find(s => s.id === sessionId)
      if (session) session.enrolledCount = Math.max(0, session.enrolledCount - 1)
    },
    cancelForSession(sessionId: string) {
      this.items
        .filter(e => e.sessionId === sessionId && (e.status === 'Requested' || e.status === 'Approved'))
        .forEach(e => this.setStatus(e.id, 'Cancelled'))
    },
    markAttended(id: string) {
      const item = this.items.find(e => e.id === id)
      if (item && item.status === 'Approved') { item.status = 'Attended'; item.attendanceSheetSigned = true }
    },
    // Évaluation à chaud : seulement une fois la présence enregistrée. Elle
    // programme l'évaluation à froid 3 mois plus tard.
    submitHotEvaluation(id: string, evaluation: EvaluationEntry) {
      const item = this.items.find(e => e.id === id)
      if (!item || item.status !== 'Attended' || !isValidScore(evaluation.score)) return
      item.hotEvaluation = evaluation
      const due = new Date(evaluation.date)
      due.setMonth(due.getMonth() + 3)
      item.coldEvaluationDueAt = due.toISOString().slice(0, 10)
    },
    submitColdEvaluation(id: string, evaluation: EvaluationEntry) {
      const item = this.items.find(e => e.id === id)
      if (!item || item.status !== 'Attended' || !item.hotEvaluation || !isValidScore(evaluation.score)) return
      item.coldEvaluation = evaluation
    },
  },
})

// ═══════════════════════════════════════════════════════════════
// Fournisseurs de formation
// ═══════════════════════════════════════════════════════════════
const MOCK_PROVIDERS: Provider[] = [
  {
    id: 'prov-1', name: 'Skillup Madagascar', contactName: 'Lova Randriamampianina',
    email: 'contact@skillup.mg', phone: '034 12 345 67', specialties: 'Bureautique, langues, e-learning',
    lastEvaluationScore: 4.2, lastEvaluationDate: '2025-12-05', nextEvaluationDueAt: '2026-12-01', status: 'active',
  },
  {
    id: 'prov-2', name: 'Cabinet RH Plus', contactName: 'Miora Rakotoson',
    email: 'miora@rhplus.mg', phone: '032 98 765 43', specialties: 'Leadership, gestion du changement',
    lastEvaluationScore: 3.8, lastEvaluationDate: '2025-12-03', nextEvaluationDueAt: '2026-12-01', status: 'active',
  },
  {
    id: 'prov-3', name: 'SST Formation', contactName: 'Dieudonné Rabe',
    email: 'contact@sstformation.mg', phone: '033 44 556 67', specialties: 'Hygiène, sécurité, environnement (HSE)',
    lastEvaluationScore: 4.6, lastEvaluationDate: '2025-12-08', nextEvaluationDueAt: '2026-12-01', status: 'active',
  },
  {
    id: 'prov-4', name: 'Formatis Consulting', contactName: 'Andry Rasolofomanana',
    email: 'andry@formatis.mg', phone: '034 77 889 90', specialties: 'Finance, comptabilité',
    status: 'inactive', nextEvaluationDueAt: '2026-12-01',
  },
]

export const useProviderStore = defineStore('training-providers', {
  state: () => ({ items: structuredClone(MOCK_PROVIDERS) as Provider[] }),
  actions: {
    create(payload: Omit<Provider, 'id' | 'status' | 'nextEvaluationDueAt'>) {
      const provider: Provider = { ...payload, id: uid('prov'), status: 'active', nextEvaluationDueAt: '2026-12-01' }
      this.items.unshift(provider)
      return provider
    },
    update(id: string, patch: Partial<Provider>) {
      const item = this.items.find(p => p.id === id)
      if (item) Object.assign(item, patch)
    },
    // Évaluation annuelle (relance automatique programmée début décembre,
    // voir Liste des besoins.xlsx "Formations et perfectionnement" #2).
    submitEvaluation(id: string, score: number) {
      if (!isValidScore(score)) return
      this.update(id, { lastEvaluationScore: score, lastEvaluationDate: new Date().toISOString().slice(0, 10) })
    },
    setStatus(id: string, status: ProviderStatus) { this.update(id, { status }) },
  },
})

// ═══════════════════════════════════════════════════════════════
// Budget formation
// ═══════════════════════════════════════════════════════════════
const MOCK_BUDGET: BudgetLine[] = [
  { id: 'bud-1', year: 2026, entityName: 'Direction Generale', courseTitle: 'Excel avancé pour la finance', allocated: 3500000, used: 2100000, requestStatus: 'Approved' },
  { id: 'bud-2', year: 2026, entityName: 'Direction Generale', courseTitle: 'Management d\'équipe pour nouveaux managers', allocated: 5000000, used: 0, requestStatus: 'Approved' },
  { id: 'bud-3', year: 2026, entityName: 'Direction Generale', courseTitle: 'Sécurité et gestes de premiers secours', allocated: 1800000, used: 1750000, requestStatus: 'Approved' },
  { id: 'bud-4', year: 2026, entityName: 'Direction Generale', courseTitle: 'Anglais professionnel, niveau intermédiaire', allocated: 4200000, used: 1400000, requestStatus: 'Approved' },
  { id: 'bud-5', year: 2027, entityName: 'Direction Generale', courseTitle: 'Certification Power BI', allocated: 6000000, used: 0, requestStatus: 'Pending', comment: 'Demande pour anticiper la migration des rapports RH.' },
]

export const useBudgetStore = defineStore('training-budget', {
  state: () => ({ items: structuredClone(MOCK_BUDGET) as BudgetLine[] }),
  getters: {
    totalAllocated: (state) => state.items.filter(b => b.requestStatus === 'Approved').reduce((s, b) => s + b.allocated, 0),
    totalUsed: (state) => state.items.filter(b => b.requestStatus === 'Approved').reduce((s, b) => s + b.used, 0),
  },
  actions: {
    requestBudget(payload: Omit<BudgetLine, 'id' | 'used' | 'requestStatus'>) {
      const line: BudgetLine = { ...payload, id: uid('bud'), used: 0, requestStatus: 'Pending' }
      this.items.unshift(line)
      return line
    },
    // Seule une demande en attente peut être décidée : approuver une demande
    // déjà refusée (ou l'inverse) est ignoré.
    approve(id: string) { this.decide(id, 'Approved') },
    reject(id: string) { this.decide(id, 'Rejected') },
    decide(id: string, requestStatus: BudgetRequestStatus) {
      if (this.items.find(b => b.id === id)?.requestStatus === 'Pending') this.setStatus(id, requestStatus)
    },
    setStatus(id: string, requestStatus: BudgetRequestStatus) {
      const item = this.items.find(b => b.id === id)
      if (item) item.requestStatus = requestStatus
    },
  },
})
