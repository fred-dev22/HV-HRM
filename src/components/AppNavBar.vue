<template>
  <!-- ── BARRE 2 : NavBar (blanche) ── -->
  <div class="bg-nav h-12 px-5 border-b border-black/10 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex items-center shrink-0">
    <div class="flex items-center shrink-0">
      <img src="/hv-logo.png" class="h-7 object-contain" alt="HV" />
    </div>

    <!-- Items HR -->
    <div class="ml-auto hidden md:flex" v-if="auth.isHRSpace && !isMobileMenuOpen">
      <div
        v-for="item in hrNavItems"
        :key="item.key"
        :class="navItemOuterClass"
        @click="handleHRNav(item.key)"
      ><span :class="[navItemInnerClass, navStore.activeModule === item.key ? navItemActiveClass : 'border-transparent']">{{ item.label }}</span></div>
    </div>

    <!-- Items Employé / Validateur -->
    <div class="ml-auto hidden md:flex" v-if="auth.isEmployeeSpace && !isMobileMenuOpen">
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
      @click="isMobileMenuOpen = !isMobileMenuOpen"
    >
      <X v-if="isMobileMenuOpen" class="w-5 h-5" />
      <Menu v-else class="w-5 h-5" />
    </button>
  </div>

  <!-- Mobile overlay + menu -->
  <div v-if="isMobileMenuOpen" class="fixed inset-0 bg-black/30 z-[140] md:hidden" @click="isMobileMenuOpen = false"></div>
  <div v-if="isMobileMenuOpen" class="fixed top-[92px] inset-x-0 bg-white border-b border-border shadow-lg z-[150] py-2 md:hidden">
    <template v-if="auth.isHRSpace">
      <div v-for="item in hrNavItems" :key="item.key"
        :class="mobileItemClass" @click="handleHRNav(item.key); isMobileMenuOpen = false">
        {{ item.label }}
      </div>
    </template>
    <template v-else>
      <template v-for="item in empNavItems" :key="item.key">
        <router-link v-if="item.to" :to="item.to" :class="mobileItemClass" @click="isMobileMenuOpen = false">
          {{ item.label }}
        </router-link>
        <div v-else :class="[mobileItemClass, 'opacity-40 cursor-not-allowed']">{{ item.label }}</div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { X, Menu } from 'lucide-vue-next'
import { useAuthStore } from '../stores/auth'
import { useNavigationStore } from '../stores/navigation'
import { useLeaveRequestStore } from '../stores/leaveRequests'
import { PLACEHOLDER_MODULES_ENABLED, RECRUITMENT_MODULE_ENABLED } from '../config/features'

const router       = useRouter()
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
const mobileItemClass =
  'flex items-center px-5 py-3 text-sm font-medium text-foreground/80 cursor-pointer border-b border-border last:border-0 no-underline hover:bg-background hover:text-primary'

// 'administration' contient des fonctionnalités réelles couvertes par des
// permissions — masqué si l'utilisateur n'en a aucune. 'recruitment' a son
// propre flag (RECRUITMENT_MODULE_ENABLED, vrais écrans sur cette branche).
// 'training'/'payroll'/'reports' restent des modules placeholder (voir
// PLACEHOLDER_MODULES_ENABLED, src/config/features.ts) — masqués tant
// qu'ils ne sont pas construits.
const hrNavItems = computed(() => [
  { key: 'administration', label: t('nav.admin'), visible: auth.hasAnyPermission([
    'EMPLOYE_VOIR_TOUT', 'EMPLOYE_VOIR_EQUIPE', 'ENTITE_VOIR',
    'MISSION_VOIR_TOUT', 'MISSION_VOIR_EQUIPE', 'FRAIS_VOIR_TOUT', 'FRAIS_VOIR_EQUIPE',
    'CONGE_VOIR_TOUT', 'CONGE_VOIR_EQUIPE',
    'CONFIG_CALENDRIER', 'CONFIG_FRAIS_MISSION',
  ]) },
  { key: 'recruitment', label: t('nav.recruitment'), visible: RECRUITMENT_MODULE_ENABLED && auth.hasPermission('RECRUTEMENT_ACCES') },
  { key: 'training',    label: t('nav.training'),    visible: PLACEHOLDER_MODULES_ENABLED },
  { key: 'payroll',     label: t('nav.payroll'),      visible: PLACEHOLDER_MODULES_ENABLED },
  { key: 'reports', label: t('nav.reports'), visible: PLACEHOLDER_MODULES_ENABLED && auth.hasAnyPermission(['RAPPORT_VOIR', 'ENTITE_VOIR']) },
].filter((item) => item.visible))

// Ne pose plus navStore.setModule(key) ici : l'onglet actif ET la sidebar
// suivent tous les deux navigationStore.activeModule, mais desormais deduit
// UNIQUEMENT de l'URL reelle par le garde de navigation (moduleForPath,
// voir router/index.ts), a chaque navigation qui aboutit. Le poser ici en
// plus, de façon optimiste avant meme que router.push() ait fini, creait un
// etat incoherent des que la navigation n'aboutissait pas exactement au nom
// de route attendu (redirection d'un garde, navigation dupliquee...) :
// l'onglet et la sidebar basculaient sur le module cible alors que le
// contenu affiche restait sur l'ancienne page.
function handleHRNav(key: string) {
  const defaults: Record<string, string> = {
    administration: 'hr-dashboard',
    recruitment:    'hr-recruitment',
    training:       'hr-training',
    payroll:        'hr-payroll',
    reports:        'hr-reports',
  }
  if (defaults[key]) router.push({ name: defaults[key] })
}

interface NavItem { key: string; label: string; to?: { name: string }; badge?: number }

const pendingCount = computed(() => leaveStore.pendingForMe.length)

const empNavItems = computed<NavItem[]>(() => [
  { key: 'my-space', label: t('nav.my_space'), to: { name: 'employee-dashboard' }, badge: pendingCount.value },
])

const contextLabel = computed(() => {
  if (auth.isHRDirector) return 'DIRECTEUR RH · HV'
  if (auth.isHRAdmin)    return t('nav.context_rh')
  if (auth.isValidator)  return 'MANAGER · HV'
  return t('nav.context_employee')
})

const isMobileMenuOpen = ref(false)
</script>
