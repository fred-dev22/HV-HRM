<script setup lang="ts">
/**
 * Fiche de création d'un employé — sur CreateModalShell (pattern frontdesk).
 * Sélection de l'entité et du poste via TableLookupField (vraies données).
 */
import { ref, reactive, computed, onMounted } from 'vue'
import { Info, Lock } from 'lucide-vue-next'
import CreateModalShell from '../shared/CreateModalShell.vue'
import TableLookupField from '../ui/table-lookup/TableLookupField.vue'
import type { LookupFetchParams } from '../ui/table-lookup/TableLookupField.vue'
import FormSection from '../ui/form-field/FormSection.vue'
import * as cls from '../../lib/formClasses'
import { todayIso } from '../../lib/date'
import { useEmployeeStore } from '../../stores/employees'
import { useEntityStore } from '../../stores/entities'
import { usePositionStore } from '../../stores/positions'
import { useEmployeeCategoryStore } from '../../stores/employeeCategories'
import type { ContractType, EmployeeStatus, Gender, MaritalStatus, IdDocumentType } from '../../types'

const emit = defineEmits<{ close: []; created: [] }>()

const store = useEmployeeStore()
const entityStore = useEntityStore()
const positionStore = usePositionStore()
const categoryStore = useEmployeeCategoryStore()

onMounted(() => {
  // Toujours rafraichir les postes (pas de garde sur .length) — a la
  // difference des categories, l'occupation d'un poste change a chaque
  // creation/suppression d'employe, donc une liste deja chargee peut etre
  // perimee (nombre de places restantes faux dans le picker).
  positionStore.fetchAll()
  if (categoryStore.categories.length === 0) categoryStore.fetchAll()
  // Liste complete (pas directory, qui n'expose jamais hasAccount) —
  // necessaire au selecteur de validateur direct ci-dessous.
  if (store.employees.length === 0) store.fetchAll()
})

const STATUS_LABELS: Record<string, string> = { active: 'Actif', trial: 'Période d\'essai', onleave: 'En congé', inactive: 'Désactivé' }
const GENDER_LABELS: Record<Gender, string> = { M: 'Homme', F: 'Femme' }
const MARITAL_LABELS: Record<MaritalStatus, string> = { Single: 'Célibataire', Married: 'Marié(e)', Divorced: 'Divorcé(e)', Widowed: 'Veuf / Veuve' }
const ID_TYPE_LABELS: Record<IdDocumentType, string> = { NationalId: "Carte d'identité nationale", Passport: 'Passeport', ResidencePermit: 'Carte de séjour' }

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
  // Un poste dont tous les sieges sont occupes ne doit plus etre propose a la
  // creation (voir Position.Capacity / decision du 30/07).
  let items = positionStore.positions.filter(p => p.occupiedCount < p.capacity)
  if (searchQuery) {
    const q = searchQuery.toLowerCase()
    items = items.filter(p => p.title.toLowerCase().includes(q) || p.code.toLowerCase().includes(q))
  }
  const withRemaining = items.map(p => ({ ...p, remaining: `${p.capacity - p.occupiedCount}/${p.capacity}` }))
  return { items: withRemaining, total: withRemaining.length }
}

const entityCode = ref('')
const positionCode = ref('')
const form = reactive({
  employeeNumber: '',
  firstName: '', lastName: '', email: '', phone: '',
  entityId: '' as string | null, entityName: '',
  positionId: '' as string | null, positionTitle: '',
  contractType: '' as ContractType | '',
  employeeCategoryId: '' as string,
  hireDate: '', status: 'active' as EmployeeStatus,
  gender: '' as Gender | '', birthDate: '', birthPlace: '',
  maritalStatus: '' as MaritalStatus | '', idType: '' as IdDocumentType | '', idNumber: '',
  isExpatriate: false,
  directValidatorId: '' as string, directValidatorName: '',
})
const error = ref('')

// Le mode de validation des congés (pool vs validateur direct) est un choix
// d'ENTITÉ, pas d'employé (retour du 09/09, voir ApprovalPoolConfig.vue) —
// la section ne s'affiche que si l'entité choisie ci-dessus est en mode
// validateur direct ; sinon le pool de l'entité s'applique automatiquement.
const showDirectValidatorSection = computed(() => !!form.entityId && entityStore.getEntityById(form.entityId)?.leaveApprovalMode === 'DirectValidator')

