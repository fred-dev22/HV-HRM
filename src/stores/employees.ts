import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api, getApiErrorMessage } from '../lib/api'
import { withToast } from '../lib/withToast'
import { useEntityStore } from './entities'
import { usePositionStore } from './positions'
import { useEmployeeCategoryStore } from './employeeCategories'
import type { Employee, ContractType, EmployeeStatus } from '../types'

// Permissions considérées comme "capacité de valider" pour le KPI Managers/RH
// — un employé compte comme validateur potentiel si la catégorie de son
// compte accorde au moins un de ces droits (voir stores/employeeCategories.ts).
const VALIDATOR_PERMISSION_CODES = new Set(['CONGE_VALIDER', 'MISSION_VALIDER', 'FRAIS_VALIDER'])

const PALETTE = [
  { bg: '#B5D4F4', text: '#0C447C' },
  { bg: '#C0DD97', text: '#3B6D11' },
  { bg: '#F4C0D1', text: '#72243E' },
  { bg: '#FAC775', text: '#633806' },
  { bg: '#AFA9EC', text: '#3C3489' },
  { bg: '#B8E8D8', text: '#1A6B4B' },
  { bg: '#FAD9B0', text: '#7A3B09' },
]

function p(i: number) { return PALETTE[i % PALETTE.length]! }

const CONTRACT_TYPE_TO_BACKEND: Record<ContractType, string> = {
  CDI: 'Permanent', CDD: 'FixedTerm', Stage: 'Internship', Freelance: 'Freelance',
  Apprenti: 'Apprenticeship', Alternant: 'WorkStudy',
}
const CONTRACT_TYPE_FROM_BACKEND: Record<string, ContractType> = {
  Permanent: 'CDI', FixedTerm: 'CDD', Internship: 'Stage', Freelance: 'Freelance',
  Apprenticeship: 'Apprenti', WorkStudy: 'Alternant',
}
const STATUS_TO_BACKEND: Record<EmployeeStatus, string> = {
  active: 'Active', trial: 'OnTrial', onleave: 'OnLeave', inactive: 'Inactive',
}
const STATUS_FROM_BACKEND: Record<string, EmployeeStatus> = {
  Active: 'active', OnTrial: 'trial', OnLeave: 'onleave', Inactive: 'inactive',
}

// ── Backend <-> frontend mapping ────────────────────────────────
// Employee n'a pas de colonne JobTitle libre (seulement PositionId, une FK
// vers le module Position), pas de ManagerId propre (dérivé du responsable
// de l'OrganizationUnit de rattachement). hasAccount reflète la vraie
// colonne backend Employee.UserId ; les droits effectifs d'un compte sont
// portés par sa Catégorie (voir stores/employeeCategories.ts), plus aucun
// "rôle" séparé/mock côté Employee (voir decision du 29/07).
interface BackendEmployee {
  Id: string
  EmployeeNumber: string
  FirstName: string
  LastName: string
  FullName: string
  Gender: string
  BirthDate: string
  BirthPlace: string | null
  MaritalStatus: string
  IdType: string
  IdNumber: string | null
  MobilePhone: string | null
  WorkPhone: string | null
  Email: string
  ContractType: string
  HireDate: string
  TerminationDate: string | null
  PositionId: string | null
  OrganizationUnitId: string
  EmployeeCategoryId: string | null
  UserId: string | null
  Status: string
  IsExpatriate: boolean
}

