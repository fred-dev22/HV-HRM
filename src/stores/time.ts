/**
 * Module Temps de travail : import de la pointeuse, saisies de temps et leur
 * validation, calcul des heures supplementaires, export Sage, reglages.
 * Branche sur /time/* (backend, module 'time').
 */
import { defineStore } from 'pinia'
import { api, getApiErrorMessage } from '../lib/api'

export type TimeEntryType =
  | 'mission' | 'reunion_exterieure' | 'travail_hors_site' | 'travail_sur_site' | 'permanence' | 'panier'
export type TimeEntryStatus = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled'

export const ENTRY_TYPE_LABELS: Record<TimeEntryType, string> = {
  mission: 'Mission',
  reunion_exterieure: 'Réunion extérieure',
  travail_hors_site: 'Travail hors site',
  travail_sur_site: 'Travail sur site',
  permanence: 'Permanence',
  panier: 'Panier',
}

export const ENTRY_STATUS_LABELS: Record<TimeEntryStatus, string> = {
  Pending: 'En attente',
  Approved: 'Approuvée',
  Rejected: 'Refusée',
  Cancelled: 'Annulée',
}

export interface TimeEntry {
  id: string
  employeeId: string
  employeeName: string
  employeeNumber: string
  date: string
  hours: number
  entryType: TimeEntryType | null
  status: TimeEntryStatus
  rejectionReason: string | null
  comments: string | null
}

export interface MorphoConfig {
  folderPath: string
  cronSchedule: string
  isScheduleActive: boolean
}

export interface MorphoImport {
  id: string
  fileName: string
  importDate: string
  status: string
  triggeredBy: string
  totalRecords: number
  processedRecords: number
  errorCount: number
  errorDetails: string | null
}

export interface MorphoImportSummary {
  total: number
  imported: number
  skipped: number
  failed: number
  unmatchedRows: number
  details: { fileName: string; status: string; message?: string }[]
}

export interface TimeSetting { key: string; value: number; label: string }
export interface TimeCode { code: string; type: string; sageTypeCode: number | null }
export interface PermanenceRate { dayType: string; amount: number }

export interface OvertimeReport {
  period: { from: string; to: string }
  employees: {
    employeeId: string
    name: string
    employeeNumber: string
    totalsByCode: Record<string, number>
    lines: { date: string; code: string; type: string; hours: number }[]
  }[]
}

export interface SageRow { im: string; type: number; code: string; valeur: number }

export interface Timesheet {
  employee: { Id: string; FullName: string; EmployeeNumber: string }
  period: { from: string; to: string }
  summary: { required: number; worked: number; overtime: number; absence: number }
  days: { date: string; required: number; worked: number; overtime: number; absence: number; in: string | null; out: string | null }[]
}

// Le backend renvoie des lignes Prisma en PascalCase : on les met en forme ici.
/* eslint-disable @typescript-eslint/no-explicit-any */
const mapEntry = (r: any): TimeEntry => ({
  id: r.Id,
  employeeId: r.EmployeeId,
  employeeName: r.employee?.FullName ?? '',
  employeeNumber: r.employee?.EmployeeNumber ?? '',
  date: String(r.Date).slice(0, 10),
  hours: Number(r.Hours),
  entryType: r.EntryType,
  status: r.Status,
  rejectionReason: r.RejectionReason,
  comments: r.Comments,
})
const mapImport = (r: any): MorphoImport => ({
  id: r.Id,
  fileName: r.FileName,
  importDate: r.ImportDate,
  status: r.Status,
  triggeredBy: r.TriggeredBy,
  totalRecords: r.TotalRecords,
  processedRecords: r.ProcessedRecords,
  errorCount: r.ErrorCount,
  errorDetails: r.ErrorDetails,
})

