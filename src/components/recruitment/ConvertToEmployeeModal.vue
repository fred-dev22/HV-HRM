<script setup lang="ts">
/**
 * Conversion d'un candidat retenu en vrai compte Employe ("Inclusion d'un
 * Potentiel"). Pre-remplit ce qu'on connait deja depuis la proposition
 * d'embauche (nom, entite, type de contrat) et demande le reste (etat civil,
 * piece d'identite, entite reelle). Utilise pour deux points d'entree :
 *  - mode 'contract' : bouton "Creer le profil employe" sur la fiche contrat
 *  - mode 'trial'    : confirmation de periode d'essai sans employe rattache
 */
import { ref, reactive, watch } from 'vue'
import ModalShell from '../ui/ModalShell.vue'
import * as cls from '../../lib/formClasses'
import { withToast } from '../../lib/withToast'
import { useSubmitGuard } from '../../lib/submitGuard'
import { getApiErrorMessage } from '../../lib/api'
import { useEntityStore } from '../../stores/entities'
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
})
const error = ref<string>('')

function prefill() {
  if (entityStore.entities.length === 0) entityStore.fetchAll()
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
      await guard(() => withToast('Création du profil employé...', () => contractStore.convertToEmployee(props.contract.id, buildPayload()), () => 'Conversion impossible'))
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
  <ModalShell :open="open" title="Créer le profil employé" max-width="max-w-[640px]" @close="emit('close')">
    <p class="text-[12px] text-muted-foreground mb-3">
      Un vrai compte employé va être créé dans le module Employés à partir de cette proposition d'embauche.
      Complétez les informations non connues du recrutement.
    </p>

    <div class="grid grid-cols-2 gap-x-4 gap-y-3 max-sm:grid-cols-1">
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
      <div :class="cls.field">
        <label :class="cls.fieldLabel">Téléphone mobile</label>
        <input v-model="form.MobilePhone" :class="cls.fieldInput" />
      </div>
      <div :class="cls.field">
        <label :class="cls.fieldLabel">Email</label>
        <input v-model="form.Email" type="email" :class="cls.fieldInput" />
      </div>
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

    <div v-if="error" :class="cls.fieldError" class="mt-2">{{ error }}</div>

    <template #footer>
      <button :class="cls.btnPrimary" :disabled="submitting" @click="submit">Créer le profil employé</button>
      <button :class="cls.btnOutline" :disabled="submitting" @click="emit('close')">Annuler</button>
    </template>
  </ModalShell>
</template>
