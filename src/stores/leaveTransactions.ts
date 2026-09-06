import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api, getApiErrorMessage } from '../lib/api'
import { withToast } from '../lib/withToast'
import type { LeaveBalance } from '../types'

export interface EmployeeLeaveBalances {
  employeeId:   string
  employeeName: string
  entityName:   string
  balances:     LeaveBalance[]
}

// Le backend renvoie deja les champs en camelCase (voir
// leave-transaction.service.ts:getBalances) — pas de mapping PascalCase ici,
// a la difference des autres stores.
export const useLeaveTransactionStore = defineStore('leaveTransactions', () => {
  const myBalances  = ref<LeaveBalance[]>([])
  const allBalances = ref<EmployeeLeaveBalances[]>([])
  const loading     = ref(false)
  const error       = ref<string | null>(null)

  async function fetchMyBalances() {
    loading.value = true
    error.value = null
    try {
      const { data } = await api.get<LeaveBalance[]>('/leave-transactions/balance/mine')
      myBalances.value = data
    } catch (err) {
      error.value = getApiErrorMessage(err, 'Impossible de charger vos soldes de congés')
      throw err
    } finally {
      loading.value = false
    }
  }

  async function fetchBalancesFor(employeeId: string): Promise<LeaveBalance[]> {
    const { data } = await api.get<LeaveBalance[]>(`/leave-transactions/balance/${employeeId}`)
    return data
  }

  async function fetchAllBalances() {
    loading.value = true
    error.value = null
    try {
      const { data } = await api.get<EmployeeLeaveBalances[]>('/leave-transactions/balance/all')
      allBalances.value = data
    } catch (err) {
      error.value = getApiErrorMessage(err, 'Impossible de charger les soldes de congés')
      throw err
    } finally {
      loading.value = false
    }
  }

  async function generateAccruals() {
    error.value = null
    return withToast('Génération des acquisitions en cours…', async () => {
      try {
        const { data } = await api.post<{ created: number; runAt: string }>('/leave-transactions/generate-accruals')
        return data
      } catch (err) {
        error.value = getApiErrorMessage(err, "Impossible de générer les acquisitions de congés")
        throw err
      }
    }, () => error.value ?? "Impossible de générer les acquisitions de congés")
  }

  // amount positif = crédit, négatif = décrément (plafonné à 0 côté backend
  // — jamais de solde négatif en base, voir LeaveTransactionService.adjustBalance).
  // wasClamped indique que le décrément demandé dépassait le solde
  // disponible et a été limité à ce qu'il restait.
  async function creditManual(employeeId: string, leaveTypeId: string, amount: number, reason?: string) {
    error.value = null
    return withToast('Mise à jour du solde en cours…', async () => {
      try {
        const { data } = await api.post<{ balances: LeaveBalance[]; wasClamped: boolean; newBalance: number }>(
          '/leave-transactions/credit',
          { EmployeeId: employeeId, LeaveTypeId: leaveTypeId, Amount: amount, Reason: reason || undefined },
        )
        const idx = allBalances.value.findIndex(b => b.employeeId === employeeId)
        const current = allBalances.value[idx]
        if (current) allBalances.value[idx] = { ...current, balances: data.balances }
        return data
      } catch (err) {
        error.value = getApiErrorMessage(err, "Impossible de mettre à jour ce solde")
        throw err
      }
    }, () => error.value ?? "Impossible de mettre à jour ce solde")
  }

  return { myBalances, allBalances, loading, error, fetchMyBalances, fetchBalancesFor, fetchAllBalances, generateAccruals, creditManual }
})
