<script setup lang="ts">
/**
 * Fiche d'un employé (lecture / édition) — sur CardModalShell, pattern
 * frontdesk. Sélection de l'entité via TableLookupField (vraie entité).
 */
import { ref, computed, watch } from 'vue'
import { ShieldCheck, KeyRound, UserX, RotateCcw, Trash2 } from 'lucide-vue-next'
import CardModalShell from '../shared/CardModalShell.vue'
import StatusPill from '../ui/StatusPill.vue'
import UserAvatar from '../ui/UserAvatar.vue'
import TableLookupField from '../ui/table-lookup/TableLookupField.vue'
import type { LookupFetchParams } from '../ui/table-lookup/TableLookupField.vue'
import FormSection from '../ui/form-field/FormSection.vue'
import CreateUserAccountDialog from './CreateUserAccountDialog.vue'
import * as cls from '../../lib/formClasses'
import { formatDate, todayIso } from '../../lib/date'
import { confirmDialog } from '../../lib/confirm'
import { useEmployeeStore } from '../../stores/employees'
import { useEntityStore } from '../../stores/entities'
import { usePositionStore } from '../../stores/positions'
import { useAuthStore } from '../../stores/auth'
import { useUserStore } from '../../stores/users'
import { usePermissionStore } from '../../stores/permissions'
import { useEmployeeCategoryStore } from '../../stores/employeeCategories'
import type { Employee, ContractType, EmployeeStatus, Gender, MaritalStatus, IdDocumentType } from '../../types'

const props = defineProps<{ employees: Employee[]; employeeId: string }>()
const emit = defineEmits<{ close: [] }>()

const store = useEmployeeStore()
const entityStore = useEntityStore()
const positionStore = usePositionStore()
const auth = useAuthStore()
const userStore = useUserStore()
const permissionStore = usePermissionStore()
const categoryStore = useEmployeeCategoryStore()
if (positionStore.positions.length === 0) positionStore.fetchAll()
if (permissionStore.permissions.length === 0) permissionStore.fetchAll()
if (categoryStore.categories.length === 0) categoryStore.fetchAll()

const STATUS_LABELS: Record<string, string> = { active: 'Actif', trial: 'Période d\'essai', onleave: 'En congé', inactive: 'Désactivé' }
const GENDER_LABELS: Record<Gender, string> = { M: 'Homme', F: 'Femme' }
const MARITAL_LABELS: Record<MaritalStatus, string> = { Single: 'Célibataire', Married: 'Marié(e)', Divorced: 'Divorcé(e)', Widowed: 'Veuf / Veuve' }
const ID_TYPE_LABELS: Record<IdDocumentType, string> = { NationalId: "Carte d'identité nationale", Passport: 'Passeport', ResidencePermit: 'Carte de séjour' }
function categoryName(id?: string): string {
  if (!id) return '—'
  return categoryStore.categories.find(c => c.id === id)?.name ?? '—'
}

const entityColumns = [{ key: 'code', label: 'Code', width: '90px' }, { key: 'name', label: 'Nom' }]
// Une entité désactivée reste visible (grisée, non sélectionnable) plutôt
// que de disparaître — voir même pattern dans EntityCard.vue.
function fetchEntities({ searchQuery }: LookupFetchParams) {
  let items = entityStore.entities.filter(e => e.status === 'Active' || e.status === 'Inactive')
  if (searchQuery) {
    const q = searchQuery.toLowerCase()
    items = items.filter(e => e.name.toLowerCase().includes(q) || e.code.toLowerCase().includes(q))
  }
  return { items, total: items.length }
}
function isEntityDisabled(item: { status?: string }) { return item.status === 'Inactive' }

const positionColumns = [
  { key: 'code', label: 'Code', width: '90px' },
  { key: 'title', label: 'Poste' },
  { key: 'remaining', label: 'Places dispo.', width: '100px' },
]
function fetchPositions({ searchQuery }: LookupFetchParams) {
  // Un poste dont tous les sieges sont occupes ne doit plus etre propose —
  // sauf celui deja affecte a cet employe (sinon on ne pourrait plus
  // voir/reselectionner le sien) (voir Position.Capacity / decision du 30/07,
  // meme regle que EmployeeCreate.vue / EmployeeFormView.vue).
  let items = positionStore.positions.filter(p => p.occupiedCount < p.capacity || p.id === form.value.positionId)
  if (searchQuery) {
    const q = searchQuery.toLowerCase()
    items = items.filter(p => p.title.toLowerCase().includes(q) || p.code.toLowerCase().includes(q))
  }
  const withRemaining = items.map(p => ({ ...p, remaining: `${p.capacity - p.occupiedCount}/${p.capacity}` }))
  return { items: withRemaining, total: withRemaining.length }
}

