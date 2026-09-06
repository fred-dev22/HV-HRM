import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api, getApiErrorMessage } from '../lib/api'

// Catalogue fixe des permissions atomiques (voir prisma/seed.ts côté
// backend) — lecture seule, jamais créé/modifié depuis l'UI.
export interface Permission {
  id: string
  code: string
  label: string
  module: string
}

interface BackendPermission {
  Id: string
  Code: string
  Label: string
  Module: string
}

function mapPermission(raw: BackendPermission): Permission {
  return { id: raw.Id, code: raw.Code, label: raw.Label, module: raw.Module }
}

export const usePermissionStore = defineStore('permissions', () => {
  const permissions = ref<Permission[]>([])
  const error = ref<string | null>(null)

  async function fetchAll() {
    error.value = null
    try {
      const { data } = await api.get<BackendPermission[]>('/permissions')
      permissions.value = data.map(mapPermission)
    } catch (err) {
      error.value = getApiErrorMessage(err, 'Impossible de charger le catalogue de permissions')
      throw err
    }
  }

  return { permissions, error, fetchAll }
})
