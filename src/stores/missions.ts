import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api, getApiErrorMessage } from '../lib/api'
import { withToast } from '../lib/withToast'
import type {
  MissionOrder, MissionStatus, MissionCategory, TransportMode,
  MissionAllowanceLine, MissionExpenseLine, LinkedMissionSummary, ValidationStep,
} from '../types'

// ── Backend <-> frontend mapping ────────────────────────────────
interface BackendEmployeeRef { Id: string; FullName: string; EmployeeNumber?: string; EmployeeCategoryId?: string | null }
interface BackendExpenseTypeRef { Id: string; Name: string }
interface BackendMissionExpenseLine {
  Id: string
  ExpenseTypeId: string
  Description: string | null
  Amount: string | number
  expenseType?: BackendExpenseTypeRef
}
interface BackendDecision {
  Id: string
  StepOrder: number
  Decision: 'Pending' | 'Approved' | 'Rejected' | 'Returned'
  Comment: string | null
  DecidedAt: string | null
  CreatedAt: string
  validatedByEmployee?: BackendEmployeeRef
}
interface BackendAllowanceLine {
  expenseTypeId: string
  expenseTypeName: string
  unit: 'PerDay' | 'PerTrip' | 'PerItem'
  rate: number
  days: number
  amount: number
  currency: string
  documentRequired: boolean
}
interface BackendMissionOrder {
  Id: string
  ReferenceCode: string
  EmployeeId: string
  Destination: string
  MissionCategory: string
  Purpose: string
  DepartureDate: string
  ReturnDate: string
  DaysCount: string | number
  TransportModeGo: string
  TransportModeReturn: string
  AdvanceRequested: string | number
  Currency: string
  Status: string
  ApprovalPoolId: string | null
  CurrentApprovalStep: number | null
  RejectionReason: string | null
  CreatedAt: string
  ModifiedAt?: string | null
  employee?: BackendEmployeeRef
  createdByEmployee?: BackendEmployeeRef
  EstimatedTotal?: number
  decisions?: BackendDecision[]
  allowance?: { lines: BackendAllowanceLine[]; total: number }
  missionExpenseLines?: BackendMissionExpenseLine[]
  linkedMissionOrder?: { Id: string; ReferenceCode: string; Destination: string; Status: string; employee?: BackendEmployeeRef } | null
}

function initialsFromFullName(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase()
}

const STEP_LEVEL: Record<number, ValidationStep['level']> = { 1: 'n1', 2: 'n2', 3: 'n3', 4: 'n4' }
const DECISION_ACTION: Record<string, ValidationStep['action']> = {
  Pending: 'pending', Approved: 'approved', Rejected: 'rejected', Returned: 'returned',
}

function mapDecision(d: BackendDecision): ValidationStep {
  const name = d.validatedByEmployee?.FullName ?? ''
  return {
    level: STEP_LEVEL[d.StepOrder] ?? 'n1',
    actorName: name,
    actorInitials: initialsFromFullName(name),
    action: DECISION_ACTION[d.Decision] ?? 'pending',
    date: d.DecidedAt ?? '',
    comment: d.Comment ?? undefined,
  }
}

function mapAllowanceLine(l: BackendAllowanceLine): MissionAllowanceLine {
  return {
    expenseTypeId: l.expenseTypeId,
    expenseTypeName: l.expenseTypeName,
    unit: l.unit,
    rate: l.rate,
    days: l.days,
    amount: l.amount,
    currency: l.currency,
    documentRequired: l.documentRequired,
  }
}

function mapMissionExpenseLine(l: BackendMissionExpenseLine): MissionExpenseLine {
  return {
    id: l.Id,
    expenseTypeId: l.ExpenseTypeId,
    expenseTypeName: l.expenseType?.Name ?? '',
    description: l.Description ?? undefined,
    amount: Number(l.Amount),
  }
}