function mapEmployee(raw: BackendEmployee, paletteIndex: number): Employee {
  const position = raw.PositionId
    ? usePositionStore().positions.find(p => p.id === raw.PositionId)
    : undefined
  const entity = useEntityStore().getEntityById(raw.OrganizationUnitId)
  const c = p(paletteIndex)

  return {
    id:           raw.Id,
    code:         raw.EmployeeNumber,
    firstName:    raw.FirstName,
    lastName:     raw.LastName,
    name:         raw.FullName,
    initials:     (raw.FirstName.charAt(0) + raw.LastName.charAt(0)).toUpperCase(),
    avatarBg:     c.bg,
    avatarText:   c.text,
    jobTitle:     position?.title ?? '',
    positionId:   raw.PositionId ?? undefined,
    entityId:     raw.OrganizationUnitId,
    entityName:   entity?.name,
    email:        raw.Email,
    phone:        raw.MobilePhone ?? raw.WorkPhone ?? undefined,
    hireDate:     raw.HireDate,
    contractType: CONTRACT_TYPE_FROM_BACKEND[raw.ContractType] ?? 'CDI',
    status:       STATUS_FROM_BACKEND[raw.Status] ?? 'active',
    managerId:    entity?.managerId ?? undefined,
    gender:        raw.Gender === 'F' ? 'F' : 'M',
    birthDate:     raw.BirthDate,
    birthPlace:    raw.BirthPlace ?? undefined,
    maritalStatus: (raw.MaritalStatus as Employee['maritalStatus']) ?? 'Single',
    idType:        (raw.IdType as Employee['idType']) ?? 'NationalId',
    idNumber:      raw.IdNumber ?? undefined,
    employeeCategoryId: raw.EmployeeCategoryId ?? undefined,
    hasAccount:   raw.UserId != null,
    userId:       raw.UserId ?? undefined,
    isExpatriate: raw.IsExpatriate,
  }
}

// Reponse allegee de GET /employees/directory — accessible a tout compte
// authentifie, sans EMPLOYE_VOIR_TOUT/EQUIPE (voir employee.service.ts
// findDirectory) : juste ce qu'il faut pour peupler un selecteur de
// beneficiaire/interimaire (n'importe qui peut soumettre pour n'importe
// qui, decision du 01/08), sans exposer les champs sensibles de findAll().
interface BackendDirectoryEmployee {
  Id: string
  FirstName: string
  LastName: string
  FullName: string
  EmployeeNumber: string
  OrganizationUnitId: string
  EmployeeCategoryId: string | null
  Status: string
  IsExpatriate: boolean
  // Necessaire au filtrage des types de conge/jours feries restreints par
  // genre (voir lib/eligibility.ts) — pas une donnee sensible au meme titre
  // que les autres champs qu'omet cette reponse allegee (voir sa doc).
  Gender: string
}

// Complete les champs absents de la reponse allegee par des valeurs neutres
// — jamais lus par les ecrans qui consomment ce mapping (selecteurs), donc
// sans consequence, contrairement a mapEmployee() qui alimente aussi les
// fiches employe completes. Exception : gender/isExpatriate ci-dessous, bien
// reels (pas neutres), necessaires au filtrage d'eligibilite.
function mapDirectoryEmployee(raw: BackendDirectoryEmployee, paletteIndex: number): Employee {
  const entity = useEntityStore().getEntityById(raw.OrganizationUnitId)
  const c = p(paletteIndex)
  return {
    id:           raw.Id,
    code:         raw.EmployeeNumber,
    firstName:    raw.FirstName,
    lastName:     raw.LastName,
    name:         raw.FullName,
    initials:     (raw.FirstName.charAt(0) + raw.LastName.charAt(0)).toUpperCase(),
    avatarBg:     c.bg,
    avatarText:   c.text,
    jobTitle:     '',
    entityId:     raw.OrganizationUnitId,
    entityName:   entity?.name,
    hireDate:     '',
    contractType: 'CDI',
    status:       STATUS_FROM_BACKEND[raw.Status] ?? 'active',
    managerId:    entity?.managerId ?? undefined,
    gender:        raw.Gender === 'F' ? 'F' : 'M',
    birthDate:     '',
    maritalStatus: 'Single',
    idType:        'NationalId',
    employeeCategoryId: raw.EmployeeCategoryId ?? undefined,
    hasAccount:   false,
    isExpatriate: raw.IsExpatriate,
  }
}

