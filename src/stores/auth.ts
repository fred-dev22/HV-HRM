import { defineStore, getActivePinia } from 'pinia'
import { ref, computed } from 'vue'
import type { AuthUser, UserRole } from '../types'
import { api, getStoredToken, setStoredToken, clearStoredToken } from '../lib/api'
import { decodeJwt, isTokenExpired } from '../lib/jwt'
import { connectRealtime, disconnectRealtime } from '../lib/realtime'

// Backend EmployeeCategory.Name (French, librement modifiable/ajoutable par
// un Directeur RH — voir decision du 29/07, "role et categorie c'est la meme
// chose") -> frontend UserRole (snake_case), pour l'affichage uniquement.
// Approximatif dès qu'une catégorie personnalisée est créée ; sans
// conséquence, ça ne sert qu'à choisir une icône/libellé, jamais à décider
// des droits (voir hasPermission) ni de l'espace applicatif (voir isHRSpace
// ci-dessous, qui ne dépend plus du nom de la catégorie).
const CATEGORY_NAME_TO_USER_ROLE: Record<string, UserRole> = {
  'Employé': 'employee',
  'Validateur': 'validator',
  'Cadre supérieur': 'validator',
  'Manager': 'validator',
  'Technicien': 'employee',
  'Admin RH': 'hr_admin',
  'Directeur RH': 'hr_director',
}

// Espace applicatif (routage /hr vs /employee) — décidé par une permission
// réelle, jamais par le NOM de la catégorie : contrairement à l'ancien Role
// (4 rôles système protégés, IsSystem=true), une EmployeeCategory est
// librement renommable/supprimable par un Directeur RH (voir decision du
// 29/07) — un matching par nom casserait silencieusement le routage au
// premier renommage. EMPLOYE_VOIR_TOUT sert de marqueur "fonction RH" :
// seules les catégories Admin RH / Directeur RH l'accordent par défaut.
const HR_SPACE_PERMISSION = 'EMPLOYE_VOIR_TOUT'

interface BackendEmployee {
  Id: string
  FirstName: string
  LastName: string
  FullName: string
  Email: string
  OrganizationUnitId: string
  // Necessaire au filtrage (cote frontend) des types de conge/jours feries
  // restreints par genre/statut expatrie sur le calendrier personnel de
  // l'utilisateur connecte — voir lib/eligibility.ts et DashboardEmployee.vue.
  Gender: string
  IsExpatriate: boolean
}

interface BackendOrganizationUnit {
  Id: string
  Name: string
}

interface EffectivePermissionsResponse {
  categoryName: string
  permissions: string[]
}

