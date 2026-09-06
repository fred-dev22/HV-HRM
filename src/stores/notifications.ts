import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '../lib/api'

export interface AppNotification {
  id:      string
  type:    'leave' | 'mission' | 'expense' | 'system'
  title:   string
  message: string
  href?:   string
  read:    boolean
  date:    string
}

export interface BackendNotification {
  Id:        string
  Type:      string
  Title:     string
  Message:   string
  Href:      string | null
  IsRead:    boolean
  CreatedAt: string
}

function mapNotification(n: BackendNotification): AppNotification {
  return {
    id: n.Id,
    type: (['leave', 'mission', 'expense', 'system'] as const).includes(n.Type as AppNotification['type'])
      ? (n.Type as AppNotification['type'])
      : 'system',
    title: n.Title,
    message: n.Message,
    href: n.Href ?? undefined,
    read: n.IsRead,
    date: n.CreatedAt,
  }
}

export const useNotificationStore = defineStore('notifications', () => {
  const notifications = ref<AppNotification[]>([])
  const loading = ref(false)

  const unreadCount = computed(() => notifications.value.filter((n) => !n.read).length)

  async function fetchAll() {
    loading.value = true
    try {
      const { data } = await api.get<BackendNotification[]>('/notifications')
      notifications.value = data.map(mapNotification)
    } catch {
      // Silencieux — la cloche reste vide plutot que de bloquer l'affichage
      // du reste de la topbar sur un echec reseau.
    } finally {
      loading.value = false
    }
  }

  // Optimiste (l'utilisateur vient de cliquer, pas de raison d'attendre le
  // serveur pour retirer le point bleu) — revert si l'appel echoue.
  async function markAsRead(id: string) {
    const n = notifications.value.find((n) => n.id === id)
    if (!n || n.read) return
    n.read = true
    try {
      await api.patch(`/notifications/${id}/read`)
    } catch {
      n.read = false
    }
  }

  async function markAllAsRead() {
    const previouslyUnread = notifications.value.filter((n) => !n.read)
    if (previouslyUnread.length === 0) return
    previouslyUnread.forEach((n) => { n.read = true })
    try {
      await api.patch('/notifications/read-all')
    } catch {
      previouslyUnread.forEach((n) => { n.read = false })
    }
  }

  // Pousse une notification recue en direct via WebSocket (voir
  // lib/realtime.ts) — meme forme brute que l'API REST, donc meme mapper.
  function receiveRealtime(raw: BackendNotification) {
    notifications.value.unshift(mapNotification(raw))
  }

  return { notifications, unreadCount, loading, fetchAll, markAsRead, markAllAsRead, receiveRealtime }
})
