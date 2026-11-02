import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '../lib/api'

export interface AppNotification {
  id:      string
  type:    'leave' | 'mission' | 'expense' | 'recruitment' | 'reminder' | 'system'
  title:   string
  message: string
  href?:   string
  read:    boolean
  date:    string
}

const KNOWN_TYPES = ['leave', 'mission', 'expense', 'recruitment', 'reminder', 'system'] as const

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
    type: (KNOWN_TYPES as readonly string[]).includes(n.Type)
      ? (n.Type as AppNotification['type'])
      : 'system',
    title: n.Title,
    message: n.Message,
    href: n.Href ?? undefined,
    read: n.IsRead,
    date: n.CreatedAt,
  }
}

const PAGE_SIZE = 20
// Au-dela, la liste deja chargee est rechargee a l'ouverture de la cloche
// (filet de securite si le temps reel a ete coupe un moment).
const STALE_AFTER_MS = 2 * 60 * 1000

export const useNotificationStore = defineStore('notifications', () => {
  const notifications = ref<AppNotification[]>([])
  const loading = ref(false)
  const loadingMore = ref(false)
  const hasMore = ref(false)
  const loaded = ref(false)
  let loadedAt = 0
  // Compte reel en base (GET /notifications/unread-count) : le badge ne depend
  // pas de ce qui est charge dans la liste.
  const unread = ref(0)

  const unreadCount = computed(() => unread.value)

  // A la connexion : un simple compteur, pas la liste.
  async function fetchUnreadCount() {
    try {
      const { data } = await api.get<{ count: number }>('/notifications/unread-count')
      unread.value = data.count
    } catch {
      // Silencieux — le badge reste a sa valeur precedente.
    }
  }

  // Premiere page (les plus recentes).
  async function fetchAll() {
    loading.value = true
    try {
      const { data } = await api.get<BackendNotification[]>('/notifications', { params: { take: PAGE_SIZE } })
      notifications.value = data.map(mapNotification)
      hasMore.value = data.length === PAGE_SIZE
      loaded.value = true
      loadedAt = Date.now()
    } catch {
      // Silencieux — la cloche reste vide plutot que de bloquer l'affichage
      // du reste de la topbar sur un echec reseau.
    } finally {
      loading.value = false
    }
  }

  // A l'ouverture de la cloche : charge seulement si besoin.
  async function ensureLoaded() {
    if (!loaded.value || Date.now() - loadedAt > STALE_AFTER_MS) await fetchAll()
  }

  // Page suivante, declenchee par le defilement de la liste.
  async function fetchMore() {
    const last = notifications.value[notifications.value.length - 1]
    if (!hasMore.value || loadingMore.value || !last) return
    loadingMore.value = true
    try {
      const { data } = await api.get<BackendNotification[]>('/notifications', { params: { take: PAGE_SIZE, before: last.date } })
      const known = new Set(notifications.value.map((n) => n.id))
      notifications.value.push(...data.filter((n) => !known.has(n.Id)).map(mapNotification))
      hasMore.value = data.length === PAGE_SIZE
    } catch {
      // Silencieux — le prochain defilement reessaiera.
    } finally {
      loadingMore.value = false
    }
  }

  // Optimiste (l'utilisateur vient de cliquer, pas de raison d'attendre le
  // serveur pour retirer le point bleu) — revert si l'appel echoue.
  async function markAsRead(id: string) {
    const n = notifications.value.find((n) => n.id === id)
    if (!n || n.read) return
    n.read = true
    unread.value = Math.max(0, unread.value - 1)
    try {
      await api.patch(`/notifications/${id}/read`)
    } catch {
      n.read = false
      unread.value += 1
    }
  }

  async function markAllAsRead() {
    const previouslyUnread = notifications.value.filter((n) => !n.read)
    const previousCount = unread.value
    if (previousCount === 0 && previouslyUnread.length === 0) return
    previouslyUnread.forEach((n) => { n.read = true })
    unread.value = 0
    try {
      await api.patch('/notifications/read-all')
    } catch {
      previouslyUnread.forEach((n) => { n.read = false })
      unread.value = previousCount
    }
  }

  // Pousse une notification recue en direct via WebSocket (voir
  // lib/realtime.ts) — meme forme brute que l'API REST, donc meme mapper.
  function receiveRealtime(raw: BackendNotification) {
    if (!raw.IsRead) unread.value += 1
    if (loaded.value && !notifications.value.some((n) => n.id === raw.Id)) {
      notifications.value.unshift(mapNotification(raw))
    }
  }

  return { notifications, unreadCount, loading, loadingMore, hasMore, fetchUnreadCount, fetchAll, ensureLoaded, fetchMore, markAsRead, markAllAsRead, receiveRealtime }
})
