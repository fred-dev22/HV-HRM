<template>
  <div class="px-7 py-6">

        <div :class="L.pageHeader">
          <div>
            <div :class="L.pageTitle">{{ isEdit ? t('employee.edit_title') : t('employee.new') }}</div>
            <div :class="L.pageSub" v-if="isEdit && editEmp">{{ editEmp.name }}</div>
          </div>
          <router-link :to="{ name: 'hr-employees' }" :class="L.btnOutline">
            <ArrowLeft class="w-4 h-4" /> {{ t('employee.btn_cancel') }}
          </router-link>
        </div>

        <div v-if="formLoading" class="flex justify-center">
          <div class="w-full max-w-[800px]">
            <SkeletonLoader type="form" :lines="8" />
          </div>
        </div>

        <div v-else class="flex justify-center">
          <div class="w-full max-w-[800px] bg-card border border-border rounded-lg p-6 flex flex-col gap-6">

            <!-- ── Section 1 : Identité ── -->
            <div class="flex flex-col gap-3.5">
              <div :class="sectionTitle"><User class="w-4 h-4 text-primary" /> {{ t('employee.section_identity') }}</div>
              <div :class="fieldGrid">
                <div :class="cls.field">
                  <label :class="cls.fieldLabel">{{ t('employee.field_first_name') }} *</label>
                  <input v-model="form.firstName" :class="[cls.fieldInput, err.firstName && cls.inputError]" :placeholder="t('employee.placeholder_first')" />
                  <div v-if="err.firstName" :class="cls.fieldError">{{ err.firstName }}</div>
                </div>
                <div :class="cls.field">
                  <label :class="cls.fieldLabel">{{ t('employee.field_last_name') }} *</label>
                  <input v-model="form.lastName" :class="[cls.fieldInput, err.lastName && cls.inputError]" :placeholder="t('employee.placeholder_last')" />
                  <div v-if="err.lastName" :class="cls.fieldError">{{ err.lastName }}</div>
                </div>
                <div :class="cls.field">
                  <label :class="cls.fieldLabel">{{ t('employee.field_code') }} *</label>
                  <input v-model="form.code" :class="[cls.fieldInput, err.code && cls.inputError]" :placeholder="t('employee.placeholder_code')" @input="form.code = (form.code as string).toUpperCase()" />
                  <div v-if="err.code" :class="cls.fieldError">{{ err.code }}</div>
                </div>
                <div :class="cls.field">
                  <label :class="cls.fieldLabel">{{ t('employee.field_email') }} <span class="text-danger">*</span></label>
                  <input v-model="form.email" type="email" :class="[cls.fieldInput, err.email && cls.inputError]" :placeholder="t('employee.placeholder_email')" />
                  <div v-if="err.email" :class="cls.fieldError">{{ err.email }}</div>
                </div>
                <div :class="cls.field">
                  <label :class="cls.fieldLabel">{{ t('employee.field_phone') }}</label>
                  <input v-model="form.phone" type="tel" :class="cls.fieldInput" :placeholder="t('employee.placeholder_phone')" />
                </div>
                <div :class="cls.field">
                  <label :class="cls.fieldLabel">{{ t('employee.field_gender') }} *</label>
                  <select v-model="form.gender" :class="[cls.fieldSelect, err.gender && cls.inputError]">
                    <option value="">{{ t('employee.placeholder_gender') }}</option>
                    <option value="M">{{ t('employee.gender_m') }}</option>
                    <option value="F">{{ t('employee.gender_f') }}</option>
                  </select>
                  <div v-if="err.gender" :class="cls.fieldError">{{ err.gender }}</div>
                </div>
                <div :class="cls.field">
                  <label :class="cls.fieldLabel">{{ t('employee.field_birth_date') }} *</label>
                  <input v-model="form.birthDate" type="date" :max="todayIso()" :class="[cls.fieldInput, err.birthDate && cls.inputError]" />
                  <div v-if="err.birthDate" :class="cls.fieldError">{{ err.birthDate }}</div>
                </div>
                <div :class="cls.field">
                  <label :class="cls.fieldLabel">{{ t('employee.field_birth_place') }}</label>
                  <input v-model="form.birthPlace" :class="cls.fieldInput" :placeholder="t('employee.placeholder_birth_place')" />
                </div>
                <div :class="cls.field">
                  <label :class="cls.fieldLabel">{{ t('employee.field_marital_status') }} *</label>
                  <select v-model="form.maritalStatus" :class="[cls.fieldSelect, err.maritalStatus && cls.inputError]">
                    <option value="">{{ t('employee.placeholder_marital_status') }}</option>
                    <option value="Single">{{ t('employee.marital_single') }}</option>
                    <option value="Married">{{ t('employee.marital_married') }}</option>
                    <option value="Divorced">{{ t('employee.marital_divorced') }}</option>
                    <option value="Widowed">{{ t('employee.marital_widowed') }}</option>
                  </select>
                  <div v-if="err.maritalStatus" :class="cls.fieldError">{{ err.maritalStatus }}</div>
                </div>
                <div :class="cls.field">
                  <label :class="cls.fieldLabel">{{ t('employee.field_id_type') }} *</label>
                  <select v-model="form.idType" :class="[cls.fieldSelect, err.idType && cls.inputError]">
                    <option value="">{{ t('employee.placeholder_id_type') }}</option>
                    <option value="NationalId">{{ t('employee.id_type_national') }}</option>
                    <option value="Passport">{{ t('employee.id_type_passport') }}</option>
                    <option value="ResidencePermit">{{ t('employee.id_type_residence') }}</option>
                  </select>
                  <div v-if="err.idType" :class="cls.fieldError">{{ err.idType }}</div>
                </div>
                <div :class="cls.field">
                  <label :class="cls.fieldLabel">{{ t('employee.field_id_number') }}</label>
                  <input v-model="form.idNumber" :class="cls.fieldInput" :placeholder="t('employee.placeholder_id_number')" />
                </div>
                <label class="flex items-start gap-2 col-span-full text-[13px] text-foreground cursor-pointer">
                  <input type="checkbox" v-model="form.isExpatriate" class="accent-primary mt-0.5" />
                  <span>
                    Employé expatrié
                    <span class="block text-[11px] text-muted-foreground mt-0.5">(régime de congés différent : le week-end n'est jamais décompté ; les jours fériés restent exclus dans les deux cas)</span>
                  </span>
                </label>
              </div>
            </div>

            <!-- ── Section 2 : Poste & Affectation ── -->
            <div class="flex flex-col gap-3.5">
              <div :class="sectionTitle"><Briefcase class="w-4 h-4 text-primary" /> {{ t('employee.section_position') }}</div>
              <div :class="fieldGrid">
                <div :class="[cls.field, 'col-span-full']">
                  <label :class="cls.fieldLabel">{{ t('employee.field_position') }}</label>
                  <TableLookupField
                    :code="positionCode" :name="form.positionTitle"
                    value-key="code" name-key="title"
                    :columns="positionColumns" :fetch-fn="fetchPositions"
                    :modal-title="t('employee.field_position')" :placeholder="t('employee.placeholder_position')"
                    @update:code="positionCode = $event" @update:name="form.positionTitle = $event" @select="onPositionSelect"
                  />
                </div>
                <div :class="cls.field">
                  <label :class="cls.fieldLabel">{{ t('employee.field_entity') }} *</label>
                  <select v-model="form.entityId" :class="[cls.fieldSelect, err.entityId && cls.inputError]" @change="onEntityChange">
                    <option value="">{{ t('employee.placeholder_entity') }}</option>
                    <option
                      v-for="e in entityStore.entities.filter(x => x.status === 'Active' || x.status === 'Inactive')" :key="e.id" :value="e.id"
                      :disabled="e.status === 'Inactive'"
                      :title="e.status === 'Inactive' ? 'Entité désactivée' : ''"
                    >
                      {{ e.code }} · {{ e.name }}{{ e.status === 'Inactive' ? ' (désactivée)' : '' }}
                    </option>
                  </select>
                  <div v-if="err.entityId" :class="cls.fieldError">{{ err.entityId }}</div>
                </div>
                <div :class="cls.field">
                  <label :class="cls.fieldLabel">Catégorie *</label>
                  <select v-model="form.employeeCategoryId" :class="[cls.fieldSelect, err.employeeCategoryId && cls.inputError]">
                    <option value="">-- Choisir --</option>
                    <option v-for="c in categoryStore.categories" :key="c.id" :value="c.id">{{ c.name }}</option>
                  </select>
                  <div v-if="err.employeeCategoryId" :class="cls.fieldError">{{ err.employeeCategoryId }}</div>
                </div>
                <div :class="cls.field">
                  <label :class="cls.fieldLabel">{{ t('employee.field_contract') }} *</label>
                  <select v-model="form.contractType" :class="[cls.fieldSelect, err.contractType && cls.inputError]">
                    <option value="">{{ t('employee.placeholder_contract') }}</option>
                    <option value="CDI">CDI</option>
                    <option value="CDD">CDD</option>
                    <option value="Stage">Stage</option>
                    <option value="Freelance">Freelance</option>
                    <option value="Apprenti">Apprenti</option>
                    <option value="Alternant">Alternant</option>
                  </select>
                  <div v-if="err.contractType" :class="cls.fieldError">{{ err.contractType }}</div>
                </div>
                <div :class="cls.field">
                  <label :class="cls.fieldLabel">{{ t('employee.field_hire_date') }} *</label>
                  <input v-model="form.hireDate" type="date" :max="todayIso()" :class="[cls.fieldInput, err.hireDate && cls.inputError]" />
                  <div v-if="err.hireDate" :class="cls.fieldError">{{ err.hireDate }}</div>
                </div>
                <div :class="cls.field">
                  <label :class="cls.fieldLabel">{{ t('employee.field_status') }}</label>
                  <select v-model="form.status" :class="cls.fieldSelect">
                    <option value="active">{{ t('employee.status_active') }}</option>
                    <option value="trial">{{ t('employee.status_trial') }}</option>
                    <option value="onleave">{{ t('employee.status_onleave') }}</option>
                    <option value="inactive">{{ t('employee.status_inactive') }}</option>
                  </select>
                </div>
              </div>
            </div>

            <!-- ── Section 3 : Manager ── -->
            <div class="flex flex-col gap-3.5">
              <div :class="sectionTitle"><ShieldCheck class="w-4 h-4 text-primary" /> {{ t('employee.section_manager') }}</div>
              <p class="text-xs text-muted-foreground -mt-2">{{ t('employee.manager_desc') }}</p>
              <div :class="fieldGrid">
                <div :class="[cls.field, 'col-span-full']">
                  <label :class="cls.fieldLabel">
                    {{ t('employee.field_manager') }}
                    <span class="inline-flex items-center gap-[3px] text-[10px] font-semibold text-muted-foreground bg-background border border-border rounded-full px-1.5 py-px ml-1.5 align-middle">
                      <Lock class="w-2.5 h-2.5" /> {{ t('employee.manager_auto') }}
                    </span>
                  </label>
                  <div
                    class="flex items-center gap-2 h-9 px-2.5 border border-border rounded-md bg-background text-[13px] text-foreground"
                    :class="{ 'text-muted-foreground italic': !directManager }"
                  >
                    <template v-if="directManager">
                      <span class="font-medium">{{ directManager.name }}</span>
                      <span class="text-muted-foreground text-xs">· {{ t('employee.manager_role') }}</span>
                    </template>
                    <span v-else class="text-xs text-muted-foreground">{{ t('employee.manager_placeholder') }}</span>
                  </div>
                  <span class="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Info class="w-3 h-3 text-primary" />
                    {{ t('employee.manager_hint') }}
                  </span>
                </div>
              </div>
            </div>

            <!-- ── Actions ── -->
            <p v-if="saveError" class="text-xs text-danger bg-danger-bg px-3 py-2 rounded-md">{{ saveError }}</p>
            <div class="flex gap-2 justify-end pt-2 border-t border-border">
              <button :class="cls.btnPrimary" @click="handleSave">
                <Save class="w-4 h-4" />
                {{ isEdit ? t('employee.btn_update') : t('employee.btn_save') }}
              </button>
            </div>

          </div>
        </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, computed, ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowLeft, User, Briefcase, ShieldCheck, Save, Lock, Info } from 'lucide-vue-next'