function toBackendPayload(payload: Partial<Employee>): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  if (payload.code !== undefined) body.EmployeeNumber = payload.code
  if (payload.firstName !== undefined) body.FirstName = payload.firstName
  if (payload.lastName !== undefined) body.LastName = payload.lastName
  if (payload.gender !== undefined) body.Gender = payload.gender
  if (payload.birthDate !== undefined) body.BirthDate = payload.birthDate
  if (payload.birthPlace !== undefined) body.BirthPlace = payload.birthPlace || undefined
  if (payload.maritalStatus !== undefined) body.MaritalStatus = payload.maritalStatus
  if (payload.idType !== undefined) body.IdType = payload.idType
  if (payload.idNumber !== undefined) body.IdNumber = payload.idNumber || undefined
  if (payload.phone !== undefined) body.MobilePhone = payload.phone || undefined
  if (payload.email !== undefined) body.Email = payload.email
  if (payload.contractType !== undefined) body.ContractType = CONTRACT_TYPE_TO_BACKEND[payload.contractType]
  if (payload.hireDate !== undefined) body.HireDate = payload.hireDate
  if (payload.positionId !== undefined) body.PositionId = payload.positionId || null
  if (payload.entityId !== undefined) body.OrganizationUnitId = payload.entityId
  if (payload.employeeCategoryId !== undefined) body.EmployeeCategoryId = payload.employeeCategoryId || null
  if (payload.status !== undefined) body.Status = STATUS_TO_BACKEND[payload.status]
  if (payload.isExpatriate !== undefined) body.IsExpatriate = payload.isExpatriate
  return body
}

