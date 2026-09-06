import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api, getApiErrorMessage } from '../lib/api'
import { withToast } from '../lib/withToast'

// Aligned on the backend LeaveType model (productive247-hrm-backend). `icon`
// has no backend column — it's a purely client-side display concept, kept
// via a static Code -> icon lookup so existing UI keeps working.
export interface LeaveTypeConfig {
  id:                string
  name:              string
  code:              string
  workflowType:      'Standard' | 'Medical'
  monthlyAccrual?:   boolean
  daysPerYear:       number
  daysPerMonth?:     number
  documentRequired:  boolean
  documentDeadlineDays?: number
  carryOverAllowed?: boolean
  carryOverCap?:     number
  noticeDays:        number
  color:             string
  isActive:          boolean
  isSystem:          boolean
  icon:              string
  // Ciblage d'eligibilite (demande client, 01/09) — absent/null sur un
  // critere = s'applique a tout le monde sur ce critere. Meme mecanisme que
  // sur Holiday (voir types/index.ts).
  appliesToGender?:     'M' | 'F' | null
  appliesToExpatriate?: boolean | null
  organizationUnitId?:  string | null
}

interface BackendLeaveType {
  Id: string
  Code: string
  Name: string
  WorkflowType: 'Standard' | 'Medical'
  MonthlyAccrual: boolean
  DaysPerYear: number
  DaysPerMonth: number | null
  DocumentRequired: boolean
  DocumentDeadlineDays: number | null
  CarryOverAllowed: boolean
  CarryOverCap: number
  MinNoticeDays: number
  Color: string
  IsActive: boolean
  IsSystem: boolean
  AppliesToGender: string | null
  AppliesToExpatriate: boolean | null
  OrganizationUnitId: string | null
}

const ICON_BY_CODE: Record<string, string> = {
  ANNUAL: 'ti-calendar',
  SICK: 'ti-stethoscope',
  MATERNITY: 'ti-heart',
  RECOVERY: 'ti-clock-hour-3',
  PARENTAL: 'ti-users',
  EXCEPTIONAL: 'ti-star',
  REMOTE: 'ti-home-2',
}
const DEFAULT_ICON = 'ti-calendar'

function mapLeaveType(raw: BackendLeaveType): LeaveTypeConfig {
  return {
    id: raw.Id,
    name: raw.Name,
    code: raw.Code,
    workflowType: raw.WorkflowType,
    monthlyAccrual: raw.MonthlyAccrual,
    daysPerYear: Number(raw.DaysPerYear),
    daysPerMonth: raw.DaysPerMonth != null ? Number(raw.DaysPerMonth) : undefined,
    documentRequired: raw.DocumentRequired,
    documentDeadlineDays: raw.DocumentDeadlineDays ?? undefined,
    carryOverAllowed: raw.CarryOverAllowed,
    carryOverCap: raw.CarryOverCap,
    noticeDays: raw.MinNoticeDays,
    color: raw.Color,
    isActive: raw.IsActive,
    isSystem: raw.IsSystem,
    icon: ICON_BY_CODE[raw.Code] ?? DEFAULT_ICON,
    appliesToGender: (raw.AppliesToGender as 'M' | 'F' | null) ?? undefined,
    appliesToExpatriate: raw.AppliesToExpatriate ?? undefined,
    organizationUnitId: raw.OrganizationUnitId ?? undefined,
  }
}

function toBackendPayload(payload: Partial<LeaveTypeConfig>) {
  const body: Record<string, unknown> = {}
  if (payload.code !== undefined) body.Code = payload.code
  if (payload.name !== undefined) body.Name = payload.name
  if (payload.workflowType !== undefined) body.WorkflowType = payload.workflowType
  if (payload.monthlyAccrual !== undefined) body.MonthlyAccrual = payload.monthlyAccrual
  if (payload.daysPerYear !== undefined) body.DaysPerYear = payload.daysPerYear
  if (payload.daysPerMonth !== undefined) body.DaysPerMonth = payload.daysPerMonth
  if (payload.documentRequired !== undefined) body.DocumentRequired = payload.documentRequired
  if (payload.documentDeadlineDays !== undefined) body.DocumentDeadlineDays = payload.documentDeadlineDays
  if (payload.carryOverAllowed !== undefined) body.CarryOverAllowed = payload.carryOverAllowed
  if (payload.carryOverCap !== undefined) body.CarryOverCap = payload.carryOverCap
  if (payload.noticeDays !== undefined) body.MinNoticeDays = payload.noticeDays
  if (payload.color !== undefined) body.Color = payload.color
  if (payload.isActive !== undefined) body.IsActive = payload.isActive
  if (payload.isSystem !== undefined) body.IsSystem = payload.isSystem
  if (payload.appliesToGender !== undefined) body.AppliesToGender = payload.appliesToGender
  if (payload.appliesToExpatriate !== undefined) body.AppliesToExpatriate = payload.appliesToExpatriate
  if (payload.organizationUnitId !== undefined) body.OrganizationUnitId = payload.organizationUnitId
  return body
}

