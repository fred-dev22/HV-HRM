/**
 * Validation hebdomadaire des temps (GET/PUT/POST /time/weeks) : liste d'une
 * semaine, detail d'un employe, corrections, controle, validation, reouverture.
 */
import { defineStore } from 'pinia'
import { api } from '../lib/api'

export type WeekStatus = 'Open' | 'Controlled' | 'Validated'
export const WEEK_STATUS_LABELS: Record<WeekStatus, string> = { Open: 'À contrôler', Controlled: 'Contrôlée', Validated: 'Validée' }

export type PunchSource = 'Morpho' | 'Manual' | 'Import' | 'Corrected'
export interface WeekPunch { start: string | null; end: string | null; nextDay: boolean; source: PunchSource; pending: boolean }
export interface WeekDay {
  date: string
  schedule: string | null
  holiday: boolean
  leave: string | null
  punches: WeekPunch[]
  extraHours: number
  worked: number | null
  overtime: number
  panier: boolean
  permanence: boolean
  corrected: boolean
  incomplete: boolean
  pendingEntryIds: string[]
  // Minutes de trajet et de changement retirees ce jour.
  travelDeducted: number
}
export interface WeekTotals {
  worked: number; overtime: number; hs130: number; hs150: number; night: number; holiday: number; panier: number; permanenceAmount: number
}
export interface WeekDetail {
  employee: { id: string; name: string; code: string; service: string }
  weekStart: string
  weekEnd: string
  weekNumber: number
  status: WeekStatus
  isCadre: boolean
  controlledBy: string | null
  controlledAt: string | null
  validatedBy: string | null
  validatedAt: string | null
  site: { name: string; minutes: number } | null
  days: WeekDay[]
  totals: WeekTotals
  blockers: string[]
  canEdit: boolean
  canControl: boolean
  canValidate: boolean
  canReopen: boolean
  history: { action: string; actor: string | null; comment: string | null; createdAt: string }[]
}
export interface WeekRow {
  employeeId: string
  name: string
  code: string
  status: WeekStatus
  isCadre: boolean
  worked: number
  overtime: number
  incompleteDays: number
  pendingEntries: number
  corrected: boolean
}
export interface WeekList { weekStart: string; weekEnd: string; weekNumber: number; total: number; rows: WeekRow[] }
export interface WeekDayChange {
  Date: string
  Punches?: { Start?: string; End?: string; NextDay?: boolean }[]
  Panier?: boolean
  Permanence?: boolean
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const mapDetail = (d: any): WeekDetail => ({
  employee: { id: d.Employee.Id, name: d.Employee.FullName, code: d.Employee.EmployeeNumber, service: d.Employee.Service ?? '' },
  weekStart: d.WeekStart,
  weekEnd: d.WeekEnd,
  weekNumber: d.WeekNumber,
  status: d.Status,
  isCadre: d.IsCadre,
  controlledBy: d.ControlledBy,
  controlledAt: d.ControlledAt,
  validatedBy: d.ValidatedBy,
  validatedAt: d.ValidatedAt,
  site: d.Site ? { name: d.Site.name, minutes: d.Site.minutes } : null,
  days: d.Days,
  totals: d.Totals,
  blockers: d.Blockers,
  canEdit: d.CanEdit,
  canControl: d.CanControl,
  canValidate: d.CanValidate,
  canReopen: d.CanReopen,
  history: d.History.map((h: any) => ({ action: h.Action, actor: h.Actor, comment: h.Comment, createdAt: h.CreatedAt })),
})

export const useTimeWeekStore = defineStore('timeWeeks', {
  state: () => ({
    // Dernieres lectures, affichees tout de suite puis relues en silence.
    cache: {} as Record<string, unknown>,
  }),
  actions: {
    async fetchList(weekStart: string, params: { Search?: string; Page?: number; PageSize?: number }): Promise<WeekList> {
      const { data } = await api.get('/time/weeks', { params: { WeekStart: weekStart, ...params, Search: params.Search || undefined } })
      return {
        weekStart: data.WeekStart,
        weekEnd: data.WeekEnd,
        weekNumber: data.WeekNumber,
        total: data.Total,
        rows: data.Items.map((r: any) => ({
          employeeId: r.EmployeeId, name: r.FullName, code: r.EmployeeNumber, status: r.Status, isCadre: r.IsCadre,
          worked: r.Worked, overtime: r.Overtime, incompleteDays: r.IncompleteDays, pendingEntries: r.PendingEntries, corrected: r.Corrected,
        })),
      }
    },
    async fetchWeek(employeeId: string, weekStart: string): Promise<WeekDetail> {
      const { data } = await api.get(`/time/weeks/${employeeId}`, { params: { WeekStart: weekStart } })
      return mapDetail(data)
    },
    async saveDays(employeeId: string, weekStart: string, days: WeekDayChange[], comment?: string): Promise<WeekDetail> {
      const { data } = await api.put(`/time/weeks/${employeeId}/days`, { WeekStart: weekStart, Days: days, Comment: comment || undefined })
      this.cache = {}
      return mapDetail(data)
    },
    async act(employeeId: string, weekStart: string, action: 'control' | 'validate' | 'reopen', comment?: string): Promise<WeekDetail> {
      const { data } = await api.post(`/time/weeks/${employeeId}/${action}`, { WeekStart: weekStart, Comment: comment || undefined })
      this.cache = {}
      return mapDetail(data)
    },
  },
})
