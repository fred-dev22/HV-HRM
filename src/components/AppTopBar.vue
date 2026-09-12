<template>
  <!-- ── BARRE 1 : TopBar (sombre) ── -->
  <div class="bg-header text-header-foreground h-11 px-5 flex items-center justify-between shrink-0 relative z-60">
    <div class="flex items-center">
      <span class="text-[15px] font-semibold">{{ t('nav.app_name') }}</span>
    </div>
    <div class="flex items-center gap-2.5" v-if="!searchOpen">
      <button
        :class="[iconBtnClass, 'w-auto px-2 mr-1.5 gap-2 group']"
        @click="openSearch"
        :title="t('topbar.search_placeholder')"
      >
        <Search class="w-4 h-4" />
        <span class="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium text-gray-400 bg-white/10 rounded border border-white/20 group-hover:border-white/30">
          Ctrl+K
        </span>
      </button>
      <div :class="iconBtnClass" :title="t('topbar.notifications')" @click.stop="toggleDropdown('notif')">
        <Bell class="w-4 h-4" />
        <span
          v-if="notifStore.unreadCount > 0"
          class="absolute -top-1 -right-1 bg-destructive text-white text-[9px] w-3.5 h-3.5 rounded-full flex items-center justify-center font-bold"
        >{{ notifStore.unreadCount }}</span>
        <div
          v-if="activeDropdown === 'notif'"
          :class="[dropdownClass, 'min-w-[340px] max-w-[380px] p-0']"
          @click.stop
        >
          <div class="flex items-center justify-between px-4 pt-3 pb-2.5 border-b border-border">
            <div class="flex items-center gap-2">
              <span class="text-[13px] font-bold text-foreground">Notifications</span>
              <span v-if="notifStore.unreadCount > 0" class="bg-primary text-primary-foreground text-[10px] font-semibold px-1.5 py-px rounded-full">
                {{ notifStore.unreadCount }}
              </span>
            </div>
            <button
              v-if="notifStore.unreadCount > 0"
              class="text-[11px] font-medium text-primary cursor-pointer hover:underline"
              @click="notifStore.markAllAsRead()"
            >
              Tout marquer lu
            </button>
          </div>
          <div class="max-h-96 overflow-y-auto">
            <div
              v-for="n in notifStore.notifications"
              :key="n.id"
              class="relative flex gap-2.5 px-4 py-3 border-b border-border last:border-b-0 cursor-pointer transition-colors hover:bg-background"
              :class="{ 'bg-primary/5': !n.read }"
              @click="handleNotifClick(n)"
            >
              <span v-if="!n.read" class="absolute left-0 top-0 bottom-0 w-[3px] bg-primary" title="Non lue"></span>
              <span class="w-8 h-8 rounded-full flex items-center justify-center shrink-0" :class="notifStyle(n.type).wrap">
                <component :is="notifStyle(n.type).icon" class="w-4 h-4" />
              </span>
              <div class="flex-1 min-w-0">
                <span class="block text-[13px] truncate" :class="n.read ? 'font-medium text-foreground' : 'font-bold text-foreground'">{{ n.title }}</span>
                <p class="text-[12px] mt-0.5 line-clamp-2" :class="n.read ? 'text-muted-foreground' : 'text-foreground/80'">{{ n.message }}</p>
                <span class="block text-[11px] text-muted-foreground mt-1">{{ formatRelativeDateTime(n.date) }}</span>
              </div>
            </div>
            <div v-if="notifStore.notifications.length === 0" class="p-6 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
              <BellOff class="w-6 h-6 text-muted-foreground/50" />
              Aucune notification
            </div>
          </div>
        </div>
      </div>
      <button :class="iconBtnClass" :title="t('topbar.settings')">
        <Settings class="w-4 h-4" />
      </button>
      <button :class="iconBtnClass" :title="t('topbar.help')">
        <HelpCircle class="w-4 h-4" />
      </button>
      <button :class="iconBtnClass" title="À propos" @click="showAbout = true">
        <Info class="w-4 h-4" />
      </button>
      <!-- Avatar + menu utilisateur -->
      <div :class="[iconBtnClass, 'w-auto px-1.5 gap-1']" @click.stop="toggleDropdown('user')">
        <UserAvatar :name="user?.name ?? '?'" size="md" />
        <div v-if="activeDropdown === 'user'" :class="[dropdownClass, 'min-w-60 p-0']" @click.stop>

          <!-- En-tête -->
          <div class="flex items-center gap-2.5 px-4 py-3 bg-background border-b border-border">
            <UserAvatar :name="user?.name ?? '?'" size="lg" />
            <div class="min-w-0">
              <div class="text-[13px] font-bold text-foreground truncate">{{ user?.name }}</div>
              <div class="text-[11px] text-muted-foreground mt-0.5 truncate">{{ roleLabel }} · {{ user?.entityName }}</div>
            </div>
          </div>

          <!-- Items principaux -->
          <div :class="dropdownItemClass" @click.stop="goToProfile">
            <CircleUser class="w-4 h-4" /><span>Mon profil</span>
          </div>

          <div class="h-px bg-border my-1"></div>

          <!-- Déconnexion -->
          <div
            class="flex items-center gap-2 px-4 py-[9px] text-[13px] cursor-pointer text-foreground transition-colors hover:bg-danger-bg hover:text-danger"
            @click.stop="handleLogout"
          >
            <LogOut class="w-4 h-4" /><span>{{ t('topbar.logout') }}</span>
          </div>

        </div>
      </div>
    </div>

    <!-- Search -->
    <div v-if="searchOpen" class="flex items-center gap-2 flex-1 justify-end">
      <input
        ref="searchInput"
        class="w-60 bg-white/10 text-white rounded-md px-3 py-1.5 text-[13px] outline-none placeholder:text-gray-500"
        type="text"
        :placeholder="t('topbar.search_placeholder')"
        v-model="searchQuery"
        @keydown.escape="closeSearch"
      />
      <button :class="iconBtnClass" @click="closeSearch"><X class="w-4 h-4" /></button>
    </div>
  </div>

  <AboutModal :open="showAbout" @close="showAbout = false" />
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted, type Component } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  Search, Bell, BellOff, Settings, HelpCircle, Info, CircleUser, LogOut, X,
  CalendarOff, Plane, Receipt, Briefcase, CalendarClock,
} from 'lucide-vue-next'
import UserAvatar from './ui/UserAvatar.vue'
import AboutModal from './AboutModal.vue'
import { useAuthStore } from '../stores/auth'
import { useNotificationStore, type AppNotification } from '../stores/notifications'
import { formatRelativeDateTime } from '../lib/date'
import type { AuthUser } from '../types'

