import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

export const useNavigationStore = defineStore('navigation', () => {
  const activeModule = ref('administration')

  const previousEntityRoute = ref<RouteLocationRaw>({ name: 'hr-entities' })
  const activeEntityTab     = ref('tree')

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
    previousEntityRoute, activeEntityTab,
    setPreviousRoute, setEntityTab,
  }
})
