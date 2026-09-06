import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api, getApiErrorMessage } from '../lib/api'
import { withToast } from '../lib/withToast'

export type ApprovalObjectType = 'Leave' | 'Mission' | 'ExpenseReport'

export interface ApprovalPoolMember {
  id:                 string
  approvalPoolId:     string
  stepOrder:          1 | 2 | 3 | 4
  employeeId:         string
  interimEmployeeId?: string
  interimStartDate?:  string
  interimEndDate?:    string
  isMandatory:        boolean
}

export interface ApprovalPool {
  id:                 string
  organizationUnitId: string
  objectType:         ApprovalObjectType
  name:               string
  isActive:           boolean
  members:            ApprovalPoolMember[]
}

interface BackendApprovalPoolMember {
  Id: string
  ApprovalPoolId: string
  StepOrder: number
  EmployeeId: string
  InterimEmployeeId: string | null
  InterimStartDate: string | null
  InterimEndDate: string | null
  IsMandatory: boolean
}

interface BackendApprovalPool {
  Id: string
  OrganizationUnitId: string
  ObjectType: ApprovalObjectType
  Name: string
  IsActive: boolean
  members?: BackendApprovalPoolMember[]
}

function mapMember(raw: BackendApprovalPoolMember): ApprovalPoolMember {
  return {
    id: raw.Id,
    approvalPoolId: raw.ApprovalPoolId,
    stepOrder: raw.StepOrder as 1 | 2 | 3 | 4,
    employeeId: raw.EmployeeId,
    interimEmployeeId: raw.InterimEmployeeId ?? undefined,
    interimStartDate: raw.InterimStartDate ?? undefined,
    interimEndDate: raw.InterimEndDate ?? undefined,
    isMandatory: raw.IsMandatory,
  }
}

function mapPool(raw: BackendApprovalPool): ApprovalPool {
  return {
    id: raw.Id,
    organizationUnitId: raw.OrganizationUnitId,
    objectType: raw.ObjectType,
    name: raw.Name,
    isActive: raw.IsActive,
    members: (raw.members ?? []).map(mapMember),
  }
}

export const useApprovalPoolStore = defineStore('approvalPools', () => {
  // Pools de l'entité actuellement affichée (fiche entité) — pas une liste
  // globale, ce domaine se consulte toujours dans le contexte d'une entité.
  const pools = ref<ApprovalPool[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchByUnit(unitId: string) {
    loading.value = true
    error.value = null
    try {
      const { data } = await api.get<BackendApprovalPool[]>(`/approval-pools/by-unit/${unitId}`)
      pools.value = data.map(mapPool)
    } catch (err) {
      error.value = getApiErrorMessage(err, 'Impossible de charger les pools de validation')
      throw err
    } finally {
      loading.value = false
    }
  }

  function poolFor(objectType: ApprovalObjectType): ApprovalPool | undefined {
    return pools.value.find(p => p.objectType === objectType)
  }

  async function createPool(organizationUnitId: string, objectType: ApprovalObjectType, name: string) {
    error.value = null
    return withToast('Création du pool en cours…', async () => {
      try {
        const { data } = await api.post<BackendApprovalPool>('/approval-pools', {
          OrganizationUnitId: organizationUnitId, ObjectType: objectType, Name: name, IsActive: true,
        })
        const mapped = mapPool(data)
        pools.value.push(mapped)
        return mapped
      } catch (err) {
        error.value = getApiErrorMessage(err, 'Impossible de créer le pool de validation')
        throw err
      }
    }, () => error.value ?? 'Impossible de créer le pool de validation')
  }

  async function deletePool(id: string) {
    error.value = null
    return withToast('Suppression en cours…', async () => {
      try {
        await api.delete(`/approval-pools/${id}`)
        pools.value = pools.value.filter(p => p.id !== id)
      } catch (err) {
        error.value = getApiErrorMessage(err, 'Impossible de supprimer le pool de validation')
        throw err
      }
    }, () => error.value ?? 'Impossible de supprimer le pool de validation')
  }

  async function addMember(payload: { approvalPoolId: string; stepOrder: number; employeeId: string; isMandatory?: boolean }) {
    error.value = null
    return withToast('Ajout du validateur en cours…', async () => {
      try {
        const { data } = await api.post<BackendApprovalPoolMember>('/approval-pool-members', {
          ApprovalPoolId: payload.approvalPoolId,
          StepOrder: payload.stepOrder,
          EmployeeId: payload.employeeId,
          IsMandatory: payload.isMandatory ?? true,
        })
        const mapped = mapMember(data)
        const pool = pools.value.find(p => p.id === payload.approvalPoolId)
        if (pool) pool.members.push(mapped)
        return mapped
      } catch (err) {
        error.value = getApiErrorMessage(err, "Impossible d'ajouter ce validateur")
        throw err
      }
    }, () => error.value ?? "Impossible d'ajouter ce validateur")
  }

  async function updateMember(id: string, payload: Partial<Pick<ApprovalPoolMember, 'employeeId' | 'interimEmployeeId' | 'interimStartDate' | 'interimEndDate' | 'isMandatory'>>) {
    error.value = null
    return withToast('Enregistrement en cours…', async () => {
      try {
        const body: Record<string, unknown> = {}
        if (payload.employeeId !== undefined) body.EmployeeId = payload.employeeId
        if (payload.interimEmployeeId !== undefined) body.InterimEmployeeId = payload.interimEmployeeId || null
        if (payload.interimStartDate !== undefined) body.InterimStartDate = payload.interimStartDate || null
        if (payload.interimEndDate !== undefined) body.InterimEndDate = payload.interimEndDate || null
        if (payload.isMandatory !== undefined) body.IsMandatory = payload.isMandatory
        const { data } = await api.patch<BackendApprovalPoolMember>(`/approval-pool-members/${id}`, body)
        const mapped = mapMember(data)
        const pool = pools.value.find(p => p.id === mapped.approvalPoolId)
        if (pool) {
          const idx = pool.members.findIndex(m => m.id === id)
          if (idx !== -1) pool.members[idx] = mapped
        }
        return mapped
      } catch (err) {
        error.value = getApiErrorMessage(err, 'Impossible de mettre à jour ce validateur')
        throw err
      }
    }, () => error.value ?? 'Impossible de mettre à jour ce validateur')
  }

  async function removeMember(id: string) {
    error.value = null
    return withToast('Suppression en cours…', async () => {
      try {
        await api.delete(`/approval-pool-members/${id}`)
        for (const pool of pools.value) {
          pool.members = pool.members.filter(m => m.id !== id)
        }
      } catch (err) {
        error.value = getApiErrorMessage(err, 'Impossible de supprimer ce validateur')
        throw err
      }
    }, () => error.value ?? 'Impossible de supprimer ce validateur')
  }

  return {
    pools, loading, error,
    fetchByUnit, poolFor, createPool, deletePool, addMember, updateMember, removeMember,
  }
})