function mapLinkedMission(l: NonNullable<BackendMissionOrder['linkedMissionOrder']>): LinkedMissionSummary {
  return {
    id: l.Id,
    referenceCode: l.ReferenceCode,
    destination: l.Destination,
    status: l.Status as MissionStatus,
    employeeName: l.employee?.FullName ?? '',
  }
}

function mapMissionOrder(raw: BackendMissionOrder): MissionOrder {
  const employeeName = raw.employee?.FullName ?? ''
  return {
    id: raw.Id,
    referenceCode: raw.ReferenceCode,
    employeeId: raw.EmployeeId,
    employeeName,
    employeeInitials: initialsFromFullName(employeeName),
    createdById: raw.createdByEmployee?.Id,
    createdByName: raw.createdByEmployee?.FullName,
    employeeCategoryId: raw.employee?.EmployeeCategoryId ?? undefined,
    destination: raw.Destination,
    missionCategory: raw.MissionCategory as MissionCategory,
    purpose: raw.Purpose,
    departureDate: raw.DepartureDate.slice(0, 10),
    returnDate: raw.ReturnDate.slice(0, 10),
    daysCount: Number(raw.DaysCount),
    transportModeGo: raw.TransportModeGo as TransportMode,
    transportModeReturn: raw.TransportModeReturn as TransportMode,
    advanceRequested: Number(raw.AdvanceRequested),
    currency: raw.Currency,
    status: raw.Status as MissionStatus,
    approvalPoolId: raw.ApprovalPoolId ?? undefined,
    currentApprovalStep: raw.CurrentApprovalStep ?? undefined,
    rejectionReason: raw.RejectionReason ?? undefined,
    estimatedTotal: raw.EstimatedTotal,
    allowance: raw.allowance ? { lines: raw.allowance.lines.map(mapAllowanceLine), total: raw.allowance.total } : undefined,
    expenseLines: (raw.missionExpenseLines ?? []).map(mapMissionExpenseLine),
    linkedMission: raw.linkedMissionOrder ? mapLinkedMission(raw.linkedMissionOrder) : undefined,
    createdAt: raw.CreatedAt,
    modifiedAt: raw.ModifiedAt ?? undefined,
    validationHistory: raw.decisions ? raw.decisions.map(mapDecision) : undefined,
  }
}

export interface MissionExpenseLinePayload {
  expenseTypeId: string
  description?: string
  amount: number
}

export interface CreateMissionPayload {
  destination: string
  missionCategory: MissionCategory
  purpose: string
  departureDate: string
  returnDate: string
  transportModeGo: TransportMode
  transportModeReturn: TransportMode
  advanceRequested?: number
  currency?: string
  expenseLines?: MissionExpenseLinePayload[]
  employeeId?: string // uniquement si on soumet pour un autre employé (MISSION_VOIR_TOUT)
  // Mission accompagnant (plan de test #22) — cree automatiquement un second
  // ordre de mission, memes dates/destination/categorie, pour cet employe.
  associatedEmployeeId?: string
}

function toBackendExpenseLine(l: MissionExpenseLinePayload) {
  return { ExpenseTypeId: l.expenseTypeId, Description: l.description, Amount: l.amount }
}

function toBackendCreatePayload(p: CreateMissionPayload) {
  return {
    EmployeeId: p.employeeId,
    Destination: p.destination,
    MissionCategory: p.missionCategory,
    Purpose: p.purpose,
    DepartureDate: p.departureDate,
    ReturnDate: p.returnDate,
    TransportModeGo: p.transportModeGo,
    TransportModeReturn: p.transportModeReturn,
    AdvanceRequested: p.advanceRequested,
    Currency: p.currency,
    ExpenseLines: p.expenseLines?.map(toBackendExpenseLine),
    AssociatedEmployeeId: p.associatedEmployeeId,
  }
}

export interface EstimateResult {
  days: number
  lines: MissionAllowanceLine[]
  total: number
}