const currentId = ref(props.employeeId)
watch(() => props.employeeId, (v) => { currentId.value = v; isEditMode.value = false })

const current = computed<Employee | null>(() => props.employees.find(e => e.id === currentId.value) ?? null)
const currentIndex = computed(() => props.employees.findIndex(e => e.id === currentId.value))
const hasPrev = computed(() => currentIndex.value > 0)
const hasNext = computed(() => currentIndex.value >= 0 && currentIndex.value < props.employees.length - 1)
const sidebarItems = computed(() => props.employees.map(e => ({ no: e.code, label: e.name })))
const currentNo = computed(() => current.value?.code ?? null)

function goPrev() { if (hasPrev.value) { currentId.value = props.employees[currentIndex.value - 1]!.id; isEditMode.value = false } }
function goNext() { if (hasNext.value) { currentId.value = props.employees[currentIndex.value + 1]!.id; isEditMode.value = false } }
function selectSidebar(no: string) {
  const e = props.employees.find(x => x.code === no)
  if (e) { currentId.value = e.id; isEditMode.value = false }
}

/* ── Édition ────────────────────────────────────────────────── */
const isEditMode = ref(false)
const entityCode = ref('')
const positionCode = ref('')
const saveError = ref('')
const form = ref({
  firstName: '', lastName: '', email: '', phone: '',
  positionId: '' as string | null, positionTitle: '',
  entityId: '' as string | null, entityName: '',
  employeeCategoryId: '' as string, contractType: 'CDI' as ContractType,
  hireDate: '', status: 'active' as EmployeeStatus, isExpatriate: false,
  gender: 'M' as Gender, birthDate: '', birthPlace: '',
  maritalStatus: 'Single' as MaritalStatus, idType: 'NationalId' as IdDocumentType, idNumber: '',
})

function enterEdit() {
  if (!current.value) return
  const e = current.value
  form.value = {
    firstName: e.firstName, lastName: e.lastName, email: e.email ?? '', phone: e.phone ?? '',
    positionId: e.positionId ?? '', positionTitle: e.jobTitle,
    entityId: e.entityId, entityName: e.entityName ?? '', employeeCategoryId: e.employeeCategoryId ?? '', contractType: e.contractType,
    hireDate: e.hireDate, status: e.status, isExpatriate: e.isExpatriate,
    gender: e.gender, birthDate: e.birthDate, birthPlace: e.birthPlace ?? '',
    maritalStatus: e.maritalStatus, idType: e.idType, idNumber: e.idNumber ?? '',
  }
  const ent = e.entityId ? entityStore.getEntityById(e.entityId) : undefined
  entityCode.value = ent?.code ?? ''
  positionCode.value = ''
  saveError.value = ''
  isEditMode.value = true
}
function cancelEdit() { isEditMode.value = false; saveError.value = '' }
function onEntitySelect(item: Record<string, unknown>) {
  form.value.entityId = String(item.id); form.value.entityName = String(item.name); entityCode.value = String(item.code)
}
function onPositionSelect(item: Record<string, unknown>) {
  form.value.positionId = String(item.id); form.value.positionTitle = String(item.title); positionCode.value = String(item.code)
}
async function save() {
  if (!current.value) return
  try {
    await store.updateEmployee(current.value.id, { ...form.value, jobTitle: form.value.positionTitle, positionId: form.value.positionId || undefined })
    isEditMode.value = false
  } catch {
    saveError.value = store.error ?? "L'enregistrement a échoué. Veuillez réessayer."
  }
}

const pageTitle = computed(() => (current.value ? `${current.value.code} · ${current.value.name}` : ''))
const readBox = 'text-[13px] text-foreground bg-background border border-border rounded-md px-2.5 h-[38px] flex items-center'