export const useLeaveTypesStore = defineStore('leaveTypes', () => {
  const leaveTypes = ref<LeaveTypeConfig[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const activeTypes = computed(() => leaveTypes.value.filter(lt => lt.isActive))

  async function fetchAll() {
    loading.value = true
    error.value = null
    try {
      const { data } = await api.get<BackendLeaveType[]>('/leave-types')
      leaveTypes.value = data.map(mapLeaveType)
    } catch (err) {
      error.value = getApiErrorMessage(err, 'Impossible de charger les types de congé')
      throw err
    } finally {
      loading.value = false
    }
  }

  async function fetchActive() {
    loading.value = true
    error.value = null
    try {
      const { data } = await api.get<BackendLeaveType[]>('/leave-types/active')
      return data.map(mapLeaveType)
    } catch (err) {
      error.value = getApiErrorMessage(err, 'Impossible de charger les types de congé actifs')
      throw err
    } finally {
      loading.value = false
    }
  }

  // creditExistingEmployees : si vrai, le backend crédite immédiatement les
  // employés déjà actifs sur ce nouveau type (mois en cours si accumulation
  // mensuelle, année complète sinon) — voir LeaveTypeService.create côté
  // backend. Sans ça, ils ne recevraient ce type qu'à la prochaine
  // génération (cron ou clic manuel).
  async function addLeaveType(payload: Omit<LeaveTypeConfig, 'id' | 'icon'>, creditExistingEmployees = true) {
    error.value = null
    return withToast('Création du type de congé en cours…', async () => {
      try {
        const { data } = await api.post<BackendLeaveType>('/leave-types', {
          ...toBackendPayload(payload),
          CreditExistingEmployees: creditExistingEmployees,
        })
        const mapped = mapLeaveType(data)
        leaveTypes.value.push(mapped)
        return mapped
      } catch (err) {
        error.value = getApiErrorMessage(err, 'Impossible de créer le type de congé')
        throw err
      }
    }, () => error.value ?? 'Impossible de créer le type de congé')
  }

  async function updateLeaveType(id: string, payload: Partial<LeaveTypeConfig>) {
    error.value = null
    return withToast('Enregistrement en cours…', async () => {
      try {
        const { data } = await api.patch<BackendLeaveType>(`/leave-types/${id}`, toBackendPayload(payload))
        const mapped = mapLeaveType(data)
        const idx = leaveTypes.value.findIndex(lt => lt.id === id)
        if (idx !== -1) leaveTypes.value[idx] = mapped
        return mapped
      } catch (err) {
        error.value = getApiErrorMessage(err, 'Impossible de mettre à jour le type de congé')
        throw err
      }
    }, () => error.value ?? 'Impossible de mettre à jour le type de congé')
  }

  async function toggleLeaveType(id: string) {
    error.value = null
    return withToast('Mise à jour en cours…', async () => {
      try {
        const { data } = await api.patch<BackendLeaveType>(`/leave-types/${id}/toggle`)
        const mapped = mapLeaveType(data)
        const idx = leaveTypes.value.findIndex(lt => lt.id === id)
        if (idx !== -1) leaveTypes.value[idx] = mapped
        return mapped
      } catch (err) {
        error.value = getApiErrorMessage(err, "Impossible de changer le statut du type de congé")
        throw err
      }
    }, () => error.value ?? "Impossible de changer le statut du type de congé")
  }

  async function deleteLeaveType(id: string) {
    error.value = null
    return withToast('Suppression en cours…', async () => {
      try {
        await api.delete(`/leave-types/${id}`)
        leaveTypes.value = leaveTypes.value.filter(lt => lt.id !== id)
      } catch (err) {
        error.value = getApiErrorMessage(err, 'Impossible de supprimer le type de congé')
        throw err
      }
    }, () => error.value ?? 'Impossible de supprimer le type de congé')
  }

  return { leaveTypes, loading, error, activeTypes, fetchAll, fetchActive, addLeaveType, updateLeaveType, toggleLeaveType, deleteLeaveType }
})
