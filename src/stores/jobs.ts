import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api, getApiErrorMessage } from '../lib/api'
import { withToast } from '../lib/withToast'

export interface Job {
  id:            string
  code:          string
  title:         string
  description?:  string
  isActive:      boolean
}

interface BackendJob {
  Id: string
  Code: string
  Title: string
  Description: string | null
  IsActive: boolean
}

function mapJob(raw: BackendJob): Job {
  return {
    id: raw.Id,
    code: raw.Code,
    title: raw.Title,
    description: raw.Description ?? undefined,
    isActive: raw.IsActive,
  }
}

function toBackendPayload(payload: Partial<Job>) {
  const body: Record<string, unknown> = {}
  if (payload.code !== undefined) body.Code = payload.code
  if (payload.title !== undefined) body.Title = payload.title
  if (payload.description !== undefined) body.Description = payload.description
  if (payload.isActive !== undefined) body.IsActive = payload.isActive
  return body
}

export const useJobStore = defineStore('jobs', () => {
  const jobs = ref<Job[]>([])
  const loading = ref(false)
  const error   = ref<string | null>(null)

  async function fetchAll() {
    loading.value = true
    error.value = null
    try {
      const { data } = await api.get<BackendJob[]>('/jobs')
      jobs.value = data.map(mapJob)
    } catch (err) {
      error.value = getApiErrorMessage(err, 'Impossible de charger les métiers')
      throw err
    } finally {
      loading.value = false
    }
  }

  async function fetchActive() {
    loading.value = true
    error.value = null
    try {
      const { data } = await api.get<BackendJob[]>('/jobs/active')
      return data.map(mapJob)
    } catch (err) {
      error.value = getApiErrorMessage(err, 'Impossible de charger les métiers actifs')
      throw err
    } finally {
      loading.value = false
    }
  }

  async function createJob(payload: Omit<Job, 'id'>) {
    error.value = null
    return withToast('Création du métier en cours…', async () => {
      try {
        const { data } = await api.post<BackendJob>('/jobs', toBackendPayload(payload))
        const mapped = mapJob(data)
        jobs.value.push(mapped)
        return mapped
      } catch (err) {
        error.value = getApiErrorMessage(err, 'Impossible de créer le métier')
        throw err
      }
    }, () => error.value ?? 'Impossible de créer le métier')
  }

  async function updateJob(id: string, payload: Partial<Job>) {
    error.value = null
    return withToast('Enregistrement en cours…', async () => {
      try {
        const { data } = await api.patch<BackendJob>(`/jobs/${id}`, toBackendPayload(payload))
        const mapped = mapJob(data)
        const idx = jobs.value.findIndex(j => j.id === id)
        if (idx !== -1) jobs.value[idx] = mapped
        return mapped
      } catch (err) {
        error.value = getApiErrorMessage(err, 'Impossible de mettre à jour le métier')
        throw err
      }
    }, () => error.value ?? 'Impossible de mettre à jour le métier')
  }

  async function deleteJob(id: string) {
    error.value = null
    return withToast('Suppression en cours…', async () => {
      try {
        await api.delete(`/jobs/${id}`)
        jobs.value = jobs.value.filter(j => j.id !== id)
      } catch (err) {
        error.value = getApiErrorMessage(err, 'Impossible de supprimer le métier')
        throw err
      }
    }, () => error.value ?? 'Impossible de supprimer le métier')
  }

  return { jobs, loading, error, fetchAll, fetchActive, createJob, updateJob, deleteJob }
})
