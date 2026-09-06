import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api, getApiErrorMessage } from '../lib/api'
import { withToast } from '../lib/withToast'

// Voir Attachment.EntityType (backend schema.prisma) — liste fermee des
// entites pouvant porter des pieces jointes.
export type AttachmentEntityType = 'LeaveRequest' | 'MissionOrder' | 'ExpenseReport' | 'ExpenseLine'

export interface Attachment {
  id: string
  entityType: AttachmentEntityType
  entityId: string
  fileName: string
  fileUrl: string
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
  FileSize: number
  MimeType: string
  CreatedBy: string
  CreatedAt: string
}

function mapAttachment(raw: BackendAttachment): Attachment {
  return {
    id: raw.Id,
    entityType: raw.EntityType,
    entityId: raw.EntityId,
    fileName: raw.FileName,
    fileUrl: raw.FileUrl,
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

  async function upload(entityType: AttachmentEntityType, entityId: string, file: File): Promise<Attachment> {
    error.value = null
    uploading.value = true
    return withToast('Envoi du fichier en cours…', async () => {
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
    }, () => error.value ?? "Impossible d'envoyer le fichier")
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

  return { byEntity, loading, uploading, error, forEntity, fetchByEntity, upload, remove }
})