import { SkeletonLoader } from '../../components'
import TableLookupField from '../../components/ui/table-lookup/TableLookupField.vue'
import type { LookupFetchParams } from '../../components/ui/table-lookup/TableLookupField.vue'
import * as cls from '../../lib/formClasses'
import * as L from '../../lib/listClasses'
import { todayIso } from '../../lib/date'
import { useEmployeeStore } from '../../stores/employees'
import { useEntityStore }   from '../../stores/entities'
import { usePositionStore } from '../../stores/positions'
import { useEmployeeCategoryStore } from '../../stores/employeeCategories'
import type { ContractType, EmployeeStatus, Gender, MaritalStatus, IdDocumentType } from '../../types'

const { t }       = useI18n()
const store       = useEmployeeStore()
const entityStore = useEntityStore()
const positionStore = usePositionStore()
const categoryStore = useEmployeeCategoryStore()
const router      = useRouter()
const route       = useRoute()

// ── Classes du design system ─────────────────────────────────
const sectionTitle = 'flex items-center gap-2 text-sm font-semibold pb-2.5 border-b border-border'
const fieldGrid = 'grid grid-cols-2 gap-3.5 max-sm:grid-cols-1'

const empId  = computed(() => route.params.id as string | undefined)
const isEdit = computed(() => !!empId.value)
const editEmp = computed(() => empId.value ? store.getById(empId.value) : undefined)

