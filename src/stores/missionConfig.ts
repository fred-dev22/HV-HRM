import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api, getApiErrorMessage } from '../lib/api'
import { withToast } from '../lib/withToast'

// Aligned on the backend EmployeeCategory model — no `description` column
// exists server-side (it never persisted anyway), so it's been dropped
// rather than kept as a silently-lost UI field.
export interface EmpCategory {
  id:       string
  code:     string
  name:     string
  isActive: boolean
}

interface BackendEmployeeCategory {
  Id: string
  Code: string
  Name: string
  IsActive: boolean
}

function mapCategory(raw: BackendEmployeeCategory): EmpCategory {
  return { id: raw.Id, code: raw.Code, name: raw.Name, isActive: raw.IsActive }
}

// ── ExpenseType — reel, aligne sur le backend ────────────────────
export type ExpenseUnit = 'PerDay' | 'PerTrip' | 'PerItem'

export interface ExpenseType {
  id:       string
  code:     string
  name:     string
  unit:     ExpenseUnit
  isActive: boolean
  isSystem: boolean
}

interface BackendExpenseType {
  Id: string
  Code: string
  Name: string
  Unit: ExpenseUnit
  IsActive: boolean
  IsSystem: boolean
}

function mapExpenseType(raw: BackendExpenseType): ExpenseType {
  return { id: raw.Id, code: raw.Code, name: raw.Name, unit: raw.Unit, isActive: raw.IsActive, isSystem: raw.IsSystem }
}

// ── ExpenseConfig — matrice EmployeeCategory x ExpenseType x
// MissionCategory → taux, reel, aligne sur le backend ────────────
export type MissionCategory = 'National' | 'International'

export interface ExpenseConfigRow {
  id:                 string
  employeeCategoryId: string
  expenseTypeId:      string
  missionCategory:    MissionCategory
  dailyRate:          number
  currency:           string
  documentRequired:   boolean
  isActive:           boolean
}

interface BackendExpenseConfig {
  Id: string
  EmployeeCategoryId: string
  ExpenseTypeId: string
  MissionCategory: MissionCategory
  DailyRate: string | number
  Currency: string
  DocumentRequired: boolean
  IsActive: boolean
}

function mapConfig(raw: BackendExpenseConfig): ExpenseConfigRow {
  return {
    id: raw.Id,
    employeeCategoryId: raw.EmployeeCategoryId,
    expenseTypeId: raw.ExpenseTypeId,
    missionCategory: raw.MissionCategory,
    dailyRate: Number(raw.DailyRate),
    currency: raw.Currency,
    documentRequired: raw.DocumentRequired,
    isActive: raw.IsActive,
  }
}

// ── ExpenseCeiling — plafond de note de frais (independant d'une mission)
// par EmployeeCategory x ExpenseType — plan de tests #21 ────────────
export interface ExpenseCeilingRow {
  id:                 string
  employeeCategoryId: string
  expenseTypeId:      string
  maxAmount:          number
  currency:           string
}

interface BackendExpenseCeiling {
  Id: string
  EmployeeCategoryId: string
  ExpenseTypeId: string
  MaxAmount: string | number
  Currency: string
}

function mapCeiling(raw: BackendExpenseCeiling): ExpenseCeilingRow {
  return {
    id: raw.Id,
    employeeCategoryId: raw.EmployeeCategoryId,
    expenseTypeId: raw.ExpenseTypeId,
    maxAmount: Number(raw.MaxAmount),
    currency: raw.Currency,
  }
}