// Éligibilité validateur = compte actif ET permission CONGE_VALIDER
// RÉELLEMENT accordée (validatorPermissions, calculé backend depuis les
// UserPermission effectives, pas le gabarit de la catégorie — retour du
// 10/09, voir EmployeeCard.vue).
function canValidateLeave(e: { validatorPermissions?: string[] }): boolean {
  return !!e.validatorPermissions?.includes('CONGE_VALIDER')
}
const validatorColumns = [{ key: 'code', label: 'Matricule', width: '90px' }, { key: 'label', label: 'Nom' }]
function fetchValidatorCandidates({ searchQuery }: LookupFetchParams) {
  let items = store.employees.map(e => ({
    id: e.id, label: e.name, code: e.code, sublabel: e.entityName,
    status: e.status, hasAccount: e.hasAccount, validatorPermissions: e.validatorPermissions,
  }))
  if (searchQuery) {
    const q = searchQuery.toLowerCase()
    items = items.filter(e => e.label.toLowerCase().includes(q) || e.code.toLowerCase().includes(q))
  }
  return { items, total: items.length }
}
function isValidatorDisabled(item: { status?: string; hasAccount?: boolean; validatorPermissions?: string[] }): boolean {
  return item.status !== 'active' || !item.hasAccount || !canValidateLeave(item)
}
function validatorDisabledReason(item: { status?: string; hasAccount?: boolean; validatorPermissions?: string[] }): string {
  if (item.status !== 'active') return 'compte désactivé'
  if (!item.hasAccount) return "n'a pas de compte utilisateur"
  if (!canValidateLeave(item)) return 'permission de validation des congés manquante'
  return ''
}
const validatorCode = ref('')
function onValidatorSelect(item: Record<string, unknown>) {
  form.directValidatorId = String(item.id)
  form.directValidatorName = String(item.label)
  validatorCode.value = String(item.code)
}

store.fetchNextNumber().then(n => { form.employeeNumber = n }).catch(() => {})

function onEntitySelect(item: Record<string, unknown>) {
  form.entityId = String(item.id); form.entityName = String(item.name); entityCode.value = String(item.code)
}
// Un poste est rattache a une entite (voir Position.organizationUnitId) —
// le choisir remplit automatiquement l'entite de l'employe, modifiable
// ensuite si besoin (voir decision reunion du 25/07).
function onPositionSelect(item: Record<string, unknown>) {
  form.positionId = String(item.id); form.positionTitle = String(item.title); positionCode.value = String(item.code)
  const position = positionStore.positions.find(p => p.id === form.positionId)
  if (position?.organizationUnitId) {
    const entity = entityStore.getEntityById(position.organizationUnitId)
    if (entity) {
      form.entityId = entity.id; form.entityName = entity.name; entityCode.value = entity.code
    }
  }
}

// Manager auto-dérivé du responsable de l'entité choisie — pas éditable
// directement (voir Employee.managerId, déduit de l'entité de rattachement).
const directManager = computed(() => {
  const entity = entityStore.entities.find(e => e.id === form.entityId)
  if (!entity?.responsibleName) return null
  return { name: entity.responsibleName, managerId: entity.managerId ?? null }
})

function validate(): boolean {
  if (!form.firstName.trim()) { error.value = 'Prénom requis'; return false }
  if (!form.lastName.trim()) { error.value = 'Nom requis'; return false }
  if (!form.entityId) { error.value = 'Entité requise'; return false }
  if (!form.employeeCategoryId) { error.value = 'Catégorie requise'; return false }
  if (!form.contractType) { error.value = 'Type de contrat requis'; return false }
  if (!form.hireDate) { error.value = 'Date d\'embauche requise'; return false }
  if (!form.gender) { error.value = 'Genre requis'; return false }
  if (!form.birthDate) { error.value = 'Date de naissance requise'; return false }
  if (!form.maritalStatus) { error.value = 'Situation familiale requise'; return false }
  if (!form.idType) { error.value = "Type de pièce d'identité requis"; return false }
  if (!form.email.trim()) { error.value = 'Email requis'; return false }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { error.value = 'Format email invalide'; return false }
  // Validateur direct volontairement non bloquant a la creation (retour du
  // 10/09, voir EmployeeCard.vue save()) : on peut creer l'employe puis lui
  // assigner un validateur ensuite. Le blocage se fait a la soumission d'une
  // demande de conge cote backend, la ou le message a du sens.
  error.value = ''
  return true
}

