import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

export const useNavigationStore = defineStore('navigation', () => {
  const activeModule = ref('administration')

  const previousEntityRoute = ref<RouteLocationRaw>({ name: 'hr-entities' })
  const activeEntityTab     = ref('tree')

  // Menu burger (petit ecran) : ouvre la barre laterale en tiroir. Partage
  // entre AppNavBar (bouton) et AppSidebar (tiroir).
  const mobileMenuOpen = ref(false)
  function toggleMobileMenu() { mobileMenuOpen.value = !mobileMenuOpen.value }
  function closeMobileMenu()  { mobileMenuOpen.value = false }

  function setModule(module: string) {
    activeModule.value = module
  }

  function setPreviousRoute(route: RouteLocationRaw) {
    previousEntityRoute.value = route
  }

  function setEntityTab(tab: string) {
    activeEntityTab.value = tab
  }

  return {
    activeModule, setModule,
    mobileMenuOpen, toggleMobileMenu, closeMobileMenu,
    previousEntityRoute, activeEntityTab,
    setPreviousRoute, setEntityTab,
  }
})
