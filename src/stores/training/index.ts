/**
 * Stores Pinia du module Formation, branches sur le vrai backend
 * (endpoints /training/*). Les noms de stores, de getters et d'actions
 * reprennent ceux de l'ancienne version fictive pour limiter les changements
 * dans les ecrans ; les actions sont maintenant asynchrones, mettent a jour
 * `items` depuis la reponse du serveur et re-levent l'erreur axios en cas
 * d'echec (l'appelant affiche getApiErrorMessage). Les regles metier
 * (session complete, doublon d'inscription, transitions de statut, notes de
 * 0 a 5, codes de reference...) sont appliquees cote serveur.
 *
 * Le JSON du backend est en camelCase et identique aux types de ./types ; seuls
 * les datetimes de session (ISO UTC) sont convertis en chaine locale naive
 * `YYYY-MM-DDTHH:mm`, format attendu par les ecrans.
 */
import { defineStore } from 'pinia'
import { api } from '../../lib/api'
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

const pad = (n: number) => String(n).padStart(2, '0')

/** ISO UTC (ex. 2026-10-06T05:30:00.000Z) -> naive local `YYYY-MM-DDTHH:mm`. */
export function toLocalNaive(iso: string): string {
  if (!iso) return iso
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Naive local `YYYY-MM-DDTHH:mm` (formulaire) -> ISO UTC pour l'API. */
export function toIso(naive: string): string {
  return new Date(naive).toISOString()
}

function mapSession(s: TrainingSession): TrainingSession {
  return { ...s, scheduledAt: toLocalNaive(s.scheduledAt), endAt: toLocalNaive(s.endAt) }
}

function mapEnrollment(e: Enrollment): Enrollment {
  return { ...e, sessionScheduledAt: toLocalNaive(e.sessionScheduledAt) }
}

// Remplace la ligne existante (meme id) ou l'insere en tete de liste.
function upsert<T extends { id: string }>(list: T[], row: T): T {
  const i = list.findIndex(x => x.id === row.id)
  if (i >= 0) list[i] = row
  else list.unshift(row)
  return row
}

// ═══════════════════════════════════════════════════════════════
// Catalogue de formations
// ═══════════════════════════════════════════════════════════════
export type CourseInput = Pick<Course, 'title' | 'category' | 'description' | 'durationHours' | 'maxParticipants' | 'providerId' | 'budgetAllocated'>

export const useCourseStore = defineStore('training-courses', {
  state: () => ({ items: [] as Course[], loaded: false, loading: false }),
  getters: {
    inProgressCount: (state) => state.items.filter(c => c.status === 'InProgress').length,
    inPreparationCount: (state) => state.items.filter(c => c.status === 'InPreparation').length,
  },
  actions: {
    async fetchAll() {
      this.loading = true
      try {
        const { data } = await api.get<Course[]>('/training/courses')
        this.items = data
        this.loaded = true
      } finally {
        this.loading = false
      }
    },
    async create(payload: CourseInput) {
      const { data } = await api.post<Course>('/training/courses', payload)
      return upsert(this.items, data)
    },
    async update(id: string, patch: Partial<CourseInput & { status: CourseStatus }>) {
      const { data } = await api.patch<Course>(`/training/courses/${id}`, patch)
      return upsert(this.items, data)
    },
    setStatus(id: string, status: CourseStatus) {
      return this.update(id, { status })
    },
  },
})

// ═══════════════════════════════════════════════════════════════
// Sessions planifiees
// ═══════════════════════════════════════════════════════════════
export type SessionInput = Pick<TrainingSession, 'courseId' | 'scheduledAt' | 'endAt' | 'mode' | 'location' | 'meetingLink' | 'trainerName' | 'capacity'>

export const useSessionStore = defineStore('training-sessions', {
  state: () => ({ items: [] as TrainingSession[], loaded: false, loading: false }),
  getters: {
    upcoming: (state) => state.items.filter(s => s.status === 'Scheduled')
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)),
  },
  actions: {
    async fetchAll() {
      this.loading = true
      try {
        const { data } = await api.get<TrainingSession[]>('/training/sessions')
        this.items = data.map(mapSession)
        this.loaded = true
      } finally {
        this.loading = false
      }
    },
    // Les dates du formulaire (locales naives) partent en ISO UTC.
    async schedule(payload: SessionInput) {
      const { data } = await api.post<TrainingSession>('/training/sessions', {
        ...payload,
        scheduledAt: toIso(payload.scheduledAt),
        endAt: toIso(payload.endAt),
      })
      const row = upsert(this.items, mapSession(data))
      // sessionsCount du cours change cote serveur.
      await useCourseStore().fetchAll().catch(() => {})
      return row
    },
    async markDone(id: string) {
      const { data } = await api.post<TrainingSession>(`/training/sessions/${id}/done`)
      return upsert(this.items, mapSession(data))
    },
    // Annuler une session annule aussi ses inscriptions en cours cote serveur.
    async cancel(id: string) {
      const { data } = await api.post<TrainingSession>(`/training/sessions/${id}/cancel`)
      const row = upsert(this.items, mapSession(data))
      await useEnrollmentStore().fetchAll().catch(() => {})
      return row
    },
  },
})