export const useMissionStore = defineStore('missions', () => {
  const mine         = ref<MissionOrder[]>([])
  const team         = ref<MissionOrder[]>([])
  const all          = ref<MissionOrder[]>([])
  const pendingForMe = ref<MissionOrder[]>([])
  const loading      = ref(false)
  const error        = ref<string | null>(null)

  // forEmployeeId (optionnel) : etend le resultat aux missions du
  // beneficiaire vise par une note de frais en cours de creation pour lui
  // (voir ExpenseCreate.vue) — le picker "Mission liee" doit proposer ses
  // missions en plus des miennes.
  async function fetchMine(forEmployeeId?: string) {
    loading.value = true
    error.value = null
    try {
      const { data } = await api.get<BackendMissionOrder[]>('/mission-orders/mine', {
        params: forEmployeeId ? { forEmployeeId } : undefined,
      })
      mine.value = data.map(mapMissionOrder)
    } catch (err) {
      error.value = getApiErrorMessage(err, 'Impossible de charger vos ordres de mission')
      throw err
    } finally {
      loading.value = false
    }
  }

  async function fetchTeam() {
    loading.value = true
    error.value = null
    try {
      const { data } = await api.get<BackendMissionOrder[]>('/mission-orders/team')
      team.value = data.map(mapMissionOrder)
    } catch (err) {
      error.value = getApiErrorMessage(err, "Impossible de charger les ordres de mission de l'équipe")
      throw err
    } finally {
      loading.value = false
    }
  }

  async function fetchAll() {
    loading.value = true
    error.value = null
    try {
      const { data } = await api.get<BackendMissionOrder[]>('/mission-orders')
      all.value = data.map(mapMissionOrder)
    } catch (err) {
      error.value = getApiErrorMessage(err, 'Impossible de charger les ordres de mission')
      throw err
    } finally {
      loading.value = false
    }
  }

  async function fetchPendingForMe() {
    loading.value = true
    error.value = null
    try {
      const { data } = await api.get<BackendMissionOrder[]>('/mission-orders/pending-for-me')
      pendingForMe.value = data.map(mapMissionOrder)
    } catch (err) {
      error.value = getApiErrorMessage(err, 'Impossible de charger les ordres de mission à valider')
      throw err
    } finally {
      loading.value = false
    }
  }

  async function fetchOne(id: string): Promise<MissionOrder> {
    const { data } = await api.get<BackendMissionOrder>(`/mission-orders/${id}`)
    return mapMissionOrder(data)
  }

  async function estimate(employeeId: string, missionCategory: MissionCategory, departureDate: string, returnDate: string): Promise<EstimateResult> {
    const { data } = await api.get<{ days: number; lines: BackendAllowanceLine[]; total: number }>('/mission-orders/estimate', {
      params: { employeeId, missionCategory, departureDate, returnDate },
    })
    return { days: data.days, lines: data.lines.map(mapAllowanceLine), total: data.total }
  }

  // Remplace l'entrée correspondante dans toutes les listes locales déjà
  // chargées (mine/team/all/pendingForMe) — évite un refetch complet après
  // chaque action de workflow.
  function replaceEverywhere(updated: MissionOrder) {
    for (const list of [mine, team, all, pendingForMe]) {
      const idx = list.value.findIndex(m => m.id === updated.id)
      if (idx !== -1) list.value[idx] = updated
    }
  }
  function removeEverywhere(id: string) {
    for (const list of [mine, team, all, pendingForMe]) {
      list.value = list.value.filter(m => m.id !== id)
    }
  }
  // Voir leaveRequests.ts removeFromPending — une decision retire tout de
  // suite la ligne de "à valider" pour l'acteur courant, sans attendre un
  // rechargement complet de la page.
  function removeFromPending(id: string) {
    pendingForMe.value = pendingForMe.value.filter(m => m.id !== id)
  }

  async function create(payload: CreateMissionPayload): Promise<MissionOrder> {
    error.value = null
    try {
      const { data } = await api.post<BackendMissionOrder>('/mission-orders', toBackendCreatePayload(payload))
      const mapped = mapMissionOrder(data)
      mine.value.unshift(mapped)
      return mapped
    } catch (err) {
      error.value = getApiErrorMessage(err, "Impossible de créer l'ordre de mission")
      throw err
    }
  }

  // Pas de try/catch avant (Lot corrections 12/08) : un echec (ex: aucun
  // pool de validation configure) passait inapercu — le bouton "Soumettre"
  // de la fiche/liste ne fait qu'appeler cette fonction sans l'attendre, il
  // faut donc que l'erreur soit visible d'elle-meme (toast), pas seulement
  // propagee a un appelant qui ne l'observe pas toujours.
  async function submit(id: string): Promise<MissionOrder> {
    error.value = null
    return withToast('Soumission en cours…', async () => {
      try {
        const { data } = await api.post<BackendMissionOrder>(`/mission-orders/${id}/submit`)
        const mapped = mapMissionOrder(data)
        replaceEverywhere(mapped)
        return mapped
      } catch (err) {
        error.value = getApiErrorMessage(err, "Impossible de soumettre l'ordre de mission")
        throw err
      }
    }, () => error.value ?? "Impossible de soumettre l'ordre de mission")
  }

  /** Crée puis soumet immédiatement. */
  async function createAndSubmit(payload: CreateMissionPayload): Promise<MissionOrder> {
    error.value = null
    return withToast("Soumission de l'ordre de mission en cours…", async () => {
      let created: MissionOrder | undefined
      try {
        created = await create(payload)
        return await submit(created.id)
      } catch (err) {
        // Ne laisse pas trainer le brouillon cree juste avant si la
        // soumission echoue apres coup — l'utilisateur voulait une
        // soumission directe, pas un brouillon.
        if (created) {
          await api.delete(`/mission-orders/${created.id}`).catch(() => {})
          removeEverywhere(created.id)
        }
        error.value = getApiErrorMessage(err, "Impossible de soumettre l'ordre de mission")
        throw err
      }
    }, () => error.value ?? "Impossible de soumettre l'ordre de mission")
  }

  async function saveDraft(payload: CreateMissionPayload): Promise<MissionOrder> {
    error.value = null
    return withToast('Enregistrement du brouillon en cours…', async () => {
      try {
        return await create(payload)
      } catch (err) {
        error.value = getApiErrorMessage(err, "Impossible d'enregistrer le brouillon")
        throw err
      }
    }, () => error.value ?? "Impossible d'enregistrer le brouillon")
  }

  async function update(id: string, patch: Partial<Omit<CreateMissionPayload, 'employeeId'>>): Promise<MissionOrder> {
    error.value = null
    return withToast('Enregistrement en cours…', async () => {
      try {
        const body: Record<string, unknown> = {}
        if (patch.destination !== undefined) body.Destination = patch.destination
        if (patch.missionCategory !== undefined) body.MissionCategory = patch.missionCategory
        if (patch.purpose !== undefined) body.Purpose = patch.purpose
        if (patch.departureDate !== undefined) body.DepartureDate = patch.departureDate
        if (patch.returnDate !== undefined) body.ReturnDate = patch.returnDate
        if (patch.transportModeGo !== undefined) body.TransportModeGo = patch.transportModeGo
        if (patch.transportModeReturn !== undefined) body.TransportModeReturn = patch.transportModeReturn
        if (patch.advanceRequested !== undefined) body.AdvanceRequested = patch.advanceRequested
        if (patch.currency !== undefined) body.Currency = patch.currency
        if (patch.expenseLines !== undefined) body.ExpenseLines = patch.expenseLines.map(toBackendExpenseLine)
        const { data } = await api.patch<BackendMissionOrder>(`/mission-orders/${id}`, body)
        const mapped = mapMissionOrder(data)
        replaceEverywhere(mapped)
        return mapped
      } catch (err) {
        error.value = getApiErrorMessage(err, "Impossible de mettre à jour l'ordre de mission")
        throw err
      }
    }, () => error.value ?? "Impossible de mettre à jour l'ordre de mission")
  }

  async function remove(id: string) {
    error.value = null
    return withToast('Suppression en cours…', async () => {
      try {
        await api.delete(`/mission-orders/${id}`)
        removeEverywhere(id)
      } catch (err) {
        error.value = getApiErrorMessage(err, "Impossible de supprimer l'ordre de mission")
        throw err
      }
    }, () => error.value ?? "Impossible de supprimer l'ordre de mission")
  }

  // DELETE /mission-orders/:id/permanent (Lot I) — suppression définitive,
  // distincte de remove() ci-dessus (réservée aux brouillons). Ici, un ordre
  // dans n'importe quel statut peut être caché de tout l'app — seul un dev
  // peut le restaurer en base.
  async function deletePermanently(id: string) {
    error.value = null
    return withToast('Suppression en cours…', async () => {
      try {
        await api.delete(`/mission-orders/${id}/permanent`)
        removeEverywhere(id)
      } catch (err) {
        error.value = getApiErrorMessage(err, "Impossible de supprimer l'ordre de mission")
        throw err
      }
    }, () => error.value ?? "Impossible de supprimer l'ordre de mission")
  }

  async function approve(id: string, comment?: string) {
    error.value = null
    return withToast('Validation en cours…', async () => {
      try {
        const { data } = await api.patch<BackendMissionOrder>(`/mission-orders/${id}/approve`, { Comment: comment })
        const mapped = mapMissionOrder(data)
        replaceEverywhere(mapped)
        removeFromPending(mapped.id)
        return mapped
      } catch (err) {
        error.value = getApiErrorMessage(err, 'Impossible de valider cet ordre de mission')
        throw err
      }
    }, () => error.value ?? 'Impossible de valider cet ordre de mission')
  }

  async function reject(id: string, comment: string) {
    error.value = null
    return withToast('Refus en cours…', async () => {
      try {
        const { data } = await api.patch<BackendMissionOrder>(`/mission-orders/${id}/reject`, { Comment: comment })
        const mapped = mapMissionOrder(data)
        replaceEverywhere(mapped)
        removeFromPending(mapped.id)
        return mapped
      } catch (err) {
        error.value = getApiErrorMessage(err, 'Impossible de refuser cet ordre de mission')
        throw err
      }
    }, () => error.value ?? 'Impossible de refuser cet ordre de mission')
  }

  async function returnMission(id: string, comment: string) {
    error.value = null
    return withToast('Retour en cours…', async () => {
      try {
        const { data } = await api.patch<BackendMissionOrder>(`/mission-orders/${id}/return`, { Comment: comment })
        const mapped = mapMissionOrder(data)
        replaceEverywhere(mapped)
        removeFromPending(mapped.id)
        return mapped
      } catch (err) {
        error.value = getApiErrorMessage(err, 'Impossible de retourner cet ordre de mission')
        throw err
      }
    }, () => error.value ?? 'Impossible de retourner cet ordre de mission')
  }

  async function cancel(id: string) {
    error.value = null
    return withToast('Annulation en cours…', async () => {
      try {
        const { data } = await api.patch<BackendMissionOrder>(`/mission-orders/${id}/cancel`)
        const mapped = mapMissionOrder(data)
        replaceEverywhere(mapped)
        return mapped
      } catch (err) {
        error.value = getApiErrorMessage(err, 'Impossible d’annuler cet ordre de mission')
        throw err
      }
    }, () => error.value ?? 'Impossible d’annuler cet ordre de mission')
  }

  return {
    mine, team, all, pendingForMe, loading, error,
    fetchMine, fetchTeam, fetchAll, fetchPendingForMe, fetchOne, estimate,
    create, submit, createAndSubmit, saveDraft, update, remove, deletePermanently,
    approve, reject, returnMission, cancel,
  }
})
