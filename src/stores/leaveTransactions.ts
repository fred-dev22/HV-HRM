import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api, getApiErrorMessage } from '../lib/api'
import { withToast } from '../lib/withToast'
import type { LeaveBalance } from '../types'

export interface EmployeeLeaveBalances {
  employeeId:   string
  employeeNumber?: string
  employeeName: string
  // Fournis par le backend pour afficher l'avatar sans charger les employes.
  initials?:    string
  paletteIndex?: number
  entityName:   string
  balances:     LeaveBalance[]
}

export interface BalancePageParams {
  page: number
  pageSize: number
  search?: string
  entity?: string
  sort?: string
  dir?: 'asc' | 'desc'
}
// Colonnes (types de conge presents chez au moins un employe eligible) et
// total des soldes par type sur TOUTE l'entreprise : independants du filtre et
// de la page.
export interface BalanceColumn extends LeaveBalance { total: number }
export interface BalancePage {
  items: EmployeeLeaveBalances[]
  total: number
  meta: { tracked: number; columns: BalanceColumn[] }
}

// Le backend renvoie deja les champs en camelCase (voir
// leave-transaction.service.ts:getBalances) — pas de mapping PascalCase ici,
// a la difference des autres stores.
export const useLeaveTransactionStore = defineStore('leaveTransactions', () => {
  const myBalances  = ref<LeaveBalance[]>([])
  const allBalances = ref<EmployeeLeaveBalances[]>([])
  const loading     = ref(false)
  // Fonctions de lecture deja reussies au moins une fois : pas de loader ensuite
  // (la liste affichee est relue en silence), meme si elle est vide.
  const loadedFetches = new Set<string>()
  const error       = ref<string | null>(null)
  // Incremente a chaque changement de soldes (ajustement, import, generation,
  // temps reel) : les ecrans qui affichent une page de soldes la relisent.
  const balancesVersion = ref(0)
  const bumpBalances = () => { balancePageCache.clear(); balancesVersion.value++ }

  async function fetchMyBalances() {
    loading.value = !loadedFetches.has('fetchMyBalances')
    error.value = null
    try {
      const { data } = await api.get<LeaveBalance[]>('/leave-transactions/balance/mine')
      myBalances.value = data
      loadedFetches.add('fetchMyBalances')
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

  // Une page de soldes (pagination, recherche, filtre entite, tri : serveur).
  // Les dernieres pages lues sont gardees (par criteres) : l'ecran les affiche tout de suite au
  // retour, puis relit TOUJOURS en arriere-plan. Videe quand les soldes changent (bumpBalances).
  const balancePageCache = new Map<string, BalancePage>()
  const balanceKey = (params: BalancePageParams) =>
    JSON.stringify(Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== undefined && v !== null)))
  function peekBalancePage(params: BalancePageParams): BalancePage | undefined {
    return balancePageCache.get(balanceKey(params))
  }
  async function fetchBalancePage(params: BalancePageParams): Promise<BalancePage> {
    const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== undefined && v !== null))
    const { data } = await api.get<BalancePage>('/leave-transactions/balance/page', { params: clean })
    balancePageCache.set(balanceKey(params), data)
    return data
  }

  async function fetchAllBalances() {
    loading.value = !loadedFetches.has('fetchAllBalances')
    error.value = null
    try {
      const { data } = await api.get<EmployeeLeaveBalances[]>('/leave-transactions/balance/all')
      allBalances.value = data
      loadedFetches.add('fetchAllBalances')
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
        bumpBalances()
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
        bumpBalances()
        return data
      } catch (err) {
        error.value = getApiErrorMessage(err, "Impossible de mettre à jour ce solde")
        throw err
      }
    }, () => error.value ?? "Impossible de mettre à jour ce solde")
  }

  // Fixe le solde a une valeur FINALE (retour client, weekly) : le serveur calcule
  // l'ecart avec le solde du moment et le trace comme un ajustement manuel.
  async function setBalance(employeeId: string, leaveTypeId: string, targetBalance: number, reason?: string) {
    error.value = null
    return withToast('Mise à jour du solde en cours…', async () => {
      try {
        const { data } = await api.post<{ balances: LeaveBalance[]; wasClamped: boolean; newBalance: number }>(
          '/leave-transactions/set-balance',
          { EmployeeId: employeeId, LeaveTypeId: leaveTypeId, Amount: targetBalance, Reason: reason || undefined },
        )
        const idx = allBalances.value.findIndex(b => b.employeeId === employeeId)
        const current = allBalances.value[idx]
        if (current) allBalances.value[idx] = { ...current, balances: data.balances }
        bumpBalances()
        return data
      } catch (err) {
        error.value = getApiErrorMessage(err, "Impossible de mettre à jour ce solde")
        throw err
      }
    }, () => error.value ?? "Impossible de mettre à jour ce solde")
  }

  return { myBalances, allBalances, loading, error, balancesVersion, bumpBalances, fetchBalancePage, peekBalancePage, fetchMyBalances, fetchBalancesFor, fetchAllBalances, generateAccruals, creditManual, setBalance }
})
