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
  // Heure de debut / de fin saisies (ISO), null si seule la duree a ete declaree.
  clockIn: string | null
  clockOut: string | null
  submittedByName: string
  validatedByName: string | null
  createdAt: string
}

export interface TimeEntryHistoryItem { id: string; action: string; actorId: string; comment: string | null; createdAt: string }

export interface TimeEntryQuery {
  Status?: string
  EntryType?: string
  From?: string
  To?: string
  Search?: string
  Page?: number
  Limit?: number
}
export interface TimeEntryPage { items: TimeEntry[]; total: number; hours: number }
export interface TimeEntriesSummary { total: number; pending: number; approved: number; rejected: number; cancelled: number; hours: number }

export interface TimeTypeCode { id: string; code: string; description: string | null; locked: boolean }
export interface TimeType { id: string; name: string; description: string | null; sageTypeCode: number | null; codes: TimeTypeCode[] }

export interface TimesheetRow {
  employeeId: string
  employeeNumber: string
  name: string
  required: number
  worked: number
  overtime: number
  absence: number
  paidOvertime: number
  presenceRate: number | null
}
export interface TimesheetSummary {
  items: TimesheetRow[]
  total: number
  meta: { period: { from: string; to: string }; totals: { required: number; worked: number; overtime: number; absence: number; paidOvertime: number } }
}

export interface UnmatchedPerson {
  biometricUuid: string
  firstName: string
  lastName: string
  employeeNumber: string
  records: number
  from: string
  to: string
}

