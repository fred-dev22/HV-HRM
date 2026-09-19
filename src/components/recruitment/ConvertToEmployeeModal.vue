<script setup lang="ts">
/**
 * Conversion d'un candidat retenu en vrai compte Employe ("Inclusion d'un
 * Potentiel"). Pre-remplit ce qu'on connait deja depuis la proposition
 * d'embauche (nom, entite, type de contrat) et demande le reste (etat civil,
 * piece d'identite, entite reelle). Utilise pour deux points d'entree :
 *  - mode 'contract' : bouton "Passer la candidature en employe" sur la fiche contrat
 *  - mode 'trial'    : confirmation de periode d'essai sans employe rattache
 */
import { ref, reactive, computed, watch, watchEffect } from 'vue'
import CreateModalShell from '../shared/CreateModalShell.vue'
import FormSection from '../ui/form-field/FormSection.vue'
import TableLookupField from '../ui/table-lookup/TableLookupField.vue'
import type { LookupFetchParams } from '../ui/table-lookup/TableLookupField.vue'
import * as cls from '../../lib/formClasses'
import { withToast } from '../../lib/withToast'
import { useSubmitGuard } from '../../lib/submitGuard'
import { getApiErrorMessage } from '../../lib/api'
import { useEntityStore } from '../../stores/entities'
import { useEmployeeStore } from '../../stores/employees'
import { useContractStore, useTrialStore } from '../../stores/recruitment'
import type { Contract } from '../../stores/recruitment'

const props = defineProps<{
  open: boolean
  contract: Contract
  mode: 'contract' | 'trial'
  /** requis en mode 'trial' */
  trialId?: string
}>()
const emit = defineEmits<{ close: []; done: [] }>()

const entityStore = useEntityStore()
const employeeStore = useEmployeeStore()
const contractStore = useContractStore()
const trialStore = useTrialStore()

const GENDERS = [
  { value: 'M', label: 'Masculin' },
  { value: 'F', label: 'Féminin' },
]
const MARITAL = [
  { value: 'Single', label: 'Célibataire' },
  { value: 'Married', label: 'Marié(e)' },
  { value: 'Divorced', label: 'Divorcé(e)' },
  { value: 'Widowed', label: 'Veuf(ve)' },
]
const ID_TYPES = [
  { value: 'NationalId', label: "Carte d'identité nationale" },
  { value: 'Passport', label: 'Passeport' },
  { value: 'ResidencePermit', label: 'Titre de séjour' },
]
const CONTRACT_TYPES = [
  { value: 'Permanent', label: 'CDI' },
  { value: 'FixedTerm', label: 'CDD' },
  { value: 'Internship', label: 'Stage' },
  { value: 'Freelance', label: 'Freelance' },
  { value: 'Apprenticeship', label: 'Apprentissage' },
  { value: 'WorkStudy', label: 'Alternance' },
]

function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/)
  if (parts.length <= 1) return { first: full.trim(), last: '' }
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1]! }
}

const form = reactive({
  FirstName: '',
  LastName: '',
  Gender: 'M',
  BirthDate: '',
  BirthPlace: '',
  MaritalStatus: 'Single',
  IdType: 'NationalId',
  IdNumber: '',
  MobilePhone: '',
  WorkPhone: '',
  Email: '',
  ContractType: 'Permanent',
  OrganizationUnitId: '',
  PositionId: '',
  EmployeeCategoryId: '',
  IsExpatriate: false,
  DirectValidatorId: '' as string,
})
const error = ref<string>('')

// Validateur direct de conges : n'existe que si l'entite choisie est en mode
// "validateur direct par employe" (sinon le pool de l'entite s'applique).
// Meme comportement qu'a la creation d'un employe (EmployeeCreate.vue) : le
// responsable de l'entite est propose par defaut, modifiable.
const showDirectValidatorSection = computed(() =>
  !!form.OrganizationUnitId && entityStore.getEntityById(form.OrganizationUnitId)?.leaveApprovalMode === 'DirectValidator')