async function create() {
  if (!validate()) return
  try {
    await store.createEmployee({
      code: form.employeeNumber || undefined,
      firstName: form.firstName, lastName: form.lastName,
      jobTitle: form.positionTitle, positionId: form.positionId || undefined,
      email: form.email || undefined, phone: form.phone || undefined,
      entityId: form.entityId, entityName: form.entityName,
      contractType: form.contractType as ContractType,
      hireDate: form.hireDate, status: form.status,
      managerId: directManager.value?.managerId ?? undefined,
      gender: form.gender as Gender, birthDate: form.birthDate, birthPlace: form.birthPlace || undefined,
      maritalStatus: form.maritalStatus as MaritalStatus, idType: form.idType as IdDocumentType,
      idNumber: form.idNumber || undefined,
      employeeCategoryId: form.employeeCategoryId,
      isExpatriate: form.isExpatriate,
      directValidatorId: form.directValidatorId,
      // Un employé fraîchement créé n'a jamais de compte — hasAccount ne
      // devient vrai que via l'action "Créer un compte utilisateur" (voir
      // CreateUserAccountDialog.vue), jamais choisi à la création.
      hasAccount: false,
    })
    emit('created'); emit('close')
  } catch {
    error.value = store.error ?? "La création a échoué. Veuillez réessayer."
  }
}
</script>