export const useMissionConfigStore = defineStore('missionConfig', () => {
  const categories   = ref<EmpCategory[]>([])
  const expenseTypes = ref<ExpenseType[]>([])
  const configs      = ref<ExpenseConfigRow[]>([])
  const ceilings     = ref<ExpenseCeilingRow[]>([])
  const loading = ref(false)
  const error   = ref<string | null>(null)

  // ── EmployeeCategory ──────────────────────────────────────────
  async function fetchCategories() {
    loading.value = true
    error.value = null
    try {
      const { data } = await api.get<BackendEmployeeCategory[]>('/employee-categories')
      categories.value = data.map(mapCategory)
    } catch (err) {
      error.value = getApiErrorMessage(err, 'Impossible de charger les catégories d\'employés')
      throw err
    } finally {
      loading.value = false
    }
  }

  async function addCategory(payload: Omit<EmpCategory, 'id' | 'isActive'> & { isActive?: boolean }) {
    error.value = null
    return withToast('Création de la catégorie en cours…', async () => {
      try {
        const { data } = await api.post<BackendEmployeeCategory>('/employee-categories', {
          Code: payload.code,
          Name: payload.name,
          IsActive: payload.isActive ?? true,
        })
        const mapped = mapCategory(data)
        categories.value.push(mapped)
        return mapped
      } catch (err) {
        error.value = getApiErrorMessage(err, 'Impossible de créer la catégorie')
        throw err
      }
    }, () => error.value ?? 'Impossible de créer la catégorie')
  }

  async function updateCategory(id: string, payload: Partial<EmpCategory>) {
    error.value = null
    return withToast('Enregistrement en cours…', async () => {
      try {
        const body: Record<string, unknown> = {}
        if (payload.code !== undefined) body.Code = payload.code
        if (payload.name !== undefined) body.Name = payload.name
        if (payload.isActive !== undefined) body.IsActive = payload.isActive
        const { data } = await api.patch<BackendEmployeeCategory>(`/employee-categories/${id}`, body)
        const mapped = mapCategory(data)
        const idx = categories.value.findIndex(c => c.id === id)
        if (idx !== -1) categories.value[idx] = mapped
        return mapped
      } catch (err) {
        error.value = getApiErrorMessage(err, 'Impossible de mettre à jour la catégorie')
        throw err
      }
    }, () => error.value ?? 'Impossible de mettre à jour la catégorie')
  }

  async function deleteCategory(id: string) {
    error.value = null
    return withToast('Suppression en cours…', async () => {
      try {
        await api.delete(`/employee-categories/${id}`)
        categories.value = categories.value.filter(c => c.id !== id)
      } catch (err) {
        error.value = getApiErrorMessage(err, 'Impossible de supprimer la catégorie')
        throw err
      }
    }, () => error.value ?? 'Impossible de supprimer la catégorie')
  }

  // ── ExpenseType ───────────────────────────────────────────────
  async function fetchExpenseTypes() {
    loading.value = true
    error.value = null
    try {
      const { data } = await api.get<BackendExpenseType[]>('/expense-types')
      expenseTypes.value = data.map(mapExpenseType)
    } catch (err) {
      error.value = getApiErrorMessage(err, 'Impossible de charger les types de frais')
      throw err
    } finally {
      loading.value = false
    }
  }

  async function addExpenseType(payload: Omit<ExpenseType, 'id' | 'isActive' | 'isSystem'> & { isActive?: boolean }) {
    error.value = null
    return withToast('Création du type de frais en cours…', async () => {
      try {
        const { data } = await api.post<BackendExpenseType>('/expense-types', {
          Code: payload.code, Name: payload.name, Unit: payload.unit, IsActive: payload.isActive ?? true,
        })
        const mapped = mapExpenseType(data)
        expenseTypes.value.push(mapped)
        return mapped
      } catch (err) {
        error.value = getApiErrorMessage(err, 'Impossible de créer le type de frais')
        throw err
      }
    }, () => error.value ?? 'Impossible de créer le type de frais')
  }

  async function updateExpenseType(id: string, payload: Partial<ExpenseType>) {
    error.value = null
    return withToast('Enregistrement en cours…', async () => {
      try {
        const body: Record<string, unknown> = {}
        if (payload.code !== undefined) body.Code = payload.code
        if (payload.name !== undefined) body.Name = payload.name
        if (payload.unit !== undefined) body.Unit = payload.unit
        if (payload.isActive !== undefined) body.IsActive = payload.isActive
        const { data } = await api.patch<BackendExpenseType>(`/expense-types/${id}`, body)
        const mapped = mapExpenseType(data)
        const idx = expenseTypes.value.findIndex(t => t.id === id)
        if (idx !== -1) expenseTypes.value[idx] = mapped
        return mapped
      } catch (err) {
        error.value = getApiErrorMessage(err, 'Impossible de mettre à jour le type de frais')
        throw err
      }
    }, () => error.value ?? 'Impossible de mettre à jour le type de frais')
  }

  async function deleteExpenseType(id: string) {
    error.value = null
    return withToast('Suppression en cours…', async () => {
      try {
        await api.delete(`/expense-types/${id}`)
        expenseTypes.value = expenseTypes.value.filter(t => t.id !== id)
      } catch (err) {
        error.value = getApiErrorMessage(err, 'Impossible de supprimer le type de frais')
        throw err
      }
    }, () => error.value ?? 'Impossible de supprimer le type de frais')
  }

  // ── ExpenseConfig (matrice des taux) ─────────────────────────
  async function fetchConfigs() {
    loading.value = true
    error.value = null
    try {
      const { data } = await api.get<BackendExpenseConfig[]>('/expense-configs')
      configs.value = data.map(mapConfig)
    } catch (err) {
      error.value = getApiErrorMessage(err, 'Impossible de charger les taux de frais')
      throw err
    } finally {
      loading.value = false
    }
  }

  function getConfig(expenseTypeId: string, employeeCategoryId: string, missionCategory: MissionCategory): ExpenseConfigRow | undefined {
    return configs.value.find(c =>
      c.expenseTypeId === expenseTypeId && c.employeeCategoryId === employeeCategoryId && c.missionCategory === missionCategory,
    )
  }

  // Cree la ligne si elle n'existe pas encore pour cette combinaison
  // Type x Categorie x Mission, sinon met a jour la ligne existante — evite
  // d'exposer create/update comme deux actions distinctes cote UI (une seule
  // cellule de grille = une seule action "definir").
  async function upsertConfig(
    expenseTypeId: string,
    employeeCategoryId: string,
    missionCategory: MissionCategory,
    patch: { dailyRate?: number; currency?: string; documentRequired?: boolean },
  ) {
    error.value = null
    return withToast('Enregistrement en cours…', async () => {
      try {
        const existing = getConfig(expenseTypeId, employeeCategoryId, missionCategory)
        if (existing) {
          const body: Record<string, unknown> = {}
          if (patch.dailyRate !== undefined) body.DailyRate = patch.dailyRate
          if (patch.currency !== undefined) body.Currency = patch.currency
          if (patch.documentRequired !== undefined) body.DocumentRequired = patch.documentRequired
          const { data } = await api.patch<BackendExpenseConfig>(`/expense-configs/${existing.id}`, body)
          const mapped = mapConfig(data)
          const idx = configs.value.findIndex(c => c.id === existing.id)
          if (idx !== -1) configs.value[idx] = mapped
          return mapped
        }
        const { data } = await api.post<BackendExpenseConfig>('/expense-configs', {
          EmployeeCategoryId: employeeCategoryId,
          ExpenseTypeId: expenseTypeId,
          MissionCategory: missionCategory,
          DailyRate: patch.dailyRate ?? 0,
          Currency: patch.currency ?? 'MGA',
          DocumentRequired: patch.documentRequired ?? false,
        })
        const mapped = mapConfig(data)
        configs.value.push(mapped)
        return mapped
      } catch (err) {
        error.value = getApiErrorMessage(err, 'Impossible de mettre à jour ce taux')
        throw err
      }
    }, () => error.value ?? 'Impossible de mettre à jour ce taux')
  }

  // ── ExpenseCeiling (plafond note de frais) ───────────────────
  async function fetchCeilings() {
    loading.value = true
    error.value = null
    try {
      const { data } = await api.get<BackendExpenseCeiling[]>('/expense-ceilings')
      ceilings.value = data.map(mapCeiling)
    } catch (err) {
      error.value = getApiErrorMessage(err, 'Impossible de charger les plafonds de notes de frais')
      throw err
    } finally {
      loading.value = false
    }
  }

  function getCeiling(expenseTypeId: string, employeeCategoryId: string): ExpenseCeilingRow | undefined {
    return ceilings.value.find(c => c.expenseTypeId === expenseTypeId && c.employeeCategoryId === employeeCategoryId)
  }

  // Meme logique create-ou-update qu'upsertConfig ci-dessus, sans dimension
  // MissionCategory (le plafond s'applique a une note de frais independamment
  // d'une mission).
  async function upsertCeiling(
    expenseTypeId: string,
    employeeCategoryId: string,
    patch: { maxAmount?: number; currency?: string },
  ) {
    error.value = null
    return withToast('Enregistrement en cours…', async () => {
      try {
        const existing = getCeiling(expenseTypeId, employeeCategoryId)
        if (existing) {
          const body: Record<string, unknown> = {}
          if (patch.maxAmount !== undefined) body.MaxAmount = patch.maxAmount
          if (patch.currency !== undefined) body.Currency = patch.currency
          const { data } = await api.patch<BackendExpenseCeiling>(`/expense-ceilings/${existing.id}`, body)
          const mapped = mapCeiling(data)
          const idx = ceilings.value.findIndex(c => c.id === existing.id)
          if (idx !== -1) ceilings.value[idx] = mapped
          return mapped
        }
        const { data } = await api.post<BackendExpenseCeiling>('/expense-ceilings', {
          EmployeeCategoryId: employeeCategoryId,
          ExpenseTypeId: expenseTypeId,
          MaxAmount: patch.maxAmount ?? 0,
          Currency: patch.currency ?? 'MGA',
        })
        const mapped = mapCeiling(data)
        ceilings.value.push(mapped)
        return mapped
      } catch (err) {
        error.value = getApiErrorMessage(err, 'Impossible de mettre à jour ce plafond')
        throw err
      }
    }, () => error.value ?? 'Impossible de mettre à jour ce plafond')
  }

  return {
    categories, expenseTypes, configs, ceilings, loading, error,
    fetchCategories, addCategory, updateCategory, deleteCategory,
    fetchExpenseTypes, addExpenseType, updateExpenseType, deleteExpenseType,
    fetchConfigs, getConfig, upsertConfig,
    fetchCeilings, getCeiling, upsertCeiling,
  }
})