export const useAuthStore = defineStore('auth', () => {
  const user        = ref<AuthUser | null>(null)
  const isLoggedIn  = ref(false)
  const isRestoring = ref(false)
  const permissions = ref<string[]>([])
  const categoryName = ref<string | null>(null)
  const mustChangePassword = ref(false)

  // ── Getters ──────────────────────────────────────────────────
  const role         = computed<UserRole | null>(() => user.value?.role ?? null)
  const isValidator  = computed(() => user.value?.role === 'validator')
  const isHRAdmin    = computed(() => user.value?.role === 'hr_admin')
  const isHRDirector = computed(() => user.value?.role === 'hr_director')
  // Espace applicatif uniquement — ne pas s'en servir pour gater une
  // fonctionnalité précise, voir hasPermission() ci-dessous pour ça.
  const isHRSpace       = computed(() => hasPermission(HR_SPACE_PERMISSION))
  const isEmployeeSpace = computed(() => !isHRSpace.value)

  function hasPermission(code: string): boolean {
    return permissions.value.includes(code)
  }
  function hasAnyPermission(codes: string[]): boolean {
    return codes.some((code) => permissions.value.includes(code))
  }

  async function buildAuthUser(employeeId: string, categoryNameValue: string): Promise<AuthUser> {
    const { data: employee } = await api.get<BackendEmployee>(`/employees/${employeeId}`)

    let entityName: string | undefined
    try {
      const { data: unit } = await api.get<BackendOrganizationUnit>(
        `/organization-units/${employee.OrganizationUnitId}`,
      )
      entityName = unit.Name
    } catch {
      entityName = undefined
    }

    return {
      id:         employee.Id,
      name:       employee.FullName,
      initials:   (employee.FirstName.charAt(0) + employee.LastName.charAt(0)).toUpperCase(),
      role:       CATEGORY_NAME_TO_USER_ROLE[categoryNameValue] ?? 'employee',
      email:      employee.Email,
      entityId:   employee.OrganizationUnitId,
      entityName,
      gender:       employee.Gender === 'F' ? 'F' : 'M',
      isExpatriate: employee.IsExpatriate,
    }
  }

  // Toujours relues depuis l'API (jamais figées dans le JWT) — voir backend
  // PermissionGuard : un changement de droit doit s'appliquer immédiatement.
  async function fetchPermissions(userId: string) {
    const { data } = await api.get<EffectivePermissionsResponse>(`/users/${userId}/permissions`)
    permissions.value = data.permissions
  }

  // Tous les autres stores (employees, leaveRequests, missions, expenses...)
  // sont de simples singletons Pinia qui restent en mémoire pour toute la
  // durée de l'onglet — se déconnecter puis se reconnecter avec un autre
  // compte, sans rechargement complet de la page, laissait les anciennes
  // données de l'utilisateur précédent visibles jusqu'à ce que chaque écran
  // pense à les rafraîchir (beaucoup de fetch* ont un garde-fou "si déjà
  // chargé, ne refais rien"). $reset() n'existe pas sur les stores en
  // syntaxe "setup" (composition) qu'utilise tout ce projet — on utilise
  // donc $dispose() sur chaque store actif sauf auth : au prochain
  // useXStore(), Pinia relance sa fonction setup depuis zéro, ce qui
  // réinitialise vraiment ses refs (contrairement à $patch/$reset qui
  // n'existent pas ici). pinia._s est une API interne non documentée mais
  // stable — c'est le contournement standard pour ce besoin avec des stores
  // en syntaxe setup.
  //
  // Exception : les stores UI "singleton racine" (toast, confirmDialog) ne
  // portent aucune donnée utilisateur à rafraîchir, seulement un état
  // d'affichage éphémère — et Snackbar.vue/ConfirmDialog.vue les récupèrent
  // UNE SEULE FOIS dans App.vue (monté en dehors du <RouterView>, jamais
  // recréé). Les disposer ici les orpheline silencieusement : le composant
  // racine garde l'ancienne instance (jamais mise à jour), tandis que
  // withToast()/confirmDialog() recréent une nouvelle instance à chaque
  // appel — plus aucune UI ne réagit. D'où le snackbar qui cessait de
  // s'afficher après un premier login/logout dans l'onglet.
  const UI_SINGLETON_STORE_IDS = new Set(['toast', 'confirmDialog'])
  function resetOtherStores() {
    const pinia = getActivePinia()
    if (!pinia) return
    const activeStores = (pinia as unknown as { _s: Map<string, { $dispose: () => void }> })._s
    for (const [id, store] of activeStores) {
      if (id === 'auth' || UI_SINGLETON_STORE_IDS.has(id)) continue
      store.$dispose()
    }
  }

  // ── Actions ──────────────────────────────────────────────────
  async function login(email: string, password: string) {
    resetOtherStores()
    const { data } = await api.post<{ accessToken: string }>('/auth/login', { email, password })
    setStoredToken(data.accessToken)
    const payload = decodeJwt(data.accessToken)
    categoryName.value = payload.categoryName
    mustChangePassword.value = payload.mustChangePassword
    await fetchPermissions(payload.sub)
    user.value = await buildAuthUser(payload.employeeId, payload.categoryName)
    isLoggedIn.value = true
    connectRealtime()
  }

  // PATCH /auth/change-password renvoie un nouveau token (mustChangePassword
  // à false) — le vieux token en localStorage garderait sinon l'ancien flag
  // jusqu'à expiration.
  async function changePassword(currentPassword: string, newPassword: string) {
    const { data } = await api.patch<{ accessToken: string }>('/auth/change-password', {
      currentPassword, newPassword,
    })
    setStoredToken(data.accessToken)
    mustChangePassword.value = false
  }

  // Called once at app startup so a page refresh doesn't lose the session —
  // the JWT persists in localStorage, only the in-memory state is rebuilt.
  async function restoreSession() {
    const token = getStoredToken()
    if (!token) return

    const payload = decodeJwt(token)
    if (isTokenExpired(payload)) {
      clearStoredToken()
      return
    }

    isRestoring.value = true
    try {
      categoryName.value = payload.categoryName
      mustChangePassword.value = payload.mustChangePassword
      await fetchPermissions(payload.sub)
      user.value = await buildAuthUser(payload.employeeId, payload.categoryName)
      isLoggedIn.value = true
      connectRealtime()
    } catch {
      // Token valid but the employee/session/permissions data couldn't be
      // loaded (deleted employee, deactivated account, backend unreachable,
      // etc.) — treat as logged out.
      clearStoredToken()
      user.value = null
      categoryName.value = null
      permissions.value = []
      isLoggedIn.value = false
      resetOtherStores()
    } finally {
      isRestoring.value = false
    }
  }

  function logout() {
    user.value       = null
    categoryName.value = null
    permissions.value = []
    isLoggedIn.value = false
    mustChangePassword.value = false
    clearStoredToken()
    disconnectRealtime()
    resetOtherStores()
  }

  return {
    user, isLoggedIn, isRestoring, role, categoryName, permissions, mustChangePassword,
    isValidator, isHRAdmin, isHRDirector,
    isHRSpace, isEmployeeSpace,
    hasPermission, hasAnyPermission,
    login, logout, restoreSession, changePassword, resetOtherStores,
  }
})