export const useEmployeeStore = defineStore('employees', () => {
  const employees = ref<Employee[]>([])
  // Annuaire léger (fetchDirectory), tenu à part de `employees` : fetchAll/
  // fetchTeam/fetchDirectory partageaient auparavant le même tableau, donc
  // le dernier appelé écrasait les autres — un écran de liste chargé avec
  // de vraies données pouvait se faire remplacer par les entrées à champs
  // vides de la version allégée si un sélecteur (Nouvelle demande...) était
  // interrogé après coup. `directory` ne sert plus qu'aux pickers
  // bénéficiaire/intérimaire, jamais aux écrans de liste/fiche.
  const directory = ref<Employee[]>([])
  // "Mon équipe" (fetchTeam), tenu à part de `employees` pour la même raison
  // que `directory` ci-dessus : fetchAll et fetchTeam écrivaient auparavant
  // dans le même tableau, donc le dernier résolu écrasait l'autre — un souci
  // silencieux la plupart du temps (une seule vue chargée à la fois), mais
  // qui devenait un vrai bug via lib/realtime.ts : un événement `data:changed`
  // (ex. déclenché par la désactivation d'un employé) déclenche fetchTeam()
  // ET fetchAll() en parallèle pour tout utilisateur ayant les deux
  // permissions (EMPLOYE_VOIR_EQUIPE + EMPLOYE_VOIR_TOUT) — sans cette
  // séparation, la liste complète de EmployeeListView.vue pouvait se faire
  // remplacer par la petite liste d'équipe (voire vide) selon l'ordre
  // d'arrivée des deux réponses.
  const team = ref<Employee[]>([])
  const loading   = ref(false)
  const error     = ref<string | null>(null)

  const activeEmployees   = computed(() => employees.value.filter(e => e.status === 'active'))
  const trialEmployees    = computed(() => employees.value.filter(e => e.status === 'trial'))
  // Approximation via le gabarit de permissions de la catégorie (pas les
  // droits individuels réels du compte, potentiellement ajustés au cas par
  // cas — voir stores/users.ts) : suffisant pour ce KPI/filtre, pas pour une
  // décision de sécurité.
  const validatorEmployees = computed(() => employees.value.filter((e) => {
    if (!e.hasAccount || !e.employeeCategoryId) return false
    const category = useEmployeeCategoryStore().categories.find(c => c.id === e.employeeCategoryId)
    return !!category?.permissions.some(p => VALIDATOR_PERMISSION_CODES.has(p.code))
  }))

  // Genere cote serveur (voir employee.service.ts:generateEmployeeNumber) —
  // evite les collisions qu'avait le calcul cote client (base sur la liste
  // deja chargee en memoire, potentiellement incomplete ou desynchronisee).
  async function fetchNextNumber(): Promise<string> {
    const { data } = await api.get<{ EmployeeNumber: string }>('/employees/next-number')
    return data.EmployeeNumber
  }

  function getById(id: string): Employee | undefined {
    return employees.value.find(e => e.id === id) ?? directory.value.find(e => e.id === id)
  }

  function getByEntityId(entityId: string): Employee[] {
    return employees.value.filter(e => e.entityId === entityId)
  }

  // mapEmployee lit usePositionStore() de façon synchrone (jobTitle) —
  // s'assurer qu'elle est chargée avant. Ne PAS faire l'équivalent pour
  // useEntityStore() ici : entities.ts.fetchAll() dépend déjà de ce store
  // (pour headcount/responsibleName) et attendrait en retour — un aller-retour
  // circulaire qui bloquerait les deux si les deux stores démarrent vides
  // (voir consumer views : elles chargent l'entityStore avant d'appeler ceci
  // quand l'affichage du nom d'entité importe, ex. EmployeeListView.vue).
  async function ensurePositionsLoaded() {
    const posStore = usePositionStore()
    if (posStore.positions.length === 0) await posStore.fetchAll()
  }

  async function fetchAll() {
    loading.value = true
    error.value = null
    try {
      await ensurePositionsLoaded()
      const { data } = await api.get<BackendEmployee[]>('/employees')
      employees.value = data.map(mapEmployee)
    } catch (err) {
      error.value = getApiErrorMessage(err, 'Impossible de charger les employés')
      throw err
    } finally {
      loading.value = false
    }
  }

  // Annuaire minimal (voir mapDirectoryEmployee) — a utiliser pour peupler
  // un selecteur de beneficiaire/interimaire quand l'appelant n'a pas
  // EMPLOYE_VOIR_TOUT/EQUIPE (fetchAll/fetchTeam echoueraient en 403).
  async function fetchDirectory() {
    loading.value = true
    error.value = null
    try {
      const { data } = await api.get<BackendDirectoryEmployee[]>('/employees/directory')
      directory.value = data.map(mapDirectoryEmployee)
    } catch (err) {
      error.value = getApiErrorMessage(err, "Impossible de charger l'annuaire des employés")
      throw err
    } finally {
      loading.value = false
    }
  }

  // "Mon équipe" — les employés des unités que le demandeur dirige, cote
  // EMPLOYE_VOIR_EQUIPE plutot que EMPLOYE_VOIR_TOUT (voir /employees/team
  // cote backend).
  async function fetchTeam() {
    loading.value = true
    error.value = null
    try {
      await ensurePositionsLoaded()
      const { data } = await api.get<BackendEmployee[]>('/employees/team')
      team.value = data.map(mapEmployee)
    } catch (err) {
      error.value = getApiErrorMessage(err, 'Impossible de charger votre équipe')
      throw err
    } finally {
      loading.value = false
    }
  }

  // GET /employees/:id — accessible sans EMPLOYE_VOIR_TOUT/EQUIPE tant que
  // c'est son propre dossier (voir employee.controller.ts findOne). Utilisé
  // pour la fiche "Mon profil", pas de raison d'exiger fetchAll ici.
  async function fetchOne(id: string) {
    error.value = null
    try {
      await ensurePositionsLoaded()
      const { data } = await api.get<BackendEmployee>(`/employees/${id}`)
      const idx = employees.value.findIndex(e => e.id === id)
      const mapped = mapEmployee(data, idx !== -1 ? idx : employees.value.length)
      if (idx !== -1) employees.value[idx] = mapped
      else employees.value.push(mapped)
      return mapped
    } catch (err) {
      error.value = getApiErrorMessage(err, "Impossible de charger cette fiche employé")
      throw err
    }
  }

  async function createEmployee(payload: Omit<Employee, 'id' | 'code' | 'name' | 'initials' | 'avatarBg' | 'avatarText'> & { code?: string }) {
    error.value = null
    return withToast("Création de l'employé en cours…", async () => {
      try {
        const body = toBackendPayload(payload)
        const { data } = await api.post<BackendEmployee>('/employees', body)
        const mapped = mapEmployee(data, employees.value.length)
        employees.value.push(mapped)
        return mapped
      } catch (err) {
        error.value = getApiErrorMessage(err, "Impossible de créer l'employé")
        throw err
      }
    }, () => error.value ?? "Impossible de créer l'employé")
  }

  async function updateEmployee(id: string, payload: Partial<Employee>) {
    error.value = null
    return withToast('Enregistrement en cours…', async () => {
      try {
        const { data } = await api.patch<BackendEmployee>(`/employees/${id}`, toBackendPayload(payload))
        const idx = employees.value.findIndex(e => e.id === id)
        const paletteIndex = idx !== -1 ? idx : employees.value.length
        const mapped = mapEmployee(data, paletteIndex)
        if (idx !== -1) employees.value[idx] = mapped
        return mapped
      } catch (err) {
        error.value = getApiErrorMessage(err, "Impossible de mettre à jour l'employé")
        throw err
      }
    }, () => error.value ?? "Impossible de mettre à jour l'employé")
  }

  // DELETE /employees/:id — soft delete côté backend (Status=Inactive,
  // libère le poste) : on reflète juste le même changement localement plutôt
  // que de retirer l'employé du tableau, il reste consultable (historique).
  async function deactivateEmployee(id: string) {
    error.value = null
    return withToast("Désactivation en cours…", async () => {
      try {
        const { data } = await api.delete<BackendEmployee>(`/employees/${id}`)
        const idx = employees.value.findIndex(e => e.id === id)
        if (idx !== -1) employees.value[idx] = mapEmployee(data, idx)
      } catch (err) {
        error.value = getApiErrorMessage(err, "Impossible de désactiver l'employé")
        throw err
      }
    }, () => error.value ?? "Impossible de désactiver l'employé")
  }

  // PATCH /employees/:id { Status: 'Active' } — réactivation d'un employé
  // désactivé, symétrique de deactivateEmployee ci-dessus. Appel direct
  // (pas via updateEmployee) pour garder un message de toast dédié plutôt
  // que le générique "Enregistrement en cours…".
  async function reactivateEmployee(id: string) {
    error.value = null
    return withToast('Réactivation en cours…', async () => {
      try {
        const { data } = await api.patch<BackendEmployee>(`/employees/${id}`, { Status: 'Active' })
        const idx = employees.value.findIndex(e => e.id === id)
        if (idx !== -1) employees.value[idx] = mapEmployee(data, idx)
      } catch (err) {
        error.value = getApiErrorMessage(err, "Impossible de réactiver l'employé")
        throw err
      }
    }, () => error.value ?? "Impossible de réactiver l'employé")
  }

  // DELETE /employees/:id/permanent (Lot I) — suppression définitive,
  // distincte de deactivateEmployee ci-dessus (Status=Inactive, réversible
  // depuis l'app). Retiré du tableau local : contrairement à la
  // désactivation, un employé supprimé ne doit plus jamais réapparaître
  // dans l'app pour un utilisateur — seul un dev peut le restaurer en base.
  async function deleteEmployeePermanently(id: string) {
    error.value = null
    return withToast('Suppression en cours…', async () => {
      try {
        await api.delete(`/employees/${id}/permanent`)
        employees.value = employees.value.filter(e => e.id !== id)
      } catch (err) {
        error.value = getApiErrorMessage(err, "Impossible de supprimer l'employé")
        throw err
      }
    }, () => error.value ?? "Impossible de supprimer l'employé")
  }

  // Mise à jour locale après la création réussie d'un compte utilisateur
  // (POST /users, voir stores/users.ts) — évite un re-fetch, la source de
  // vérité (Employee.UserId) vient d'être posée côté backend à l'instant.
  function markHasAccount(employeeId: string, userId: string) {
    const idx = employees.value.findIndex(e => e.id === employeeId)
    if (idx !== -1) employees.value[idx] = { ...employees.value[idx]!, hasAccount: true, userId }
  }

  return {
    employees, directory, team, loading, error,
    activeEmployees, trialEmployees, validatorEmployees, fetchNextNumber,
    getById, getByEntityId, fetchAll, fetchTeam, fetchDirectory, fetchOne, createEmployee, updateEmployee, deactivateEmployee, reactivateEmployee, deleteEmployeePermanently, markHasAccount,
  }
})
