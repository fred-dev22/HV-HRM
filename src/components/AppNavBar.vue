<template>
  <!-- ── BARRE 2 : NavBar (blanche) ── -->
  <div class="bg-nav h-12 px-5 border-b border-black/10 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex items-center shrink-0">
    <div class="flex items-center shrink-0">
      <img v-if="$brandLogo" :src="$brandLogo" class="h-7 object-contain" :alt="$brand.shortName" />
    </div>

    <!-- Items HR -->
    <div class="ml-auto hidden md:flex" v-if="auth.isHRSpace">
      <div
        v-for="item in hrNavItems"
        :key="item.key"
        :class="navItemOuterClass"
        @click="handleHRNav(item.key)"
      ><span :class="[navItemInnerClass, navStore.activeModule === item.key ? navItemActiveClass : 'border-transparent']">{{ item.label }}</span></div>
    </div>

    <!-- Items Employé / Validateur -->
    <div class="ml-auto hidden md:flex" v-if="auth.isEmployeeSpace">
      <template v-for="item in empNavItems" :key="item.key">
        <router-link
          v-if="item.to"
          :to="item.to"
          :class="[navItemClass, route.name === item.to.name ? navItemActiveClass : 'border-transparent']"
        >
          {{ item.label }}
          <span v-if="item.badge && item.badge > 0" class="bg-primary text-white text-[9px] font-bold px-[5px] py-px rounded-full">{{ item.badge }}</span>
        </router-link>
        <div v-else :class="[navItemClass, 'border-transparent opacity-40 cursor-not-allowed']">{{ item.label }}</div>
      </template>
    </div>

    <div class="flex items-center ml-auto md:ml-0">
      <div :class="[navDividerClass, 'hidden md:block']"></div>
      <span class="hidden md:block text-[11px] font-semibold text-primary tracking-[0.04em] whitespace-nowrap">{{ contextLabel }}</span>
    </div>

    <button
      class="w-8 h-8 rounded-md items-center justify-center cursor-pointer text-muted-foreground transition-colors hover:bg-background flex md:hidden ml-2"
      @click="navStore.toggleMobileMenu()"
    >
      <X v-if="navStore.mobileMenuOpen" class="w-5 h-5" />
      <Menu v-else class="w-5 h-5" />
    </button>
  </div>

  <!-- Mobile : voile derriere le tiroir (la barre laterale, voir AppSidebar). -->
  <div v-if="navStore.mobileMenuOpen" class="fixed inset-0 bg-black/30 z-[140] md:hidden" @click="navStore.closeMobileMenu()"></div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { X, Menu } from 'lucide-vue-next'
import { useAuthStore } from '../stores/auth'
import { useNavigationStore } from '../stores/navigation'
import { useLeaveRequestStore } from '../stores/leaveRequests'
import { useHrModules } from '../composables/useHrModules'
import { brand } from '../config/appConfig'

const route        = useRoute()
const auth         = useAuthStore()
const navStore     = useNavigationStore()
const leaveStore   = useLeaveRequestStore()
const { t }        = useI18n()

if (auth.hasPermission('CONGE_VALIDER') && leaveStore.pendingForMe.length === 0) leaveStore.fetchPendingForMe()

const navDividerClass = 'w-px h-5 bg-black/10 mx-3.5 shrink-0'
// Pas de border-transparent en base ici non plus — meme raison que
// navItemInnerClass plus bas (conflit border-primary/border-transparent a
// specificite egale). L'etat actif est determine via la route courante
// plutot que via active-class de RouterLink, pour garder les deux classes
// de couleur de bordure mutuellement exclusives (voir isMySpaceActive).
const navItemClass =
  'h-12 px-3.5 flex items-center gap-1 text-sm font-medium text-muted-foreground border-b-2 cursor-pointer whitespace-nowrap transition-all select-none no-underline hover:text-foreground hover:bg-black/[0.03]'
// Items HR (div, pas router-link) : le soulignement actif est porte par un
// span interne colle au texte (pb-1) plutot que par le conteneur h-12 entier
// — sinon la bordure se retrouve tout en bas de la barre, loin du texte
// centre verticalement.
const navItemOuterClass =
  'h-12 px-3.5 flex items-center text-sm font-medium text-muted-foreground cursor-pointer whitespace-nowrap transition-all select-none no-underline hover:text-foreground hover:bg-black/[0.03]'
// Pas de border-transparent ici : combinee avec navItemActiveClass sur le
// meme element, elle gagnerait toujours sur border-primary (Tailwind genere
// .border-transparent apres .border-primary dans la feuille compilee, donc
// meme specificite = le dernier declare l'emporte, quel que soit l'ordre des
// classes dans le HTML). Les deux doivent rester mutuellement exclusives —
// voir binding ternaire dans le template.
const navItemInnerClass = 'inline-flex items-center gap-1 border-b-2 pb-1 transition-colors'
const navItemActiveClass = 'text-primary border-primary font-semibold'
const { hrNavItems, handleHRNav } = useHrModules()

interface NavItem { key: string; label: string; to?: { name: string }; badge?: number }

const pendingCount = computed(() => leaveStore.pendingForMe.length)

const empNavItems = computed<NavItem[]>(() => [
  { key: 'my-space', label: t('nav.my_space'), to: { name: 'employee-dashboard' }, badge: pendingCount.value },
])

const contextLabel = computed(() => {
  if (auth.isHRDirector) return `DIRECTEUR RH · ${brand.shortName}`
  if (auth.isHRAdmin)    return t('nav.context_rh')
  if (auth.isValidator)  return `MANAGER · ${brand.shortName}`
  return t('nav.context_employee')
})
</script>