// ═══════════════════════════════════════════════════════════════
// Inscriptions (couvre la demande de formation + la presence)
// ═══════════════════════════════════════════════════════════════
export const useEnrollmentStore = defineStore('training-enrollments', {
  state: () => ({ items: [] as Enrollment[], loaded: false, loading: false }),
  getters: {
    pendingRequests: (state) => state.items.filter(e => e.status === 'Requested'),
    coldEvalsDue: (state) => state.items.filter(e =>
      e.status === 'Attended' && e.hotEvaluation && !e.coldEvaluation && e.coldEvaluationDueAt
      && e.coldEvaluationDueAt <= new Date().toISOString().slice(0, 10)),
  },
  actions: {
    async fetchAll() {
      this.loading = true
      try {
        const { data } = await api.get<Enrollment[]>('/training/enrollments')
        this.items = data.map(mapEnrollment)
        this.loaded = true
      } finally {
        this.loading = false
      }
    },
    // Les compteurs de places de la session changent cote serveur apres une
    // demande, un refus ou une annulation : on recharge les sessions.
    async request(payload: { sessionId: string; employeeId: string }) {
      const { data } = await api.post<Enrollment>('/training/enrollments', payload)
      const row = upsert(this.items, mapEnrollment(data))
      await useSessionStore().fetchAll().catch(() => {})
      return row
    },
    async approve(id: string) { return this.act(id, 'approve') },
    async reject(id: string) {
      const row = await this.act(id, 'reject')
      await useSessionStore().fetchAll().catch(() => {})
      return row
    },
    async cancel(id: string) {
      const row = await this.act(id, 'cancel')
      await useSessionStore().fetchAll().catch(() => {})
      return row
    },
    async markAttended(id: string) { return this.act(id, 'attend') },
    // Le serveur programme l'evaluation a froid 3 mois apres l'evaluation a chaud.
    async submitHotEvaluation(id: string, evaluation: EvaluationEntry) {
      return this.act(id, 'hot-evaluation', evaluation)
    },
    async submitColdEvaluation(id: string, evaluation: EvaluationEntry) {
      return this.act(id, 'cold-evaluation', evaluation)
    },
    async act(id: string, action: string, body?: unknown) {
      const { data } = await api.post<Enrollment>(`/training/enrollments/${id}/${action}`, body)
      return upsert(this.items, mapEnrollment(data))
    },
  },
})

// ═══════════════════════════════════════════════════════════════
// Fournisseurs de formation
// ═══════════════════════════════════════════════════════════════
export type ProviderInput = Pick<Provider, 'name' | 'contactName' | 'email' | 'phone' | 'specialties'>

export const useProviderStore = defineStore('training-providers', {
  state: () => ({ items: [] as Provider[], loaded: false, loading: false }),
  actions: {
    async fetchAll() {
      this.loading = true
      try {
        const { data } = await api.get<Provider[]>('/training/providers')
        this.items = data
        this.loaded = true
      } finally {
        this.loading = false
      }
    },
    async create(payload: ProviderInput) {
      const { data } = await api.post<Provider>('/training/providers', payload)
      return upsert(this.items, data)
    },
    async update(id: string, patch: Partial<ProviderInput & { status: ProviderStatus }>) {
      const { data } = await api.patch<Provider>(`/training/providers/${id}`, patch)
      return upsert(this.items, data)
    },
    // Evaluation annuelle : la note (0 a 5) est validee par le serveur.
    async submitEvaluation(id: string, score: number) {
      const { data } = await api.post<Provider>(`/training/providers/${id}/evaluate`, { score })
      return upsert(this.items, data)
    },
    setStatus(id: string, status: ProviderStatus) { return this.update(id, { status }) },
  },
})

// ═══════════════════════════════════════════════════════════════
// Budget formation
// ═══════════════════════════════════════════════════════════════
export type BudgetInput = Pick<BudgetLine, 'year' | 'entityName' | 'courseTitle' | 'allocated' | 'comment'>

export const useBudgetStore = defineStore('training-budget', {
  state: () => ({ items: [] as BudgetLine[], loaded: false, loading: false }),
  getters: {
    totalAllocated: (state) => state.items.filter(b => b.requestStatus === 'Approved').reduce((s, b) => s + b.allocated, 0),
    totalUsed: (state) => state.items.filter(b => b.requestStatus === 'Approved').reduce((s, b) => s + b.used, 0),
  },
  actions: {
    async fetchAll() {
      this.loading = true
      try {
        const { data } = await api.get<BudgetLine[]>('/training/budget')
        this.items = data
        this.loaded = true
      } finally {
        this.loading = false
      }
    },
    async requestBudget(payload: BudgetInput) {
      const { data } = await api.post<BudgetLine>('/training/budget', payload)
      return upsert(this.items, data)
    },
    async approve(id: string) {
      const { data } = await api.post<BudgetLine>(`/training/budget/${id}/approve`)
      return upsert(this.items, data)
    },
    async reject(id: string) {
      const { data } = await api.post<BudgetLine>(`/training/budget/${id}/reject`)
      return upsert(this.items, data)
    },
  },
})
