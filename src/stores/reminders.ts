/**
 * Rappels des echeances a venir (backlog Administration). Branche sur
 * GET /reminders/upcoming (fins de CDD / stage / periode d'essai / contrat,
 * anniversaires) + POST /reminders/run-now (declenche la passe de
 * notifications, reservee EMPLOYE_VOIR_TOUT).
 */
import { defineStore } from 'pinia'
import { api, getApiErrorMessage } from '../lib/api'

export type DeadlineCategory =
  | 'cdd_end' | 'internship_end' | 'birthday' | 'trial_end' | 'contract_end'

export interface UpcomingDeadline {
  category: DeadlineCategory
  entityType: 'Employee' | 'TrialEmployee' | 'RecruitmentContract'
  entityId: string
  date: string
  daysUntil: number
  label: string
  subjectName: string
  employeeId?: string
  entityName?: string
  href: string
}

export const CATEGORY_LABELS: Record<DeadlineCategory, string> = {
  cdd_end: 'Fin de CDD',
  internship_end: 'Fin de stage',
  birthday: 'Anniversaire',
  trial_end: "Fin de periode d'essai",
  contract_end: 'Fin de contrat',
}

export const useRemindersStore = defineStore('reminders', {
  state: () => ({
    items: [] as UpcomingDeadline[],
    loading: false,
    error: null as string | null,
  }),
  actions: {
    async fetchUpcoming(from?: string, to?: string) {
      this.loading = true
      try {
        const params: Record<string, string> = {}
        if (from) params.From = from
        if (to) params.To = to
        const { data } = await api.get<UpcomingDeadline[]>('/reminders/upcoming', { params })
        this.items = data
        this.error = null
      } catch (e) {
        this.error = getApiErrorMessage(e, 'Chargement des echeances impossible')
        this.items = []
      } finally {
        this.loading = false
      }
    },
    async runNow() {
      const { data } = await api.post('/reminders/run-now')
      return data as {
        itemsInWindow: number
        notificationsCreated: number
        skippedAlreadySent: number
        purged: number
      }
    },
  },
})
