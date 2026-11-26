/**
 * Sites de travail du module Temps (/time/sites) : minutes de trajet et de
 * changement retirees de la presence sur site, et rattachement des employes.
 */
import { defineStore } from 'pinia'
import { api } from '../lib/api'

export interface TimeSite { id: string; code: string; name: string; deductionMinutes: number; employeeCount: number }
export interface SiteEmployee { id: string; name: string; code: string; isCadre: boolean; siteId: string | null; entityName: string }
export interface TimeSitePayload { Code: string; Name: string; DeductionMinutes: number }

/* eslint-disable @typescript-eslint/no-explicit-any */
export const useTimeSiteStore = defineStore('timeSites', {
  state: () => ({
    sites: [] as TimeSite[],
    nonCadresWithoutSite: 0,
  }),
  actions: {
    apply(data: any) {
      this.sites = data.Sites.map((s: any) => ({
        id: s.Id, code: s.Code, name: s.Name, deductionMinutes: s.DeductionMinutes, employeeCount: s.EmployeeCount,
      }))
      this.nonCadresWithoutSite = data.NonCadresWithoutSite
    },
    // La liste deja chargee reste affichee pendant la relecture.
    async fetchAll() {
      const { data } = await api.get('/time/sites')
      this.apply(data)
    },
    async fetchEmployees(): Promise<SiteEmployee[]> {
      const { data } = await api.get('/time/sites/employees')
      return data.map((e: any) => ({
        id: e.Id, name: e.FullName, code: e.EmployeeNumber, isCadre: e.IsCadre, siteId: e.TimeSiteId, entityName: e.EntityName ?? '',
      }))
    },
    async save(id: string | null, payload: TimeSitePayload): Promise<string> {
      const { data } = id ? await api.patch(`/time/sites/${id}`, payload) : await api.post('/time/sites', payload)
      await this.fetchAll()
      return data.Id
    },
    async setEmployees(id: string, employeeIds: string[]) {
      const { data } = await api.put(`/time/sites/${id}/employees`, { EmployeeIds: employeeIds })
      this.apply(data)
    },
    async remove(id: string) {
      await api.delete(`/time/sites/${id}`)
      await this.fetchAll()
    },
  },
})