const positionColumns = [
  { key: 'code', label: 'Code', width: '90px' },
  { key: 'title', label: 'Poste' },
  { key: 'remaining', label: 'Places dispo.', width: '100px' },
]
function fetchPositions({ searchQuery }: LookupFetchParams) {
  // Un poste dont tous les sieges sont occupes ne doit plus etre propose —
  // sauf celui deja affecte a cet employe (sinon on ne pourrait plus
  // voir/reselectionner le sien) (voir Position.Capacity / decision du 30/07).
  let items = positionStore.positions.filter(p => p.occupiedCount < p.capacity || p.id === form.positionId)
  if (searchQuery) {
    const q = searchQuery.toLowerCase()
    items = items.filter(p => p.title.toLowerCase().includes(q) || p.code.toLowerCase().includes(q))
  }
  const withRemaining = items.map(p => ({ ...p, remaining: `${p.capacity - p.occupiedCount}/${p.capacity}` }))
  return { items: withRemaining, total: withRemaining.length }
}
const positionCode = ref('')
// Un poste est rattache a une entite (voir Position.organizationUnitId) —
// le choisir remplit automatiquement l'entite de l'employe, modifiable
// ensuite si besoin (voir decision reunion du 25/07).
function onPositionSelect(item: Record<string, unknown>) {
  form.positionId = String(item.id); form.positionTitle = String(item.title); positionCode.value = String(item.code)
  const position = positionStore.positions.find(p => p.id === form.positionId)
  if (position?.organizationUnitId) {
    const entity = entityStore.getEntityById(position.organizationUnitId)
    if (entity) {
      form.entityId = entity.id
      onEntityChange()
    }
  }
}