export const useTimeStore = defineStore('time', {
  state: () => ({
    myEntries: [] as TimeEntry[],
    pending: [] as TimeEntry[],
    allEntries: [] as TimeEntry[],
    imports: [] as MorphoImport[],
    config: null as MorphoConfig | null,
    settings: [] as TimeSetting[],
    codes: [] as TimeCode[],
    rates: [] as PermanenceRate[],
    loading: false,
    error: null as string | null,
  }),
  actions: {
    async fetchMine(from?: string, to?: string) {
      this.loading = true
      try {
        const { data } = await api.get('/time/entries/mine', { params: { From: from, To: to, Limit: 200 } })
        this.myEntries = data.data.map(mapEntry)
        this.error = null
      } catch (e) {
        this.error = getApiErrorMessage(e, 'Chargement de vos saisies impossible')
      } finally {
        this.loading = false
      }
    },
    async create(payload: { Date: string; Hours: number; EntryType: TimeEntryType; Comments?: string; EmployeeId?: string }) {
      await api.post('/time/entries', payload)
    },
    async cancel(id: string) {
      await api.delete(`/time/entries/${id}`)
    },
    async fetchPending() {
      this.loading = true
      try {
        const { data } = await api.get('/time/entries/pending', { params: { Limit: 200 } })
        this.pending = data.data.map(mapEntry)
        this.error = null
      } catch (e) {
        this.error = getApiErrorMessage(e, 'Chargement des saisies à valider impossible')
      } finally {
        this.loading = false
      }
    },
    async approve(id: string, comment?: string) {
      await api.post(`/time/entries/${id}/approve`, { Comment: comment })
    },
    async reject(id: string, comment: string) {
      await api.post(`/time/entries/${id}/reject`, { Comment: comment })
    },
    async fetchAll(status?: string) {
      this.loading = true
      try {
        const { data } = await api.get('/time/entries', { params: { Status: status || undefined, Limit: 200 } })
        this.allEntries = data.data.map(mapEntry)
        this.error = null
      } catch (e) {
        this.error = getApiErrorMessage(e, 'Chargement des saisies impossible')
      } finally {
        this.loading = false
      }
    },
    async fetchTimesheet(from: string, to: string, employeeId?: string) {
      const { data } = await api.get<Timesheet>('/time/timesheet', { params: { From: from, To: to, EmployeeId: employeeId } })
      return data
    },

    // ── Administration ──
    async fetchConfig() {
      const { data } = await api.get('/time/morpho/config')
      this.config = { folderPath: data.FolderPath ?? '', cronSchedule: data.CronSchedule ?? '', isScheduleActive: !!data.IsScheduleActive }
    },
    async saveConfig(c: MorphoConfig) {
      await api.put('/time/morpho/config', {
        FolderPath: c.folderPath,
        CronSchedule: c.cronSchedule,
        IsScheduleActive: c.isScheduleActive,
      })
      await this.fetchConfig()
    },
    async fetchImports() {
      const { data } = await api.get('/time/morpho/imports', { params: { Limit: 30 } })
      this.imports = data.data.map(mapImport)
    },
    async importFolder() {
      const { data } = await api.post<MorphoImportSummary>('/time/morpho/import')
      await this.fetchImports()
      return data
    },
    async importFile(file: File) {
      const form = new FormData()
      form.append('file', file)
      const { data } = await api.post<MorphoImportSummary>('/time/morpho/import/upload', form)
      await this.fetchImports()
      return data
    },
    async rematch() {
      const { data } = await api.post<{ matched: number; stillUnmatched: number }>('/time/morpho/rematch')
      return data
    },
    async calculate(from: string, to: string, method: 'daily' | 'weekly') {
      const hours = await api.post('/time/calculation/daily-hours', { From: from, To: to })
      const overtime = await api.post('/time/calculation/overtime', { From: from, To: to, Method: method })
      return { hours: hours.data, overtime: overtime.data }
    },
    async fetchReport(from: string, to: string) {
      const { data } = await api.get<OvertimeReport>('/time/calculation/report', { params: { From: from, To: to } })
      return data
    },
    async fetchSage(from: string, to: string) {
      const { data } = await api.get<SageRow[]>('/time/calculation/sage-export', { params: { From: from, To: to } })
      return data
    },
    async downloadSageXlsx(from: string, to: string) {
      const res = await api.get('/time/calculation/sage-export.xlsx', { params: { From: from, To: to }, responseType: 'blob' })
      const url = URL.createObjectURL(res.data as Blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `export-sage-${from}-${to}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    },
    async fetchSettings() {
      const [s, c, r] = await Promise.all([
        api.get('/time/settings'),
        api.get('/time/settings/codes'),
        api.get('/time/settings/permanence-rates'),
      ])
      this.settings = s.data.map((x: any) => ({ key: x.Key, value: Number(x.Value), label: x.Label }))
      this.codes = c.data.flatMap((t: any) =>
        t.codes.map((k: any) => ({ code: k.Code, type: t.Name, sageTypeCode: t.SageTypeCode })),
      )
      this.rates = r.data.map((x: any) => ({ dayType: x.DayType, amount: Number(x.Amount) }))
    },
    async saveSetting(key: string, value: number) {
      await api.patch(`/time/settings/${key}`, { Value: value })
    },
  },
})