// Eligibilite = compte actif ET permission CONGE_VALIDER reellement accordee
// (meme regle que le selecteur de la creation et le controle serveur).
function canValidateLeave(e: { validatorPermissions?: string[] }): boolean {
  return !!e.validatorPermissions?.includes('CONGE_VALIDER')
}
const validatorColumns = [{ key: 'code', label: 'Matricule', width: '90px' }, { key: 'label', label: 'Nom' }]
function fetchValidatorCandidates({ searchQuery }: LookupFetchParams) {
  let items = employeeStore.employees.map(e => ({
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
const validatorName = ref('')
const validatorCode = ref('')
// Vrai des que l'utilisateur choisit OU vide lui-meme le validateur : le
// defaut (responsable de l'entite) ne doit jamais ecraser ce choix.
const validatorTouched = ref(false)
function onValidatorSelect(item: Record<string, unknown>) {
  validatorTouched.value = true
  form.DirectValidatorId = String(item.id)
  validatorName.value = String(item.label)
  validatorCode.value = String(item.code)
}
// Le champ lookup vide seulement son libelle a la croix : sans ceci l'ancien
// id resterait envoye alors que le champ parait vide.
function onValidatorNameUpdate(name: string) {
  validatorName.value = name
  if (!name) { form.DirectValidatorId = ''; validatorTouched.value = true }
}
// Defaut = responsable de l'entite choisie, seulement s'il est reellement
// eligible (le backend refuse sinon la creation). Rejoue a chaque changement
// d'entite et une fois la liste des employes chargee.
watchEffect(() => {
  if (!props.open || validatorTouched.value) return
  const headId = showDirectValidatorSection.value ? entityStore.getEntityById(form.OrganizationUnitId)?.managerId : null
  const head = headId ? employeeStore.employees.find(e => e.id === headId) : undefined
  if (head && !isValidatorDisabled(head)) {
    form.DirectValidatorId = head.id
    validatorName.value = head.name
    validatorCode.value = head.code
  } else {
    form.DirectValidatorId = ''
    validatorName.value = ''
    validatorCode.value = ''
  }
})

function prefill() {
  if (entityStore.entities.length === 0) entityStore.fetchAll()
  // Liste complete (pas directory, qui n'expose jamais hasAccount) : necessaire
  // au selecteur de validateur direct.
  if (employeeStore.employees.length === 0) employeeStore.fetchAll()
  validatorTouched.value = false
  const { first, last } = splitName(props.contract.candidateName)
  form.FirstName = first
  form.LastName = last
  form.MobilePhone = props.contract.candidatePhone ?? ''
  form.Email = props.contract.candidateEmail ?? ''
  // Entite : pre-selectionne par correspondance de nom (insensible a la casse).
  const match = entityStore.approvedEntities.find(
    (e) => e.name.toLowerCase() === (props.contract.entityName ?? '').toLowerCase(),
  )
  form.OrganizationUnitId = match?.id ?? ''
  error.value = ''
}

watch(() => props.open, (o) => { if (o) prefill() }, { immediate: true })

function buildPayload(): Record<string, unknown> {
  const p: Record<string, unknown> = {
    FirstName: form.FirstName.trim() || undefined,
    LastName: form.LastName.trim() || undefined,
    Gender: form.Gender,
    BirthDate: form.BirthDate,
    MaritalStatus: form.MaritalStatus,
    IdType: form.IdType,
    OrganizationUnitId: form.OrganizationUnitId,
    ContractType: form.ContractType,
    IsExpatriate: form.IsExpatriate,
  }
  if (form.BirthPlace.trim()) p.BirthPlace = form.BirthPlace.trim()
  if (form.IdNumber.trim()) p.IdNumber = form.IdNumber.trim()
  if (form.MobilePhone.trim()) p.MobilePhone = form.MobilePhone.trim()
  if (form.WorkPhone.trim()) p.WorkPhone = form.WorkPhone.trim()
  if (form.Email.trim()) p.Email = form.Email.trim()
  if (form.PositionId) p.PositionId = form.PositionId
  if (form.EmployeeCategoryId) p.EmployeeCategoryId = form.EmployeeCategoryId
  if (showDirectValidatorSection.value && form.DirectValidatorId) p.DirectValidatorId = form.DirectValidatorId
  return p
}

const { submitting, guard } = useSubmitGuard()
async function submit() {
  if (!form.LastName.trim()) { error.value = 'Le nom est requis'; return }
  if (!form.BirthDate) { error.value = 'La date de naissance est requise'; return }
  if (!form.OrganizationUnitId) { error.value = "L'entité de rattachement est requise"; return }
  error.value = ''
  try {
    if (props.mode === 'contract') {
      await guard(() => withToast('Passage en employé...', () => contractStore.convertToEmployee(props.contract.id, buildPayload()), () => 'Conversion impossible'))
    } else {
      await guard(() => withToast('Confirmation...', () => trialStore.convert(props.trialId!, buildPayload()), () => 'Confirmation impossible'))
    }
    emit('done')
    emit('close')
  } catch (e) {
    error.value = getApiErrorMessage(e, 'Conversion impossible')
  }
}
</script>

<template>
  <CreateModalShell
    v-if="open"
    title="Passer la candidature en employé"
    banner-label="Conversion en employé"
    create-label="Passer en employé"
    :is-saving="submitting"
    :save-error="error"
    @close="emit('close')"
    @create="submit"
  >
    <template #form>
      <div class="flex-1 overflow-auto px-6 py-5">
        <div class="max-w-3xl mx-auto">
          <p class="text-[12px] text-muted-foreground mb-4">
            Le candidat va être ajouté à la liste des employés (Administration) à partir de cette proposition d'embauche.
            Complétez les informations non connues du recrutement. Le compte de connexion se crée ensuite depuis sa fiche employé.
          </p>

          <FormSection title="Identité">
            <div class="grid grid-cols-2 gap-x-6 gap-y-4 max-sm:grid-cols-1">
              <div :class="cls.field">
                <label :class="cls.fieldLabel">Prénom</label>
                <input v-model="form.FirstName" :class="cls.fieldInput" />
              </div>
              <div :class="cls.field">
                <label :class="cls.fieldLabel">Nom <span class="text-danger">*</span></label>
                <input v-model="form.LastName" :class="cls.fieldInput" />
              </div>
              <div :class="cls.field">
                <label :class="cls.fieldLabel">Sexe <span class="text-danger">*</span></label>
                <select v-model="form.Gender" :class="cls.fieldSelect">
                  <option v-for="g in GENDERS" :key="g.value" :value="g.value">{{ g.label }}</option>
                </select>
              </div>
              <div :class="cls.field">
                <label :class="cls.fieldLabel">Date de naissance <span class="text-danger">*</span></label>
                <input v-model="form.BirthDate" type="date" :class="cls.fieldInput" />
              </div>
              <div :class="cls.field">
                <label :class="cls.fieldLabel">Lieu de naissance</label>
                <input v-model="form.BirthPlace" :class="cls.fieldInput" />
              </div>
              <div :class="cls.field">
                <label :class="cls.fieldLabel">Situation matrimoniale <span class="text-danger">*</span></label>
                <select v-model="form.MaritalStatus" :class="cls.fieldSelect">
                  <option v-for="m in MARITAL" :key="m.value" :value="m.value">{{ m.label }}</option>
                </select>
              </div>
              <div :class="cls.field">
                <label :class="cls.fieldLabel">Type de pièce d'identité <span class="text-danger">*</span></label>
                <select v-model="form.IdType" :class="cls.fieldSelect">
                  <option v-for="t in ID_TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
                </select>
              </div>
              <div :class="cls.field">
                <label :class="cls.fieldLabel">Numéro de pièce</label>
                <input v-model="form.IdNumber" :class="cls.fieldInput" />
              </div>
            </div>
          </FormSection>

          <FormSection title="Coordonnées">
            <div class="grid grid-cols-2 gap-x-6 gap-y-4 max-sm:grid-cols-1">
              <div :class="cls.field">
                <label :class="cls.fieldLabel">Téléphone mobile</label>
                <input v-model="form.MobilePhone" :class="cls.fieldInput" />
              </div>
              <div :class="cls.field">
                <label :class="cls.fieldLabel">Email</label>
                <input v-model="form.Email" type="email" :class="cls.fieldInput" />
              </div>
            </div>
          </FormSection>

          <FormSection title="Rattachement">
            <div class="grid grid-cols-2 gap-x-6 gap-y-4 max-sm:grid-cols-1">
              <div :class="cls.field">
                <label :class="cls.fieldLabel">Entité de rattachement <span class="text-danger">*</span></label>
                <select v-model="form.OrganizationUnitId" :class="cls.fieldSelect">
                  <option value="">Sélectionnez une entité</option>
                  <option v-for="e in entityStore.approvedEntities" :key="e.id" :value="e.id">{{ e.code }} · {{ e.name }}</option>
                </select>
              </div>
              <div :class="cls.field">
                <label :class="cls.fieldLabel">Type de contrat <span class="text-danger">*</span></label>
                <select v-model="form.ContractType" :class="cls.fieldSelect">
                  <option v-for="c in CONTRACT_TYPES" :key="c.value" :value="c.value">{{ c.label }}</option>
                </select>
              </div>
              <div :class="cls.field" class="col-span-full">
                <label class="flex items-center gap-2 text-[13px] text-foreground">
                  <input v-model="form.IsExpatriate" type="checkbox" /> Salarié expatrié (régime de congés spécifique)
                </label>
              </div>
            </div>
          </FormSection>

          <!-- Validation des congés : seulement si l'entité choisie est en mode
               "validateur direct" ; le responsable de l'entité est proposé par défaut. -->
          <FormSection v-if="showDirectValidatorSection" title="Validation des congés">
            <p class="text-[11px] text-muted-foreground -mt-0.5 mb-3">
              Cette entité utilise un validateur direct par employé. Sans validateur assigné ici, les demandes de congé de cet employé seront bloquées à la soumission.
            </p>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Validateur</label>
              <TableLookupField
                :code="validatorCode" :name="validatorName"
                value-key="id" name-key="label"
                :columns="validatorColumns" :fetch-fn="fetchValidatorCandidates"
                :is-item-disabled="isValidatorDisabled" :item-disabled-reason="validatorDisabledReason"
                modal-title="Sélectionner un validateur" placeholder="Code employé"
                @update:code="validatorCode = $event" @update:name="onValidatorNameUpdate" @select="onValidatorSelect"
              />
            </div>
          </FormSection>
        </div>
      </div>
    </template>
  </CreateModalShell>
</template>
