import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api, getApiErrorMessage } from '../lib/api'
import { withToast } from '../lib/withToast'

export type StorageProvider = 'Local' | 'Graph'

export interface StorageSettings {
  configured: boolean
  provider: StorageProvider | null
  localPath: string
  // Identifiants et secrets : jamais renvoyes, seulement leur presence et un indice (4 derniers caracteres).
  graph: {
    hasTenantId: boolean; tenantIdHint: string
    hasClientId: boolean; clientIdHint: string
    hasSecret: boolean
    siteHost: string; sitePath: string; uploadPath: string
  }
}

export interface FolderListing {
  path: string // '' = liste des lecteurs
  parent: string | null // null = deja en haut ; '' = retour a la liste des lecteurs
  entries: { name: string; path: string }[]
}

export interface SaveStorageSettingsPayload {
  provider: StorageProvider
  localPath?: string
  graphTenantId?: string
  graphClientId?: string
  graphClientSecret?: string
  graphSiteHost?: string
  graphSitePath?: string
  graphUploadPath?: string
}

// Etat du stockage des fichiers, partage par la bande d'alerte (tous les
// utilisateurs) et l'ecran de configuration (administrateur).
export const useStorageSettingsStore = defineStore('storageSettings', () => {
  // null tant que le serveur n'a pas repondu : la bande ne s'affiche jamais "par erreur".
  const configured = ref<boolean | null>(null)
  const canConfigure = ref<boolean | null>(null)
  const settings = ref<StorageSettings | null>(null)
  const error = ref<string | null>(null)

  async function fetchStatus() {
    try {
      const { data } = await api.get<{ configured: boolean; canConfigure: boolean }>('/storage-settings/status')
      configured.value = data.configured
      canConfigure.value = data.canConfigure
    } catch {
      // Silencieux : un echec de lecture ne doit pas afficher une alerte trompeuse.
    }
  }

  async function fetchSettings() {
    error.value = null
    try {
      const { data } = await api.get<StorageSettings>('/storage-settings')
      settings.value = data
      configured.value = data.configured
    } catch (err) {
      error.value = getApiErrorMessage(err, 'Impossible de charger la configuration du stockage')
      throw err
    }
  }

  async function save(payload: SaveStorageSettingsPayload) {
    error.value = null
    return withToast(
      'Enregistrement de la configuration…',
      async () => {
        try {
          const { data } = await api.put<StorageSettings>('/storage-settings', payload)
          settings.value = data
          configured.value = data.configured
          return data
        } catch (err) {
          error.value = getApiErrorMessage(err, "Impossible d'enregistrer la configuration")
          throw err
        }
      },
      () => error.value ?? 'Enregistrement impossible',
    )
  }

  // Supprime toute la configuration : plus aucun fichier ne peut etre envoye et la bande d'alerte reapparait.
  async function reset() {
    error.value = null
    return withToast(
      'Réinitialisation de la configuration…',
      async () => {
        try {
          const { data } = await api.delete<StorageSettings>('/storage-settings')
          settings.value = data
          configured.value = data.configured
          return data
        } catch (err) {
          error.value = getApiErrorMessage(err, 'Impossible de réinitialiser la configuration')
          throw err
        }
      },
      () => error.value ?? 'Réinitialisation impossible',
    )
  }

  async function test(): Promise<{ ok: boolean; error: string | null }> {
    try {
      const { data } = await api.post<{ ok: boolean; error: string | null }>('/storage-settings/test')
      return data
    } catch (err) {
      return { ok: false, error: getApiErrorMessage(err, 'Impossible de tester le stockage') }
    }
  }

  // Explorateur de dossiers du SERVEUR (path vide = liste des lecteurs).
  async function browse(path = ''): Promise<FolderListing> {
    const { data } = await api.get<FolderListing>('/storage-settings/browse', { params: { path } })
    return data
  }

  async function createFolder(parent: string, name: string): Promise<string> {
    const { data } = await api.post<{ path: string }>('/storage-settings/browse/folder', { parent, name })
    return data.path
  }

  return { configured, canConfigure, settings, error, fetchStatus, fetchSettings, save, reset, test, browse, createFolder }
})