const form = reactive({
  firstName:    '',
  lastName:     '',
  code:         '',
  email:        '',
  phone:        '',
  positionId:   '' as string | null,
  positionTitle: '',
  entityId:     '' as string | null,
  entityName:   '',
  employeeCategoryId: '' as string,
  contractType: '' as ContractType | '',
  hireDate:     '',
  status:       'active' as EmployeeStatus,
  gender:        '' as Gender | '',
  birthDate:     '',
  birthPlace:    '',
  maritalStatus: '' as MaritalStatus | '',
  idType:        '' as IdDocumentType | '',
  idNumber:      '',
  isExpatriate:  false,
})

const err = reactive({
  firstName: '', lastName: '', code: '', email: '',
  entityId: '', employeeCategoryId: '', contractType: '', hireDate: '',
  gender: '', birthDate: '', maritalStatus: '', idType: '',
})
const saveError = ref('')

// Manager auto-dérivé du responsable de l'entité choisie — pas éditable
// directement (voir Employee.managerId, déduit de l'entité de rattachement).
const directManager = computed(() => {
  const entity = entityStore.entities.find(e => e.id === form.entityId)
  if (!entity?.responsibleName) return null
  return { name: entity.responsibleName, managerId: entity.managerId ?? null }
})

function onEntityChange() {
  const e = entityStore.getEntityById(form.entityId ?? '')
  form.entityName = e?.name ?? ''
}