defineProps<{ user: AuthUser | null }>()

const router       = useRouter()
const auth         = useAuthStore()
const notifStore   = useNotificationStore()
const { t } = useI18n()

const iconBtnClass =
  'w-8 h-8 rounded-md flex items-center justify-center cursor-pointer relative shrink-0 text-white transition-colors hover:bg-white/10 select-none'
const dropdownClass =
  'absolute top-[calc(100%+8px)] right-0 bg-popover text-popover-foreground rounded-[10px] shadow-[0_4px_20px_rgba(0,0,0,0.16)] border border-border min-w-[150px] z-[200] p-1 overflow-hidden cursor-default text-left'
const dropdownItemClass =
  'flex items-center gap-2 px-4 py-[9px] text-[13px] cursor-pointer text-foreground transition-colors hover:bg-primary/10 hover:text-primary'

// Icone + couleur par type de notification (voir NotificationService.create
// cote backend pour la liste des types emis). "recruitment" et "reminder"
// n'avaient pas d'entree avant (repli silencieux sur "system", gris neutre) —
// desormais chacun a son icone et sa teinte dediees.
const NOTIF_STYLE: Record<AppNotification['type'], { icon: Component; wrap: string }> = {
  leave:       { icon: CalendarOff,   wrap: 'bg-primary/10 text-primary' },
  mission:     { icon: Plane,         wrap: 'bg-info-bg text-info' },
  expense:     { icon: Receipt,       wrap: 'bg-warning-bg text-warning' },
  recruitment: { icon: Briefcase,     wrap: 'bg-success-bg text-success' },
  reminder:    { icon: CalendarClock, wrap: 'bg-danger-bg text-danger' },
  system:      { icon: Bell,          wrap: 'bg-neutral-bg text-neutral' },
}
function notifStyle(type: AppNotification['type']) {
  return NOTIF_STYLE[type] ?? NOTIF_STYLE.system
}

const roleLabel = computed(() => {
  const map: Record<string, string> = {
    hr_admin:    'RH Administrateur',
    hr_director: 'RH Directeur',
    validator:   'Manager / Validateur',
    employee:    'Employé',
  }
  return map[auth.role ?? ''] ?? ''
})

const activeDropdown = ref<'user' | 'notif' | null>(null)
const searchOpen     = ref(false)
const searchQuery    = ref('')
const searchInput    = ref<HTMLInputElement | null>(null)
const showAbout      = ref(false)

function toggleDropdown(name: 'user' | 'notif') {
  const opening = activeDropdown.value !== name
  activeDropdown.value = opening ? name : null
  if (opening && name === 'notif') notifStore.fetchAll()
}

function handleNotifClick(n: AppNotification) {
  notifStore.markAsRead(n.id)
  if (n.href) {
    activeDropdown.value = null
    router.push(n.href)
  }
}

function goToProfile() {
  activeDropdown.value = null
  router.push(auth.isHRSpace ? { name: 'hr-profile' } : { name: 'employee-profile' })
}

async function openSearch() {
  searchOpen.value = true; await nextTick(); searchInput.value?.focus()
}
function closeSearch() { searchOpen.value = false; searchQuery.value = '' }

function handleLogout() {
  activeDropdown.value = null; auth.logout(); router.push({ name: 'login' })
}

function onDocClick()              { activeDropdown.value = null }
function onKeydown(e: KeyboardEvent) {
  if (e.ctrlKey && e.key === 'k') { e.preventDefault(); openSearch() }
  if (e.key === 'Escape')         { closeSearch(); activeDropdown.value = null }
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKeydown)
  notifStore.fetchAll()
})
onUnmounted(() => { document.removeEventListener('click', onDocClick); document.removeEventListener('keydown', onKeydown) })
</script>
