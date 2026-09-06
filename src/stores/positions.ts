import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api, getApiErrorMessage } from '../lib/api'
import { withToast } from '../lib/withToast'

export interface Position {
  id:                  string
  code:                string
  title:               string
  jobId:               string
  // Optionnel : un poste n'est plus necessairement rattache a une entite
  // precise — c'est l'employe qui l'est (Employee.organizationUnitId).
  organizationUnitId?: string
  parentPositionId?:   string | null
  // Nombre de sieges ouverts sur ce poste (voir decision du 30/07) — un
  // poste est un "type de poste avec N ouvertures", pas un siege unique.
  capacity:            number
  // Calcule cote backend (jamais envoye dans un payload) — nombre d'employés
  // actuellement affectés à ce poste.
  occupiedCount:       number
}

interface BackendPosition {
  Id: string
  Code: string
  Title: string
  JobId: string
  OrganizationUnitId: string | null
  ParentPositionId: string | null
  Capacity: number
  OccupiedCount: number
}

function mapPosition(raw: BackendPosition): Position {
  return {
    id: raw.Id,
    code: raw.Code,
    title: raw.Title,
    jobId: raw.JobId,
    organizationUnitId: raw.OrganizationUnitId ?? undefined,
    parentPositionId: raw.ParentPositionId,
    capacity: raw.Capacity,
    occupiedCount: raw.OccupiedCount,
  }
}

function toBackendPayload(payload: Partial<Position>) {
  const body: Record<string, unknown> = {}
  if (payload.code !== undefined) body.Code = payload.code
  if (payload.title !== undefined) body.Title = payload.title
  if (payload.jobId !== undefined) body.JobId = payload.jobId
  if (payload.organizationUnitId !== undefined) body.OrganizationUnitId = payload.organizationUnitId
  if (payload.parentPositionId !== undefined) body.ParentPositionId = payload.parentPositionId
  if (payload.capacity !== undefined) body.Capacity = payload.capacity
  return body
}

export const usePositionStore = defineStore('positions', () => {
  const positions = ref<Position[]>([])
  const loading = ref(false)
  const error   = ref<string | null>(null)

  async function fetchAll() {
    loading.value = true
    error.value = null
    try {
      const { data } = await api.get<BackendPosition[]>('/positions')
      positions.value = data.map(mapPosition)
    } catch (err) {
      error.value = getApiErrorMessage(err, 'Impossible de charger les postes')
      throw err
    } finally {
      loading.value = false
    }
  }

  async function fetchByUnit(unitId: string) {
    loading.value = true
    error.value = null
    try {
      const { data } = await api.get<BackendPosition[]>(`/positions/by-unit/${unitId}`)
      return data.map(mapPosition)
    } catch (err) {
      error.value = getApiErrorMessage(err, "Impossible de charger les postes de cette unité")
      throw err
    } finally {
      loading.value = false
    }
  }

  // Postes ayant encore au moins un siège libre (Capacity > sièges occupés).
  async function fetchAvailable() {
    loading.value = true
    error.value = null
    try {
      const { data } = await api.get<BackendPosition[]>('/positions/available')
      return data.map(mapPosition)
    } catch (err) {
      error.value = getApiErrorMessage(err, 'Impossible de charger les postes disponibles')
      throw err
    } finally {
      loading.value = false
    }
  }

  async function createPosition(payload: Omit<Position, 'id' | 'occupiedCount'>) {
    error.value = null
    return withToast('Création du poste en cours…', async () => {
      try {
        const { data } = await api.post<BackendPosition>('/positions', toBackendPayload(payload))
        const mapped = mapPosition(data)
        positions.value.push(mapped)
        return mapped
      } catch (err) {
        error.value = getApiErrorMessage(err, 'Impossible de créer le poste')
        throw err
      }
    }, () => error.value ?? 'Impossible de créer le poste')
  }

  async function updatePosition(id: string, payload: Partial<Position>) {
    error.value = null
    return withToast('Enregistrement en cours…', async () => {
      try {
        const { data } = await api.patch<BackendPosition>(`/positions/${id}`, toBackendPayload(payload))
        const mapped = mapPosition(data)
        const idx = positions.value.findIndex(p => p.id === id)
        if (idx !== -1) positions.value[idx] = mapped
        return mapped
      } catch (err) {
        error.value = getApiErrorMessage(err, 'Impossible de mettre à jour le poste')
        throw err
      }
    }, () => error.value ?? 'Impossible de mettre à jour le poste')
  }

  async function deletePosition(id: string) {
    error.value = null
    return withToast('Suppression en cours…', async () => {
      try {
        await api.delete(`/positions/${id}`)
        positions.value = positions.value.filter(p => p.id !== id)
      } catch (err) {
        error.value = getApiErrorMessage(err, 'Impossible de supprimer le poste')
        throw err
      }
    }, () => error.value ?? 'Impossible de supprimer le poste')
  }

  return {
    positions, loading, error,
    fetchAll, fetchByUnit, fetchAvailable,
    createPosition, updatePosition, deletePosition,
  }
})