/* ── Accès système (compte utilisateur) ────────────────────────── */
const showCreateAccount = ref(false)
function onAccountCreated(userId: string) {
  if (current.value) store.markHasAccount(current.value.id, userId)
  // userId passé explicitement plutôt que relu depuis current.value.userId :
  // markHasAccount() vient de muter le store, mais props.employees (donc
  // current) ne reflète la mise à jour qu'au prochain rendu du parent
  // (asynchrone) — le lire ici renverrait encore l'ancienne valeur (undefined)
  // et viderait silencieusement la liste des permissions jusqu'au prochain
  // rechargement de la fiche.
  loadUserPermissions(userId)
}

/* ── Permissions individuelles du compte — indépendantes de la
   catégorie une fois le compte créé (voir decision du 29/07). ────── */
const userPermissions = ref<{ permissionId: string; code: string; module: string; label: string }[]>([])
const loadingPermissions = ref(false)

async function loadUserPermissions(overrideUserId?: string) {
  const userId = overrideUserId ?? current.value?.userId
  if (!userId) { userPermissions.value = []; return }
  loadingPermissions.value = true
  try {
    const data = await userStore.fetchUserPermissions(userId)
    userPermissions.value = data.individualGrants
  } catch {
    userPermissions.value = []
  } finally {
    loadingPermissions.value = false
  }
}
watch(() => current.value?.id, () => { loadUserPermissions() }, { immediate: true })

const permissionsByModule = computed(() => {
  const groups = new Map<string, typeof permissionStore.permissions>()
  for (const p of permissionStore.permissions) {
    if (!groups.has(p.module)) groups.set(p.module, [])
    groups.get(p.module)!.push(p)
  }
  return [...groups.entries()].map(([module, items]) => ({ module, items }))
})

function hasUserPermission(permissionId: string): boolean {
  return userPermissions.value.some(p => p.permissionId === permissionId)
}

async function toggleUserPermission(permissionId: string, checked: boolean) {
  if (!current.value?.userId) return
  try {
    const data = checked
      ? await userStore.grantUserPermission(current.value.userId, permissionId)
      : await userStore.revokeUserPermission(current.value.userId, permissionId)
    userPermissions.value = data.individualGrants
  } catch {
    // userStore.error porte le message pour l'UI (toast)
  }
}

/* ── Désactivation ──────────────────────────────────────────────── */
// Personne ne peut désactiver/supprimer son propre compte — sinon on se
// coupe soi-même l'accès sans possibilité de revenir en arrière depuis
// l'app (le backend refuse déjà la requête, ceci évite juste l'aller-retour
// pour rien). Voir mêmes gardes côté employee.service.ts (remove/update/
// softDelete).
const isSelf = computed(() => !!current.value && current.value.id === auth.user?.id)
const deactivating = ref(false)
async function deactivate() {
  if (!current.value) return
  if (!(await confirmDialog(`Désactiver ${current.value.name} ? L'employé ne sera plus actif mais reste consultable.`))) return
  deactivating.value = true
  try {
    await store.deactivateEmployee(current.value.id)
  } catch {
    // store.error porte le message pour l'UI (toast)
  } finally {
    deactivating.value = false
  }
}

/* ── Réactivation ───────────────────────────────────────────────── */
const reactivating = ref(false)
async function reactivate() {
  if (!current.value) return
  reactivating.value = true
  try {
    await store.reactivateEmployee(current.value.id)
  } catch {
    // store.error porte le message pour l'UI (toast)
  } finally {
    reactivating.value = false
  }
}