<template>
  <CreateModalShell
    title="Nouvel employé"
    banner-label="Nouvel employé"
    create-label="Créer l'employé"
    :save-error="error"
    @close="emit('close')"
    @create="create"
  >
    <template #form>
      <div class="flex-1 overflow-auto px-6 py-5">
        <div class="max-w-3xl mx-auto">
          <!-- Identité -->
          <FormSection title="Identité">
          <div class="grid grid-cols-2 gap-x-6 gap-y-4 max-sm:grid-cols-1">
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Matricule</label>
              <input v-model="form.employeeNumber" :class="cls.fieldInput" placeholder="ex : EMP004" />
            </div>
            <div></div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Prénom <span class="text-danger">*</span></label>
              <input v-model="form.firstName" :class="cls.fieldInput" placeholder="ex : Aminata" />
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Nom <span class="text-danger">*</span></label>
              <input v-model="form.lastName" :class="cls.fieldInput" placeholder="ex : Diallo" />
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Email <span class="text-danger">*</span></label>
              <input type="email" v-model="form.email" :class="cls.fieldInput" placeholder="prenom.nom@hv.com" />
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Téléphone</label>
              <input type="tel" v-model="form.phone" :class="cls.fieldInput" placeholder="+261 …" />
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Genre <span class="text-danger">*</span></label>
              <select v-model="form.gender" :class="cls.fieldSelect">
                <option value="">-- Choisir --</option>
                <option v-for="(l, v) in GENDER_LABELS" :key="v" :value="v">{{ l }}</option>
              </select>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Date de naissance <span class="text-danger">*</span></label>
              <input type="date" v-model="form.birthDate" :max="todayIso()" :class="cls.fieldInput" />
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Lieu de naissance</label>
              <input v-model="form.birthPlace" :class="cls.fieldInput" placeholder="ex : Antananarivo" />
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Situation familiale <span class="text-danger">*</span></label>
              <select v-model="form.maritalStatus" :class="cls.fieldSelect">
                <option value="">-- Choisir --</option>
                <option v-for="(l, v) in MARITAL_LABELS" :key="v" :value="v">{{ l }}</option>
              </select>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Type de pièce d'identité <span class="text-danger">*</span></label>
              <select v-model="form.idType" :class="cls.fieldSelect">
                <option value="">-- Choisir --</option>
                <option v-for="(l, v) in ID_TYPE_LABELS" :key="v" :value="v">{{ l }}</option>
              </select>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Numéro de pièce</label>
              <input v-model="form.idNumber" :class="cls.fieldInput" placeholder="ex : 101123456789" />
            </div>
          </div>

          <label class="flex items-start gap-2 mt-3.5 text-[13px] text-foreground cursor-pointer">
            <input type="checkbox" v-model="form.isExpatriate" class="accent-primary mt-0.5" />
            <span>
              Employé expatrié
              <span class="block text-[11px] text-muted-foreground mt-0.5">(régime de congés différent : le week-end n'est jamais décompté ; les jours fériés restent exclus dans les deux cas)</span>
            </span>
          </label>

          </FormSection>

          <!-- Affectation -->
          <FormSection title="Affectation">
          <div class="grid grid-cols-2 gap-x-6 gap-y-4 max-sm:grid-cols-1">
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Entité <span class="text-danger">*</span></label>
              <TableLookupField
                :code="entityCode" :name="form.entityName"
                value-key="code" name-key="name"
                :columns="entityColumns" :fetch-fn="fetchEntities"
                :is-item-disabled="isEntityDisabled" :item-disabled-reason="() => 'entité désactivée'"
                modal-title="Sélectionner une entité" placeholder="Code entité"
                @update:code="entityCode = $event" @update:name="form.entityName = $event" @select="onEntitySelect"
              />
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Poste</label>
              <TableLookupField
                :code="positionCode" :name="form.positionTitle"
                value-key="code" name-key="title"
                :columns="positionColumns" :fetch-fn="fetchPositions"
                modal-title="Sélectionner un poste" placeholder="Code poste"
                @update:code="positionCode = $event" @update:name="form.positionTitle = $event" @select="onPositionSelect"
              />
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Catégorie <span class="text-danger">*</span></label>
              <select v-model="form.employeeCategoryId" :class="cls.fieldSelect">
                <option value="">-- Choisir --</option>
                <option v-for="c in categoryStore.categories" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
              <span class="text-[11px] text-muted-foreground">Détermine le taux de frais/perdiem et les permissions par défaut d'un futur compte</span>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Type de contrat <span class="text-danger">*</span></label>
              <select v-model="form.contractType" :class="cls.fieldSelect">
                <option value="">-- Choisir --</option>
                <option value="CDI">CDI</option><option value="CDD">CDD</option><option value="Stage">Stage</option><option value="Freelance">Freelance</option><option value="Apprenti">Apprenti</option><option value="Alternant">Alternant</option>
              </select>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Date d'embauche <span class="text-danger">*</span></label>
              <input type="date" v-model="form.hireDate" :max="todayIso()" :class="cls.fieldInput" />
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Statut</label>
              <select v-model="form.status" :class="cls.fieldSelect">
                <option v-for="(l, v) in STATUS_LABELS" :key="v" :value="v">{{ l }}</option>
              </select>
            </div>
            <div :class="[cls.field, 'col-span-full']">
              <label :class="cls.fieldLabel">
                Manager direct
                <span class="inline-flex items-center gap-[3px] text-[10px] font-semibold text-muted-foreground bg-background border border-border rounded-full px-1.5 py-px ml-1.5 align-middle">
                  <Lock class="w-2.5 h-2.5" /> Auto
                </span>
              </label>
              <div
                class="flex items-center gap-2 h-9 px-2.5 border border-border rounded-md bg-background text-[13px] text-foreground"
                :class="{ 'text-muted-foreground italic': !directManager }"
              >
                <template v-if="directManager">
                  <span class="font-medium">{{ directManager.name }}</span>
                  <span class="text-muted-foreground text-xs">· Responsable d'entité</span>
                </template>
                <span v-else class="text-xs text-muted-foreground">Sélectionnez une entité pour voir le manager</span>
              </div>
              <span class="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Info class="w-3 h-3 text-primary" />
                Défini automatiquement depuis le responsable de l'entité de rattachement
              </span>
            </div>
          </div>
          </FormSection>

          <!-- Validation des congés — n'existe que si l'entité choisie
               ci-dessus est en mode "validateur direct" (voir
               ApprovalPoolConfig.vue) ; sinon le pool de l'entité s'applique
               automatiquement, rien à configurer ici. -->
          <FormSection v-if="showDirectValidatorSection" title="Validation des congés">
            <p class="text-[11px] text-muted-foreground -mt-0.5 mb-3">
              Cette entité utilise un validateur direct par employé. Sans validateur assigné ici, les demandes de congé de cet employé seront bloquées à la soumission.
            </p>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Validateur</label>
              <TableLookupField
                :code="validatorCode" :name="form.directValidatorName"
                value-key="id" name-key="label"
                :columns="validatorColumns" :fetch-fn="fetchValidatorCandidates"
                :is-item-disabled="isValidatorDisabled" :item-disabled-reason="validatorDisabledReason"
                modal-title="Sélectionner un validateur" placeholder="Code employé"
                @update:code="validatorCode = $event" @update:name="form.directValidatorName = $event" @select="onValidatorSelect"
              />
            </div>
          </FormSection>
        </div>
      </div>
    </template>
  </CreateModalShell>
</template>