export interface FolderListing {
  path: string
  parent: string | null
  folders: { name: string; path: string }[]
  xlsxCount: number
  shortcuts: { name: string; path: string }[]
  // Zone autorisee par l'installation (MORPHO_ROOT) ; null = tout le serveur.
  root: string | null
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
  clockIn: r.FirstClockIn ?? null,
  clockOut: r.LastClockOut ?? null,
  submittedByName: r.submittedBy?.FullName ?? '',
  validatedByName: r.validatedBy?.FullName ?? null,
  createdAt: r.CreatedAt,
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
    loadedFetches: [] as string[],
    // Dernieres lectures des ecrans (page, filtres...), par cle : affichees tout de suite au
    // retour sur un onglet, puis relues en silence. Videe a chaque modification de saisie.
    viewCache: {} as Record<string, unknown>,
    error: null as string | null,
  }),
  actions: {
    getCached<T>(key: string): T | undefined {
      return this.viewCache[key] as T | undefined
    },
    setCached(key: string, value: unknown) {
      this.viewCache[key] = value
    },
    async fetchMine(from?: string, to?: string) {
      this.loading = !this.loadedFetches.includes('fetchMine')
      try {
        const { data } = await api.get('/time/entries/mine', { params: { From: from, To: to, Limit: 200 } })
        this.myEntries = data.data.map(mapEntry)
        if (!this.loadedFetches.includes('fetchMine')) this.loadedFetches.push('fetchMine')
        this.error = null
      } catch (e) {
        this.error = getApiErrorMessage(e, 'Chargement de vos saisies impossible')
      } finally {
        this.loading = false
      }
    },
    // Une page de saisies. kind : mine (les miennes), all (RH), pending (a valider), processed (traitees).
    async fetchEntriesPage(kind: 'mine' | 'all' | 'pending' | 'processed', q: TimeEntryQuery): Promise<TimeEntryPage> {
      const path = kind === 'all' ? '/time/entries' : `/time/entries/${kind}`
      const clean = Object.fromEntries(Object.entries(q).filter(([, v]) => v !== '' && v !== undefined && v !== null))
      const { data } = await api.get(path, { params: clean })
      return { items: data.data.map(mapEntry), total: data.total, hours: Number(data.hours ?? 0) }
    },
    // Compteurs du bandeau "Resume" : calcules en base sur toutes les saisies du perimetre.
    async fetchEntriesSummary(q: TimeEntryQuery): Promise<TimeEntriesSummary> {
      const clean = Object.fromEntries(Object.entries(q).filter(([k, v]) => k !== 'Page' && k !== 'Limit' && k !== 'Status' && v !== '' && v !== undefined))
      const { data } = await api.get<TimeEntriesSummary>('/time/entries/summary', { params: clean })
      return data
    },
    async create(payload: { Date: string; EntryType: TimeEntryType; Hours?: number; StartTime?: string; EndTime?: string; Comments?: string; EmployeeId?: string }) {
      await api.post('/time/entries', payload)
      this.viewCache = {}
    },
    async updateEntry(id: string, payload: { Date?: string; EntryType?: TimeEntryType; Hours?: number; StartTime?: string; EndTime?: string; Comments?: string }) {
      await api.patch(`/time/entries/${id}`, payload)
      this.viewCache = {}
    },
    // Le validateur courant ajuste les heures (la saisie reste en attente).
    async adjustEntry(id: string, payload: { Hours?: number; StartTime?: string; EndTime?: string; Comment?: string }) {
      await api.patch(`/time/entries/${id}/adjust`, payload)
      this.viewCache = {}
    },
    async fetchHistory(id: string): Promise<TimeEntryHistoryItem[]> {
      const { data } = await api.get(`/time/entries/${id}/history`)
      return data.map((h: any) => ({ id: h.Id, action: h.Action, actorId: h.ActorId, comment: h.Comment, createdAt: h.CreatedAt }))
    },
    async cancel(id: string) {
      await api.delete(`/time/entries/${id}`)
      this.viewCache = {}
    },
    async fetchPending() {
      this.loading = !this.loadedFetches.includes('fetchPending')
      try {
        const { data } = await api.get('/time/entries/pending', { params: { Limit: 200 } })
        this.pending = data.data.map(mapEntry)
        if (!this.loadedFetches.includes('fetchPending')) this.loadedFetches.push('fetchPending')
        this.error = null
      } catch (e) {
        this.error = getApiErrorMessage(e, 'Chargement des saisies à valider impossible')
      } finally {
        this.loading = false
      }
    },
    async approve(id: string, comment?: string) {
      await api.post(`/time/entries/${id}/approve`, { Comment: comment })
      this.viewCache = {}
    },
    async reject(id: string, comment: string) {
      await api.post(`/time/entries/${id}/reject`, { Comment: comment })
      this.viewCache = {}
    },
    async fetchAll(status?: string) {
      this.loading = !this.loadedFetches.includes('fetchAll')
      try {
        const { data } = await api.get('/time/entries', { params: { Status: status || undefined, Limit: 200 } })
        this.allEntries = data.data.map(mapEntry)
        if (!this.loadedFetches.includes('fetchAll')) this.loadedFetches.push('fetchAll')
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
    // Dossiers du serveur (choix du dossier d'import) ; chemin vide = lecteurs.
    async browseFolder(path: string): Promise<FolderListing> {
      const { data } = await api.get<FolderListing>('/time/morpho/browse', { params: { path: path || undefined } })
      return data
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
    // Personnes de la pointeuse dont les pointages sont restes sans employe.
    async fetchUnmatchedPeople() {
      const { data } = await api.get<UnmatchedPerson[]>('/time/morpho/unmatched-people')
      return data
    },
    // Associe une personne de la pointeuse a un employe, puis rattache ses pointages.
    async linkPerson(biometricUuid: string, employeeId: string) {
      const { data } = await api.post<{ matched: number; stillUnmatched: number }>('/time/morpho/link', { BiometricUuid: biometricUuid, EmployeeId: employeeId })
      return data
    },
    // Calcul T4 : heures travaillees et prevues de chaque jour de la periode.
    async calculateDaily(from: string, to: string) {
      const { data } = await api.post<{ calculated: number; skipped: number }>('/time/calculation/daily-hours', { From: from, To: to })
      return data
    },
    // Calcul T5 : heures supplementaires, panier et permanence (lignes de paie).
    async calculateOvertime(from: string, to: string, method?: 'daily' | 'weekly') {
      const { data } = await api.post<{ calculated: number; excludedCadres: number; method: 'daily' | 'weekly' }>('/time/calculation/overtime', { From: from, To: to, Method: method })
      return data
    },
    async calculate(from: string, to: string, method: 'daily' | 'weekly') {
      const hours = await api.post('/time/calculation/daily-hours', { From: from, To: to })
      const overtime = await api.post('/time/calculation/overtime', { From: from, To: to, Method: method })
      return { hours: hours.data, overtime: overtime.data }
    },
    async fetchCalculationStatus(from: string, to: string) {
      const { data } = await api.get<{ dailyRows: number; overtimeRows: number }>('/time/calculation/status', { params: { From: from, To: to } })
      return data
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

    // ── Types et codes de presence, tarifs ──
    async fetchTypes(): Promise<TimeType[]> {
      const { data } = await api.get<TimeType[]>('/time/settings/types')
      return data
    },
    async updateType(id: string, payload: { Name?: string; Description?: string; SageTypeCode?: number }) {
      await api.patch(`/time/settings/types/${id}`, payload)
    },
    async updateCode(id: string, payload: { Code?: string; Description?: string }) {
      await api.patch(`/time/settings/codes/${id}`, payload)
    },
    async deleteCode(id: string) {
      await api.delete(`/time/settings/codes/${id}`)
    },
    async saveRate(dayType: string, amount: number) {
      await api.patch(`/time/settings/permanence-rates/${dayType}`, { Amount: amount })
    },

    // ── Feuilles de temps de plusieurs employes ──
    async fetchTimesheetSummary(kind: 'global' | 'team', q: { From: string; To: string; Search?: string; Page?: number; PageSize?: number }): Promise<TimesheetSummary> {
      const clean = Object.fromEntries(Object.entries(q).filter(([, v]) => v !== '' && v !== undefined))
      const { data } = await api.get<TimesheetSummary>(`/time/timesheet/${kind}`, { params: clean })
      return data
    },
  },
})