function populateForm(e: NonNullable<typeof editEmp.value>) {
  form.firstName     = e.firstName
  form.lastName      = e.lastName
  form.code          = e.code
  form.email         = e.email ?? ''
  form.phone         = e.phone ?? ''
  form.positionId    = e.positionId ?? ''
  form.positionTitle = e.jobTitle
  positionCode.value = ''
  form.entityId      = e.entityId
  form.entityName    = e.entityName ?? ''
  form.employeeCategoryId = e.employeeCategoryId ?? ''
  form.contractType  = e.contractType
  form.hireDate      = e.hireDate
  form.status        = e.status
  form.gender        = e.gender
  form.birthDate     = e.birthDate
  form.birthPlace    = e.birthPlace ?? ''
  form.maritalStatus = e.maritalStatus
  form.idType        = e.idType
  form.idNumber      = e.idNumber ?? ''
  form.isExpatriate  = e.isExpatriate
}

const formLoading = ref(false)
onMounted(async () => {
  // entités/postes d'abord (séquencé, pas en parallèle avec les employés) :
  // mapEmployee lit ces deux stores de façon synchrone pour entityName/jobTitle.
  const preTasks: Promise<unknown>[] = []
  if (entityStore.entities.length === 0) preTasks.push(entityStore.fetchAll())
  // Toujours rafraichir les postes (pas de garde sur .length) — l'occupation
  // change a chaque creation/suppression d'employe ailleurs dans l'app.
  preTasks.push(positionStore.fetchAll())
  if (categoryStore.categories.length === 0) preTasks.push(categoryStore.fetchAll())
  if (preTasks.length > 0) await Promise.all(preTasks)

  if (isEdit.value && !store.getById(empId.value!)) {
    formLoading.value = true
    await store.fetchAll()
  }
  formLoading.value = false

  if (isEdit.value && editEmp.value) {
    populateForm(editEmp.value)
  } else if (!isEdit.value) {
    store.fetchNextNumber().then(n => { form.code = n }).catch(() => {})
  }
})

function validate(): boolean {
  Object.keys(err).forEach(k => ((err as Record<string, string>)[k] = ''))
  let ok = true
  if (!form.firstName.trim())     { err.firstName     = t('employee.err_first_name'); ok = false }
  if (!form.lastName.trim())      { err.lastName      = t('employee.err_last_name');  ok = false }
  if (!form.code.trim())          { err.code          = t('employee.err_code');       ok = false }
  if (!form.entityId)             { err.entityId      = t('employee.err_entity');     ok = false }
  if (!form.employeeCategoryId)   { err.employeeCategoryId = 'Catégorie requise';     ok = false }
  if (!form.contractType)         { err.contractType  = t('employee.err_contract');   ok = false }
  if (!form.hireDate)             { err.hireDate      = t('employee.err_hire_date');  ok = false }
  if (!form.gender)               { err.gender        = t('employee.err_gender');     ok = false }
  if (!form.birthDate)            { err.birthDate     = t('employee.err_birth_date'); ok = false }
  if (!form.maritalStatus)        { err.maritalStatus = t('employee.err_marital_status'); ok = false }
  if (!form.idType)               { err.idType        = t('employee.err_id_type');    ok = false }
  if (!form.email.trim()) { err.email = t('employee.err_email_required'); ok = false }
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { err.email = t('employee.err_email'); ok = false }
  return ok
}

async function handleSave() {
  if (!validate()) return
  saveError.value = ''

  const payload = {
    code:         form.code,
    firstName:    form.firstName,
    lastName:     form.lastName,
    employeeCategoryId: form.employeeCategoryId,
    jobTitle:     form.positionTitle,
    positionId:   form.positionId || undefined,
    entityId:     form.entityId,
    entityName:   form.entityName,
    contractType: form.contractType as ContractType,
    hireDate:     form.hireDate,
    status:       form.status,
    email:        form.email || undefined,
    phone:        form.phone || undefined,
    gender:        form.gender as Gender,
    birthDate:     form.birthDate,
    birthPlace:    form.birthPlace || undefined,
    maritalStatus: form.maritalStatus as MaritalStatus,
    idType:        form.idType as IdDocumentType,
    idNumber:      form.idNumber || undefined,
    isExpatriate:  form.isExpatriate,
  }

  try {
    if (isEdit.value && empId.value) {
      await store.updateEmployee(empId.value, payload)
    } else {
      // Un employé fraîchement créé n'a jamais de compte — hasAccount ne
      // devient vrai que via l'action "Créer un compte utilisateur".
      await store.createEmployee({ ...payload, hasAccount: false })
    }
    router.push({ name: 'hr-employees' })
  } catch {
    saveError.value = store.error ?? "L'enregistrement a échoué. Veuillez réessayer."
  }
}
</script>
