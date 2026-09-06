import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api, getApiErrorMessage } from '../lib/api'
import { withToast } from '../lib/withToast'
import type { ExpenseReport, ExpenseStatus, ExpenseLine, ValidationStep } from '../types'

// ── Backend <-> frontend mapping ────────────────────────────────
interface BackendEmployeeRef { Id: string; FullName: string; EmployeeNumber?: string; EmployeeCategoryId?: string | null }
interface BackendExpenseTypeRef { Id: string; Name: string }
interface BackendDecision {
  Id: string
  StepOrder: number
  Decision: 'Pending' | 'Approved' | 'Rejected' | 'Returned'
  Comment: string | null
  DecidedAt: string | null
  CreatedAt: string
  validatedByEmployee?: BackendEmployeeRef
}
interface BackendExpenseLine {
  Id: string
  ExpenseDate: string
  ExpenseTypeId: string
  Description: string | null
  Amount: string | number
  Currency: string
  HasDocument: boolean
  expenseType?: BackendExpenseTypeRef
}
interface BackendExpenseReport {
  Id: string
  ReferenceCode: string
  EmployeeId: string
  MissionOrderId: string | null
  Title: string
  Currency: string
  Status: string
  ApprovalPoolId: string | null
  CurrentApprovalStep: number | null
  RejectionReason: string | null
  SubmittedAt: string | null
  CreatedAt: string
  ModifiedAt?: string | null
  employee?: BackendEmployeeRef
  createdByEmployee?: BackendEmployeeRef
  lines: BackendExpenseLine[]
  TotalAmount?: number
  decisions?: BackendDecision[]
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

function mapLine(l: BackendExpenseLine): ExpenseLine {
  return {
    id: l.Id,
    date: l.ExpenseDate.slice(0, 10),
    expenseTypeId: l.ExpenseTypeId,
    expenseTypeName: l.expenseType?.Name ?? '',
    description: l.Description ?? undefined,
    amount: Number(l.Amount),
    currency: l.Currency,
    hasDocument: l.HasDocument,
  }
}

function mapExpenseReport(raw: BackendExpenseReport): ExpenseReport {
  const employeeName = raw.employee?.FullName ?? ''
  const lines = (raw.lines ?? []).map(mapLine)
  return {
    id: raw.Id,
    referenceCode: raw.ReferenceCode,
    employeeId: raw.EmployeeId,
    employeeName,
    employeeInitials: initialsFromFullName(employeeName),
    employeeCategoryId: raw.employee?.EmployeeCategoryId ?? undefined,
    createdById: raw.createdByEmployee?.Id,
    createdByName: raw.createdByEmployee?.FullName,
    title: raw.Title,
    missionOrderId: raw.MissionOrderId ?? undefined,
    lines,
    totalAmount: raw.TotalAmount ?? lines.reduce((s, l) => s + l.amount, 0),
    currency: raw.Currency,
    status: raw.Status as ExpenseStatus,
    approvalPoolId: raw.ApprovalPoolId ?? undefined,
    currentApprovalStep: raw.CurrentApprovalStep ?? undefined,
    rejectionReason: raw.RejectionReason ?? undefined,
    submittedAt: raw.SubmittedAt ?? undefined,
    createdAt: raw.CreatedAt,
    modifiedAt: raw.ModifiedAt ?? undefined,
    validationHistory: raw.decisions ? raw.decisions.map(mapDecision) : undefined,
  }
}

export interface ExpenseLinePayload {
  date: string
  expenseTypeId: string
  description?: string
  amount: number
  currency?: string
  hasDocument?: boolean
}

export interface CreateExpenseReportPayload {
  title: string
  missionOrderId?: string
  currency?: string
  lines: ExpenseLinePayload[]
  employeeId?: string // uniquement si on soumet pour un autre employé (FRAIS_VOIR_TOUT)
}

function toBackendLine(l: ExpenseLinePayload) {
  return {
    ExpenseDate: l.date,
    ExpenseTypeId: l.expenseTypeId,
    Description: l.description,
    Amount: l.amount,
    Currency: l.currency,
    HasDocument: l.hasDocument,
  }
}

function toBackendCreatePayload(p: CreateExpenseReportPayload) {
  return {
    EmployeeId: p.employeeId,
    Title: p.title,
    MissionOrderId: p.missionOrderId,
    Currency: p.currency,
    Lines: p.lines.map(toBackendLine),
  }
}

export const useExpenseStore = defineStore('expenses', () => {
  const mine         = ref<ExpenseReport[]>([])
  const team         = ref<ExpenseReport[]>([])
  const all          = ref<ExpenseReport[]>([])
  const pendingForMe = ref<ExpenseReport[]>([])
  const loading      = ref(false)
  const error        = ref<string | null>(null)

  async function fetchMine() {
    loading.value = true
    error.value = null
    try {
      const { data } = await api.get<BackendExpenseReport[]>('/expense-reports/mine')
      mine.value = data.map(mapExpenseReport)
    } catch (err) {
      error.value = getApiErrorMessage(err, 'Impossible de charger vos notes de frais')
      throw err
    } finally {
      loading.value = false
    }
  }

  async function fetchTeam() {
    loading.value = true
    error.value = null
    try {
      const { data } = await api.get<BackendExpenseReport[]>('/expense-reports/team')
      team.value = data.map(mapExpenseReport)
    } catch (err) {
      error.value = getApiErrorMessage(err, "Impossible de charger les notes de frais de l'équipe")
      throw err
    } finally {
      loading.value = false
    }
  }

  async function fetchAll() {
    loading.value = true
    error.value = null
    try {
      const { data } = await api.get<BackendExpenseReport[]>('/expense-reports')
      all.value = data.map(mapExpenseReport)
    } catch (err) {
      error.value = getApiErrorMessage(err, 'Impossible de charger les notes de frais')
      throw err
    } finally {
      loading.value = false
    }
  }

  async function fetchPendingForMe() {
    loading.value = true
    error.value = null
    try {
      const { data } = await api.get<BackendExpenseReport[]>('/expense-reports/pending-for-me')
      pendingForMe.value = data.map(mapExpenseReport)
    } catch (err) {
      error.value = getApiErrorMessage(err, 'Impossible de charger les notes de frais à valider')
      throw err
    } finally {
      loading.value = false
    }
  }

  async function fetchOne(id: string): Promise<ExpenseReport> {
    const { data } = await api.get<BackendExpenseReport>(`/expense-reports/${id}`)
    return mapExpenseReport(data)
  }

  function replaceEverywhere(updated: ExpenseReport) {
    for (const list of [mine, team, all, pendingForMe]) {
      const idx = list.value.findIndex(r => r.id === updated.id)
      if (idx !== -1) list.value[idx] = updated
    }
  }
  function removeEverywhere(id: string) {
    for (const list of [mine, team, all, pendingForMe]) {
      list.value = list.value.filter(r => r.id !== id)
    }
  }
  // Voir leaveRequests.ts removeFromPending — une decision retire tout de
  // suite la ligne de "à valider" pour l'acteur courant, sans attendre un
  // rechargement complet de la page.
  function removeFromPending(id: string) {
    pendingForMe.value = pendingForMe.value.filter(r => r.id !== id)
  }

  async function create(payload: CreateExpenseReportPayload): Promise<ExpenseReport> {
    error.value = null
    try {
      const { data } = await api.post<BackendExpenseReport>('/expense-reports', toBackendCreatePayload(payload))
      const mapped = mapExpenseReport(data)
      mine.value.unshift(mapped)
      return mapped
    } catch (err) {
      error.value = getApiErrorMessage(err, 'Impossible de créer la note de frais')
      throw err
    }
  }

  // Pas de try/catch avant (Lot corrections 12/08) : un echec (ex: aucun
  // pool de validation configure) passait inapercu — le bouton "Soumettre"
  // de la fiche/liste ne fait qu'appeler cette fonction sans l'attendre, il
  // faut donc que l'erreur soit visible d'elle-meme (toast), pas seulement
  // propagee a un appelant qui ne l'observe pas toujours.
  async function submit(id: string): Promise<ExpenseReport> {
    error.value = null
    return withToast('Soumission en cours…', async () => {
      try {
        const { data } = await api.post<BackendExpenseReport>(`/expense-reports/${id}/submit`)
        const mapped = mapExpenseReport(data)
        replaceEverywhere(mapped)
        return mapped
      } catch (err) {
        error.value = getApiErrorMessage(err, 'Impossible de soumettre cette note de frais')
        throw err
      }
    }, () => error.value ?? 'Impossible de soumettre cette note de frais')
  }

  /** Crée puis soumet immédiatement. */
  async function createAndSubmit(payload: CreateExpenseReportPayload): Promise<ExpenseReport> {
    error.value = null
    return withToast('Soumission de la note de frais en cours…', async () => {
      let created: ExpenseReport | undefined
      try {
        created = await create(payload)
        return await submit(created.id)
      } catch (err) {
        // Ne laisse pas trainer le brouillon cree juste avant si la
        // soumission echoue apres coup — l'utilisateur voulait une
        // soumission directe, pas un brouillon.
        if (created) {
          await api.delete(`/expense-reports/${created.id}`).catch(() => {})
          removeEverywhere(created.id)
        }
        error.value = getApiErrorMessage(err, 'Impossible de soumettre la note de frais')
        throw err
      }
    }, () => error.value ?? 'Impossible de soumettre la note de frais')
  }

  async function saveDraft(payload: CreateExpenseReportPayload): Promise<ExpenseReport> {
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

  async function update(id: string, patch: Partial<Omit<CreateExpenseReportPayload, 'employeeId'>>): Promise<ExpenseReport> {
    error.value = null
    return withToast('Enregistrement en cours…', async () => {
      try {
        const body: Record<string, unknown> = {}
        if (patch.title !== undefined) body.Title = patch.title
        if (patch.missionOrderId !== undefined) body.MissionOrderId = patch.missionOrderId
        if (patch.currency !== undefined) body.Currency = patch.currency
        if (patch.lines !== undefined) body.Lines = patch.lines.map(toBackendLine)
        const { data } = await api.patch<BackendExpenseReport>(`/expense-reports/${id}`, body)
        const mapped = mapExpenseReport(data)
        replaceEverywhere(mapped)
        return mapped
      } catch (err) {
        error.value = getApiErrorMessage(err, 'Impossible de mettre à jour la note de frais')
        throw err
      }
    }, () => error.value ?? 'Impossible de mettre à jour la note de frais')
  }

  async function remove(id: string) {
    error.value = null
    return withToast('Suppression en cours…', async () => {
      try {
        await api.delete(`/expense-reports/${id}`)
        removeEverywhere(id)
      } catch (err) {
        error.value = getApiErrorMessage(err, 'Impossible de supprimer la note de frais')
        throw err
      }
    }, () => error.value ?? 'Impossible de supprimer la note de frais')
  }

  // DELETE /expense-reports/:id/permanent (Lot I) — suppression définitive,
  // distincte de remove() ci-dessus (réservée aux brouillons). Ici, une note
  // dans n'importe quel statut peut être cachée de tout l'app — seul un dev
  // peut la restaurer en base.
  async function deletePermanently(id: string) {
    error.value = null
    return withToast('Suppression en cours…', async () => {
      try {
        await api.delete(`/expense-reports/${id}/permanent`)
        removeEverywhere(id)
      } catch (err) {
        error.value = getApiErrorMessage(err, 'Impossible de supprimer la note de frais')
        throw err
      }
    }, () => error.value ?? 'Impossible de supprimer la note de frais')
  }

  async function approve(id: string, comment?: string) {
    error.value = null
    return withToast('Validation en cours…', async () => {
      try {
        const { data } = await api.patch<BackendExpenseReport>(`/expense-reports/${id}/approve`, { Comment: comment })
        const mapped = mapExpenseReport(data)
        replaceEverywhere(mapped)
        removeFromPending(mapped.id)
        return mapped
      } catch (err) {
        error.value = getApiErrorMessage(err, 'Impossible de valider cette note de frais')
        throw err
      }
    }, () => error.value ?? 'Impossible de valider cette note de frais')
  }

  async function reject(id: string, comment: string) {
    error.value = null
    return withToast('Refus en cours…', async () => {
      try {
        const { data } = await api.patch<BackendExpenseReport>(`/expense-reports/${id}/reject`, { Comment: comment })
        const mapped = mapExpenseReport(data)
        replaceEverywhere(mapped)
        removeFromPending(mapped.id)
        return mapped
      } catch (err) {
        error.value = getApiErrorMessage(err, 'Impossible de refuser cette note de frais')
        throw err
      }
    }, () => error.value ?? 'Impossible de refuser cette note de frais')
  }

  async function returnReport(id: string, comment: string) {
    error.value = null
    return withToast('Retour en cours…', async () => {
      try {
        const { data } = await api.patch<BackendExpenseReport>(`/expense-reports/${id}/return`, { Comment: comment })
        const mapped = mapExpenseReport(data)
        replaceEverywhere(mapped)
        removeFromPending(mapped.id)
        return mapped
      } catch (err) {
        error.value = getApiErrorMessage(err, 'Impossible de retourner cette note de frais')
        throw err
      }
    }, () => error.value ?? 'Impossible de retourner cette note de frais')
  }

  async function cancel(id: string) {
    error.value = null
    return withToast('Annulation en cours…', async () => {
      try {
        const { data } = await api.patch<BackendExpenseReport>(`/expense-reports/${id}/cancel`)
        const mapped = mapExpenseReport(data)
        replaceEverywhere(mapped)
        return mapped
      } catch (err) {
        error.value = getApiErrorMessage(err, 'Impossible d’annuler cette note de frais')
        throw err
      }
    }, () => error.value ?? 'Impossible d’annuler cette note de frais')
  }

  return {
    mine, team, all, pendingForMe, loading, error,
    fetchMine, fetchTeam, fetchAll, fetchPendingForMe, fetchOne,
    create, submit, createAndSubmit, saveDraft, update, remove, deletePermanently,
    approve, reject, returnReport, cancel,
  }
})
