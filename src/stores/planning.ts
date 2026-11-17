/**
 * Planning global (grille collaborateurs x jours). Une seule route,
 * GET /planning/global : le serveur decide de la portee (all | team | public)
 * selon les permissions de l'appelant et ne renvoie que ce qui est autorise.
 */
import { defineStore } from 'pinia'
import { api, getApiErrorMessage } from '../lib/api'

export type PlanningScope = 'all' | 'team' | 'public'

export interface PlanningEmployee {
  id: string
  name: string
  unit: string | null
  position: string | null
}

export interface PlanningLeave {
  employeeId: string
  start: string
  end: string
  startPeriod: string
  endPeriod: string
  // Absents de la vue publique : pas de motif ni de couleur.
  typeName?: string
  color?: string
  pending?: boolean
}

export interface PlanningTimeEntry {
  employeeId: string
  date: string
  entryType: string | null
  hours: number
}

export interface PlanningMilestone {
  employeeId: string
  date: string
  category: string
  label: string
}

export interface PlanningData {
  scope: PlanningScope
  from: string
  to: string
  employees: PlanningEmployee[]
  truncated: boolean
  leaves: PlanningLeave[]
  timeEntries: PlanningTimeEntry[]
  milestones: PlanningMilestone[]
}

// Meme regle que le serveur (planning-scope.ts) : sert a choisir l'entree de
// menu et le titre avant meme d'avoir la reponse. Le serveur reste maitre.
export function planningScopeFor(hasAny: (codes: string[]) => boolean): PlanningScope {
  if (hasAny(['CONGE_VOIR_TOUT', 'EMPLOYE_VOIR_TOUT'])) return 'all'
  if (hasAny(['CONGE_VOIR_EQUIPE', 'EMPLOYE_VOIR_EQUIPE'])) return 'team'
  return 'public'
}

export const usePlanningStore = defineStore('planning', {
  state: () => ({
    data: null as PlanningData | null,
    loading: false,
    error: null as string | null,
    // Fenetres deja chargees : le loader n'apparait qu'au premier chargement
    // d'une fenetre, les relectures (temps reel, retour sur la page) sont silencieuses.
    loadedKeys: [] as string[],
  }),
  actions: {
    async fetch(from: string, to: string) {
      const key = `${from}|${to}`
      this.loading = !this.loadedKeys.includes(key)
      try {
        const { data } = await api.get<PlanningData>('/planning/global', { params: { From: from, To: to } })
        this.data = data
        this.error = null
        if (!this.loadedKeys.includes(key)) this.loadedKeys.push(key)
      } catch (e) {
        this.error = getApiErrorMessage(e, 'Impossible de charger le planning.')
      } finally {
        this.loading = false
      }
    },
  },
})
