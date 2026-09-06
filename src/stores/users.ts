import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api, getApiErrorMessage } from '../lib/api'
import { withToast } from '../lib/withToast'

export interface CreateUserAccountPayload {
  employeeId: string
  username: string
  email: string
  password: string
  employeeCategoryId: string
  mustChangePassword: boolean
}

export interface UserPermissionGrant {
  permissionId: string
  code: string
  module: string
  label: string
}

interface EffectivePermissionsResponse {
  categoryName: string
  permissions: string[]
  individualGrants: UserPermissionGrant[]
}

export const useUserStore = defineStore('users', () => {
  const error = ref<string | null>(null)

  async function createUserAccount(payload: CreateUserAccountPayload) {
    error.value = null
    return withToast('Création du compte en cours…', async () => {
      try {
        const { data } = await api.post('/users', {
          Username: payload.username,
          Email: payload.email,
          Password: payload.password,
          EmployeeId: payload.employeeId,
          EmployeeCategoryId: payload.employeeCategoryId,
          IsActive: true,
          MustChangePassword: payload.mustChangePassword,
        })
        return data
      } catch (err) {
        error.value = getApiErrorMessage(err, 'Impossible de créer le compte utilisateur')
        throw err
      }
    }, () => error.value ?? 'Impossible de créer le compte utilisateur')
  }

  // Permissions individuelles d'un compte — indépendantes de la catégorie
  // une fois le compte créé (voir decision du 29/07 : la catégorie n'est
  // qu'un gabarit copié une seule fois à la création du compte).
  async function fetchUserPermissions(userId: string) {
    const { data } = await api.get<EffectivePermissionsResponse>(`/users/${userId}/permissions`)
    return data
  }

  async function grantUserPermission(userId: string, permissionId: string) {
    try {
      const { data } = await api.post<EffectivePermissionsResponse>(`/users/${userId}/permissions`, { PermissionId: permissionId })
      return data
    } catch (err) {
      error.value = getApiErrorMessage(err, "Impossible d'ajouter cette permission")
      throw err
    }
  }

  async function revokeUserPermission(userId: string, permissionId: string) {
    try {
      const { data } = await api.delete<EffectivePermissionsResponse>(`/users/${userId}/permissions/${permissionId}`)
      return data
    } catch (err) {
      error.value = getApiErrorMessage(err, 'Impossible de retirer cette permission')
      throw err
    }
  }

  return { error, createUserAccount, fetchUserPermissions, grantUserPermission, revokeUserPermission }
})