/* ── Suppression définitive (Lot I) ──────────────────────────────── */
const deleting = ref(false)
async function deletePermanently() {
  if (!current.value) return
  if (!(await confirmDialog(
    `Supprimer définitivement ${current.value.name} ? Cet employé disparaîtra de toute l'application. Cette action est irréversible.`,
    { danger: true },
  ))) return
  deleting.value = true
  try {
    await store.deleteEmployeePermanently(current.value.id)
    emit('close')
  } catch {
    // store.error porte le message pour l'UI (toast)
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <CardModalShell
    v-if="current"
    :page-title="pageTitle"
    :page-number="current.code"
    banner-label="Fiche employé"
    :is-edit-mode="isEditMode"
    :show-edit="auth.hasPermission('EMPLOYE_MODIFIER')"
    :show-title-new-button="false"
    :sidebar-items="sidebarItems"
    :current-no="currentNo"
    :has-prev="hasPrev"
    :has-next="hasNext"
    :has-unsaved-changes="isEditMode"
    :save-error="saveError"
    @close="emit('close')"
    @enter-edit="enterEdit"
    @cancel-edit="cancelEdit"
    @save="save"
    @go-prev="goPrev"
    @go-next="goNext"
    @select-sidebar="selectSidebar"
    @clear-save-error="saveError = ''"
  >
    <template #title-badges>
      <StatusPill :status="current.status" />
    </template>

    <template #form>
      <div class="px-6 py-5 max-w-4xl">
        <!-- Identité -->
        <FormSection title="Identité" :recaps="[current.name, current.jobTitle]">
        <div class="grid grid-cols-2 gap-x-6 gap-y-4 max-sm:grid-cols-1">
          <div :class="cls.field">
            <label :class="cls.fieldLabel">Prénom</label>
            <input v-if="isEditMode" v-model="form.firstName" :class="cls.fieldInput" />
            <div v-else :class="readBox"><UserAvatar :name="current.name" size="sm" class="mr-2" />{{ current.firstName }}</div>
          </div>
          <div :class="cls.field">
            <label :class="cls.fieldLabel">Nom</label>
            <input v-if="isEditMode" v-model="form.lastName" :class="cls.fieldInput" />
            <div v-else :class="readBox">{{ current.lastName }}</div>
          </div>
          <div :class="cls.field">
            <label :class="cls.fieldLabel">Poste</label>
            <TableLookupField
              v-if="isEditMode"
              :code="positionCode" :name="form.positionTitle"
              value-key="code" name-key="title"
              :columns="positionColumns" :fetch-fn="fetchPositions"
              modal-title="Sélectionner un poste" placeholder="Code poste"
              @update:code="positionCode = $event" @update:name="form.positionTitle = $event" @select="onPositionSelect"
            />
            <div v-else :class="readBox">{{ current.jobTitle || '—' }}</div>
          </div>
          <div :class="cls.field">
            <label :class="cls.fieldLabel">Email</label>
            <input v-if="isEditMode" type="email" v-model="form.email" :class="cls.fieldInput" />
            <div v-else :class="readBox">{{ current.email || '—' }}</div>
          </div>
          <div :class="cls.field">
            <label :class="cls.fieldLabel">Téléphone</label>
            <input v-if="isEditMode" type="tel" v-model="form.phone" :class="cls.fieldInput" />
            <div v-else :class="readBox">{{ current.phone || '—' }}</div>
          </div>
          <div :class="cls.field">
            <label :class="cls.fieldLabel">Genre</label>
            <select v-if="isEditMode" v-model="form.gender" :class="cls.fieldSelect">
              <option v-for="(l, v) in GENDER_LABELS" :key="v" :value="v">{{ l }}</option>
            </select>
            <div v-else :class="readBox">{{ GENDER_LABELS[current.gender] }}</div>
          </div>
          <div :class="cls.field">
            <label :class="cls.fieldLabel">Date de naissance</label>
            <input v-if="isEditMode" type="date" v-model="form.birthDate" :max="todayIso()" :class="cls.fieldInput" />
            <div v-else :class="readBox">{{ formatDate(current.birthDate) }}</div>
          </div>
          <div :class="cls.field">
            <label :class="cls.fieldLabel">Lieu de naissance</label>
            <input v-if="isEditMode" v-model="form.birthPlace" :class="cls.fieldInput" />
            <div v-else :class="readBox">{{ current.birthPlace || '—' }}</div>
          </div>
          <div :class="cls.field">
            <label :class="cls.fieldLabel">Situation familiale</label>
            <select v-if="isEditMode" v-model="form.maritalStatus" :class="cls.fieldSelect">
              <option v-for="(l, v) in MARITAL_LABELS" :key="v" :value="v">{{ l }}</option>
            </select>
            <div v-else :class="readBox">{{ MARITAL_LABELS[current.maritalStatus] }}</div>
          </div>
          <div :class="cls.field">
            <label :class="cls.fieldLabel">Type de pièce d'identité</label>
            <select v-if="isEditMode" v-model="form.idType" :class="cls.fieldSelect">
              <option v-for="(l, v) in ID_TYPE_LABELS" :key="v" :value="v">{{ l }}</option>
            </select>
            <div v-else :class="readBox">{{ ID_TYPE_LABELS[current.idType] }}</div>
          </div>
          <div :class="cls.field">
            <label :class="cls.fieldLabel">Numéro de pièce</label>
            <input v-if="isEditMode" v-model="form.idNumber" :class="cls.fieldInput" />
            <div v-else :class="readBox">{{ current.idNumber || '—' }}</div>
          </div>
        </div>
        </FormSection>

        <!-- Affectation -->
        <FormSection title="Affectation" :recaps="[current.entityName, categoryName(current.employeeCategoryId)]">
        <div class="grid grid-cols-2 gap-x-6 gap-y-4 max-sm:grid-cols-1">
          <div :class="cls.field">
            <label :class="cls.fieldLabel">Entité</label>
            <TableLookupField
              v-if="isEditMode"
              :code="entityCode" :name="form.entityName"
              value-key="code" name-key="name"
              :columns="entityColumns" :fetch-fn="fetchEntities"
              :is-item-disabled="isEntityDisabled" :item-disabled-reason="() => 'entité désactivée'"
              modal-title="Sélectionner une entité" placeholder="Code entité"
              @update:code="entityCode = $event" @update:name="form.entityName = $event" @select="onEntitySelect"
            />
            <div v-else :class="readBox">{{ current.entityName || '—' }}</div>
          </div>
          <div :class="cls.field">
            <label :class="cls.fieldLabel">Catégorie</label>
            <select v-if="isEditMode" v-model="form.employeeCategoryId" :class="cls.fieldSelect">
              <option value="">-- Aucune --</option>
              <option v-for="c in categoryStore.categories" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
            <div v-else :class="readBox">{{ categoryName(current.employeeCategoryId) }}</div>
          </div>
          <div :class="cls.field">
            <label :class="cls.fieldLabel">Type de contrat</label>
            <select v-if="isEditMode" v-model="form.contractType" :class="cls.fieldSelect">
              <option value="CDI">CDI</option><option value="CDD">CDD</option><option value="Stage">Stage</option><option value="Freelance">Freelance</option><option value="Apprenti">Apprenti</option><option value="Alternant">Alternant</option>
            </select>
            <div v-else :class="readBox">{{ current.contractType }}</div>
          </div>
          <div :class="cls.field">
            <label :class="cls.fieldLabel">Date d'embauche</label>
            <input v-if="isEditMode" type="date" v-model="form.hireDate" :max="todayIso()" :class="cls.fieldInput" />
            <div v-else :class="readBox">{{ formatDate(current.hireDate) }}</div>
          </div>
          <div :class="cls.field">
            <label :class="cls.fieldLabel">Régime de congés</label>
            <label v-if="isEditMode" class="flex items-center gap-2 h-[34px] text-[13px] text-foreground cursor-pointer">
              <input type="checkbox" v-model="form.isExpatriate" class="accent-primary" /> Employé expatrié
            </label>
            <div v-else :class="readBox">{{ current.isExpatriate ? 'Expatrié' : 'Local' }}</div>
          </div>
          <div :class="cls.field">
            <label :class="cls.fieldLabel">Statut</label>
            <select v-if="isEditMode" v-model="form.status" :class="cls.fieldSelect">
              <option v-for="(l, v) in STATUS_LABELS" :key="v" :value="v">{{ l }}</option>
            </select>
            <div v-else :class="readBox"><StatusPill :status="current.status" /></div>
          </div>
        </div>
        </FormSection>

        <!-- Accès système -->
        <FormSection title="Accès système">
        <div class="flex items-center justify-between gap-3 bg-background border border-border rounded-lg px-4 py-3">
          <div class="flex items-center gap-2.5">
            <ShieldCheck v-if="current.hasAccount && current.status !== 'inactive'" class="w-4 h-4 text-success shrink-0" />
            <UserX v-else-if="current.hasAccount" class="w-4 h-4 text-danger shrink-0" />
            <KeyRound v-else class="w-4 h-4 text-muted-foreground shrink-0" />
            <div>
              <div class="text-[13px] font-medium text-foreground">
                {{ !current.hasAccount ? 'Aucun compte' : current.status === 'inactive' ? 'Compte bloqué' : 'Compte actif' }}
              </div>
              <div class="text-[11px] text-muted-foreground">
                {{
                  !current.hasAccount
                    ? 'Cet employé n\'a pas encore accès à l\'application'
                    : current.status === 'inactive'
                      ? 'Employé désactivé — il ne peut plus se connecter à l\'application'
                      : 'Cet employé peut se connecter à l\'application'
                }}
              </div>
            </div>
          </div>
          <button v-if="!current.hasAccount && auth.hasPermission('EMPLOYE_COMPTE_CREER')" :class="[cls.btnOutline, '!px-3 !py-1.5 !text-xs shrink-0']" @click="showCreateAccount = true">
            Créer un compte utilisateur
          </button>
        </div>
        </FormSection>

        <!-- Permissions individuelles du compte -->
        <FormSection v-if="current.hasAccount && auth.hasPermission('EMPLOYE_PERMISSION_GERER')" title="Permissions individuelles">
          <p class="text-[11px] text-muted-foreground -mt-1 mb-2">
            Ajoutées/retirées indépendamment de la catégorie de l'employé. Un changement ici n'affecte que ce compte.
          </p>
          <div v-if="loadingPermissions" class="text-[13px] text-muted-foreground italic px-1 py-2">Chargement…</div>
          <div v-else class="flex flex-col gap-3 max-h-[280px] overflow-auto pr-1">
            <div v-for="mod in permissionsByModule" :key="mod.module">
              <div class="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.05em] mb-1">{{ mod.module }}</div>
              <div class="flex flex-col gap-0.5">
                <label
                  v-for="p in mod.items"
                  :key="p.id"
                  class="flex items-center gap-2.5 px-2 py-1 rounded-md hover:bg-background cursor-pointer"
                >
                  <input
                    type="checkbox"
                    class="accent-primary"
                    :checked="hasUserPermission(p.id)"
                    @change="toggleUserPermission(p.id, ($event.target as HTMLInputElement).checked)"
                  />
                  <span class="text-[13px] text-foreground">{{ p.label }}</span>
                </label>
              </div>
            </div>
          </div>
        </FormSection>

        <!-- Désactivation / Réactivation / Suppression -->
        <div v-if="isSelf" class="text-[11px] text-muted-foreground text-right mt-1">
          Vous ne pouvez pas désactiver ou supprimer votre propre compte.
        </div>
        <div v-else class="flex justify-end gap-2 mt-1">
          <button
            v-if="current.status !== 'inactive' && auth.hasPermission('EMPLOYE_DESACTIVER')"
            :class="[cls.btnOutline, '!text-danger !border-danger/30 hover:!bg-danger-bg']"
            :disabled="deactivating"
            @click="deactivate"
          >
            <UserX class="w-3.5 h-3.5" /> {{ deactivating ? 'Désactivation…' : 'Désactiver cet employé' }}
          </button>
          <button
            v-if="current.status === 'inactive' && auth.hasPermission('EMPLOYE_DESACTIVER')"
            :class="[cls.btnOutline, '!text-success !border-success/30 hover:!bg-success-bg']"
            :disabled="reactivating"
            @click="reactivate"
          >
            <RotateCcw class="w-3.5 h-3.5" /> {{ reactivating ? 'Réactivation…' : 'Réactiver cet employé' }}
          </button>
          <button
            v-if="auth.hasPermission('EMPLOYE_SUPPRIMER')"
            :class="cls.btnDestructive"
            :disabled="deleting"
            @click="deletePermanently"
          >
            <Trash2 class="w-3.5 h-3.5" /> {{ deleting ? 'Suppression…' : 'Supprimer définitivement' }}
          </button>
        </div>
      </div>
    </template>
  </CardModalShell>

  <CreateUserAccountDialog
    v-if="showCreateAccount && current"
    :employee-id="current.id"
    :employee-name="current.name"
    :employee-email="current.email"
    @close="showCreateAccount = false"
    @created="onAccountCreated"
  />
</template>
