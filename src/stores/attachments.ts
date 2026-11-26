import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api, getApiErrorMessage } from '../lib/api'
import { withToast } from '../lib/withToast'
import { useToastStore } from './toast'

// Voir Attachment.EntityType (backend schema.prisma) — liste fermee des
// entites pouvant porter des pieces jointes.
export type AttachmentEntityType = 'LeaveRequest' | 'MissionOrder' | 'ExpenseReport' | 'ExpenseLine'

// Limite du serveur (POST /attachments) : verifiee avant l'envoi pour afficher
// un message en francais plutot que la reponse brute de multer.
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
export const ATTACHMENT_TOO_LARGE_MESSAGE = 'Le fichier dépasse la taille maximale de 10 Mo'

export interface Attachment {
  id: string
  entityType: AttachmentEntityType
  entityId: string
  fileName: string
  fileUrl: string
  // Local = fichier du dossier du serveur (a ouvrir via l'API) ; SharePoint = lien direct.
  storage: 'Local' | 'SharePoint'
  fileSize: number
  mimeType: string
  createdBy: string
  createdAt: string
}

interface BackendAttachment {
  Id: string
  EntityType: AttachmentEntityType
  EntityId: string
  FileName: string
  FileUrl: string
  StorageProvider?: 'Local' | 'SharePoint' | null
  FileSize: number
  MimeType: string
  CreatedBy: string
  CreatedAt: string
}

// Seul un lien SharePoint s'ouvre directement. Tout le reste passe par l'API avec le
// jeton de connexion : fichier du dossier du serveur, et anciens depots dans le
// dossier "uploads" de l'application (sans StorageProvider, plus servis publiquement).
export function storageOf(fileUrl: string, provider?: 'Local' | 'SharePoint' | null): Attachment['storage'] {
  if (provider) return provider
  return /^https:\/\/[^/]+\.sharepoint\.com\//i.test(fileUrl) ? 'SharePoint' : 'Local'
}

function mapAttachment(raw: BackendAttachment): Attachment {
  return {
    id: raw.Id,
    entityType: raw.EntityType,
    entityId: raw.EntityId,
    fileName: raw.FileName,
    fileUrl: raw.FileUrl,
    storage: storageOf(raw.FileUrl, raw.StorageProvider),
    fileSize: raw.FileSize,
    mimeType: raw.MimeType,
    createdBy: raw.CreatedBy,
    createdAt: raw.CreatedAt,
  }
}

export const useAttachmentStore = defineStore('attachments', () => {
  // Indexees par "entityType:entityId" — plusieurs fiches (ex: sidebar de
  // navigation entre notes de frais) peuvent afficher des pieces jointes
  // differentes en meme temps.
  const byEntity = ref<Record<string, Attachment[]>>({})
  const loading = ref(false)
  const uploading = ref(false)
  const error = ref<string | null>(null)

  function key(entityType: AttachmentEntityType, entityId: string) {
    return `${entityType}:${entityId}`
  }

  function forEntity(entityType: AttachmentEntityType, entityId: string): Attachment[] {
    return byEntity.value[key(entityType, entityId)] ?? []
  }

  async function fetchByEntity(entityType: AttachmentEntityType, entityId: string) {
    loading.value = true
    error.value = null
    try {
      const { data } = await api.get<BackendAttachment[]>('/attachments', { params: { entityType, entityId } })
      byEntity.value[key(entityType, entityId)] = data.map(mapAttachment)
    } catch (err) {
      error.value = getApiErrorMessage(err, 'Impossible de charger les pièces jointes')
      throw err
    } finally {
      loading.value = false
    }
  }

  // silent : pas de toast propre, quand l'envoi n'est qu'une etape d'une
  // action plus large qui affiche deja le sien (ex: creation + envoi du
  // justificatif + soumission d'une demande de conge).
  async function upload(
    entityType: AttachmentEntityType,
    entityId: string,
    file: File,
    opts: { silent?: boolean } = {},
  ): Promise<Attachment> {
    error.value = null
    uploading.value = true
    const run = async () => {
      try {
        const form = new FormData()
        form.append('EntityType', entityType)
        form.append('EntityId', entityId)
        form.append('file', file)
        const { data } = await api.post<BackendAttachment>('/attachments', form)
        const mapped = mapAttachment(data)
        const k = key(entityType, entityId)
        byEntity.value[k] = [mapped, ...(byEntity.value[k] ?? [])]
        return mapped
      } catch (err) {
        error.value = getApiErrorMessage(err, "Impossible d'envoyer le fichier")
        throw err
      } finally {
        uploading.value = false
      }
    }
    if (opts.silent) return run()
    return withToast('Envoi du fichier en cours…', run, () => error.value ?? "Impossible d'envoyer le fichier")
  }

  async function remove(id: string, entityType: AttachmentEntityType, entityId: string) {
    error.value = null
    return withToast('Suppression en cours…', async () => {
      try {
        await api.delete(`/attachments/${id}`)
        const k = key(entityType, entityId)
        byEntity.value[k] = (byEntity.value[k] ?? []).filter(a => a.id !== id)
      } catch (err) {
        error.value = getApiErrorMessage(err, 'Impossible de supprimer la pièce jointe')
        throw err
      }
    }, () => error.value ?? 'Impossible de supprimer la pièce jointe')
  }

  // Lien a afficher : un fichier du serveur n'a pas d'adresse publique (l'ouverture passe par open()).
  function linkOf(a: Pick<Attachment, 'storage' | 'fileUrl'>): string {
    return a.storage === 'Local' ? '#' : a.fileUrl
  }

  // Ouvre le fichier dans un nouvel onglet. SharePoint : lien direct. Fichier du serveur :
  // telecharge avec le jeton de connexion puis l'affiche (le navigateur ne peut pas envoyer
  // le jeton par un simple lien). L'onglet est ouvert tout de suite pour ne pas etre bloque
  // par le navigateur, puis rempli une fois le fichier recu.
  async function open(a: Pick<Attachment, 'id' | 'storage' | 'fileUrl'>) {
    if (a.storage !== 'Local') {
      window.open(a.fileUrl, '_blank', 'noopener')
      return
    }
    const tab = window.open('', '_blank')
    try {
      const res = await api.get<Blob>(`/attachments/${a.id}/download`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      if (tab) tab.location.href = url
      else window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000)
    } catch (err) {
      tab?.close()
      useToastStore().error(getApiErrorMessage(err, "Impossible d'ouvrir le fichier"))
    }
  }

  return { byEntity, loading, uploading, error, forEntity, fetchByEntity, upload, remove, open, linkOf }
})
