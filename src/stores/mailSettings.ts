import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api, getApiErrorMessage } from '../lib/api'
import { withToast } from '../lib/withToast'

export type MailProvider = 'Graph' | 'Smtp'

export interface MailSettings {
  configured: boolean
  source: 'database' | 'none'
  provider: MailProvider | null
  sender: string
  // Identifiants et secrets : jamais renvoyes, seulement leur presence et un indice (4 derniers caracteres).
  graph: { hasTenantId: boolean; tenantIdHint: string; hasClientId: boolean; clientIdHint: string; hasSecret: boolean }
  smtp: { host: string; port: number; secure: boolean; hasUser: boolean; userHint: string; hasPassword: boolean }
}

export interface SaveMailSettingsPayload {
  provider: MailProvider
  sender: string
  graphTenantId?: string
  graphClientId?: string
  graphClientSecret?: string
  smtpHost?: string
  smtpPort?: number
  smtpSecure?: boolean
  smtpAuth?: boolean
  smtpUser?: string
  smtpPassword?: string
}

// Etat des emails, partage par la bande d'alerte (tous les utilisateurs) et
// l'ecran de configuration (administrateur).
export const useMailSettingsStore = defineStore('mailSettings', () => {
  // null tant que le serveur n'a pas repondu : la bande ne s'affiche jamais "par erreur".
  const configured = ref<boolean | null>(null)
  // Vrai seulement pour le compte administrateur de lancement (seul a voir le bouton vers les parametres).
  const canConfigure = ref<boolean | null>(null)
  const settings = ref<MailSettings | null>(null)
  const error = ref<string | null>(null)

  async function fetchStatus() {
    try {
      const { data } = await api.get<{ configured: boolean; canConfigure: boolean }>('/mail-settings/status')
      configured.value = data.configured
      canConfigure.value = data.canConfigure
    } catch {
      // Silencieux : un echec de lecture ne doit pas afficher une alerte trompeuse.
    }
  }

  async function fetchSettings() {
    error.value = null
    try {
      const { data } = await api.get<MailSettings>('/mail-settings')
      settings.value = data
      configured.value = data.configured
    } catch (err) {
      error.value = getApiErrorMessage(err, 'Impossible de charger la configuration des emails')
      throw err
    }
  }

  async function save(payload: SaveMailSettingsPayload) {
    error.value = null
    return withToast(
      'Enregistrement de la configuration…',
      async () => {
        try {
          const { data } = await api.put<MailSettings>('/mail-settings', payload)
          settings.value = data
          configured.value = data.configured
          return data
        } catch (err) {
          // Renseigne error AVANT que withToast ne lise son message.
          error.value = getApiErrorMessage(err, "Impossible d'enregistrer la configuration")
          throw err
        }
      },
      () => error.value ?? 'Enregistrement impossible',
    )
  }

  async function sendTest(to: string): Promise<{ ok: boolean; error: string | null }> {
    try {
      const { data } = await api.post<{ ok: boolean; error: string | null }>('/mail-settings/test', { to })
      return data
    } catch (err) {
      return { ok: false, error: getApiErrorMessage(err, "Impossible d'envoyer l'email de test") }
    }
  }

  return { configured, canConfigure, settings, error, fetchStatus, fetchSettings, save, sendTest }
})
