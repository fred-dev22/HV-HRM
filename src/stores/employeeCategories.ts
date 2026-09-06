import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api, getApiErrorMessage } from '../lib/api'
import { withToast } from '../lib/withToast'

// Une categorie porte a la fois le taux de frais/perdiem (ExpenseConfig) ET
// le paquet de permissions copie au compte utilisateur cree pour un employe
// de cette categorie (voir decision du 29/07 : "role et categorie c'est la
// meme chose"). Remplace l'ancien Role RBAC et l'ancienne JobCategory.
export interface CategoryPermission {
  permissionId: string
  code: string
  label: string
  module: string
}

export interface EmployeeCategory {
  id: string
  code: string
  name: string
  description: string
  isActive: boolean
  permissions: CategoryPermission[]
  employeeCount: number
}

interface BackendPermission {
  Id: string
  Code: string
  Label: string
  Module: string
}

interface BackendCategoryPermission {
  PermissionId: string
  permission: BackendPermission
}

interface BackendEmployeeCategory {
  Id: string
  Code: string
  Name: string
  Description: string | null
  IsActive: boolean
  categoryPermissions?: BackendCategoryPermission[]
  _count?: { employees: number }
}

function mapCategory(raw: BackendEmployeeCategory): EmployeeCategory {
  return {
    id: raw.Id,
    code: raw.Code,
    name: raw.Name,
    description: raw.Description ?? '',
    isActive: raw.IsActive,
    permissions: (raw.categoryPermissions ?? []).map((cp) => ({
      permissionId: cp.PermissionId,
      code: cp.permission.Code,
      label: cp.permission.Label,
      module: cp.permission.Module,
    })),
    employeeCount: raw._count?.employees ?? 0,
  }
}

export const useEmployeeCategoryStore = defineStore('employeeCategories', () => {
  const categories = ref<EmployeeCategory[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchAll() {
    loading.value = true
    error.value = null
    try {
      const { data } = await api.get<BackendEmployeeCategory[]>('/employee-categories')
      categories.value = data.map(mapCategory)
    } catch (err) {
      error.value = getApiErrorMessage(err, 'Impossible de charger les catégories')
      throw err
    } finally {
      loading.value = false
    }
  }

  async function createCategory(payload: { code: string; name: string; description?: string; isActive?: boolean }) {
    error.value = null
    return withToast('Création de la catégorie en cours…', async () => {
      try {
        const { data } = await api.post<BackendEmployeeCategory>('/employee-categories', {
          Code: payload.code, Name: payload.name, Description: payload.description || undefined, IsActive: payload.isActive ?? true,
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

  async function updateCategory(id: string, payload: { code?: string; name?: string; description?: string; isActive?: boolean }) {
    error.value = null
    return withToast('Enregistrement en cours…', async () => {
      try {
        const body: Record<string, unknown> = {}
        if (payload.code !== undefined) body.Code = payload.code
        if (payload.name !== undefined) body.Name = payload.name
        if (payload.description !== undefined) body.Description = payload.description || null
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

  // Le gabarit CategoryPermission n'est JAMAIS relu pour les comptes deja
  // crees (voir UserService.create cote backend) — ajouter/retirer un droit
  // ici n'affecte que les PROCHAINS comptes crees dans cette categorie.
  async function addPermission(categoryId: string, permissionId: string) {
    error.value = null
    try {
      const { data } = await api.post<BackendEmployeeCategory>(`/employee-categories/${categoryId}/permissions`, {
        PermissionId: permissionId,
      })
      const mapped = mapCategory(data)
      const idx = categories.value.findIndex(c => c.id === categoryId)
      if (idx !== -1) categories.value[idx] = mapped
      return mapped
    } catch (err) {
      error.value = getApiErrorMessage(err, "Impossible d'ajouter cette permission")
      throw err
    }
  }

  async function removePermission(categoryId: string, permissionId: string) {
    error.value = null
    try {
      const { data } = await api.delete<BackendEmployeeCategory>(`/employee-categories/${categoryId}/permissions/${permissionId}`)
      const mapped = mapCategory(data)
      const idx = categories.value.findIndex(c => c.id === categoryId)
      if (idx !== -1) categories.value[idx] = mapped
      return mapped
    } catch (err) {
      error.value = getApiErrorMessage(err, 'Impossible de retirer cette permission')
      throw err
    }
  }

  return {
    categories, loading, error,
    fetchAll, createCategory, updateCategory, deleteCategory, addPermission, removePermission,
  }
})
