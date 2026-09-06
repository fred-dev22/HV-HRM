<script setup lang="ts">
/**
 * Fiche de création d'une entité — sur CreateModalShell (pattern frontdesk).
 * Entité parente et responsable via TableLookupField.
 */
import { ref, reactive } from 'vue'
import { Info } from 'lucide-vue-next'
import CreateModalShell from '../shared/CreateModalShell.vue'
import TableLookupField from '../ui/table-lookup/TableLookupField.vue'
import type { LookupFetchParams } from '../ui/table-lookup/TableLookupField.vue'
import FormSection from '../ui/form-field/FormSection.vue'
import * as cls from '../../lib/formClasses'
import { suggestCode } from '../../lib/codeGen'
import { useEntityStore } from '../../stores/entities'
import { useEmployeeStore } from '../../stores/employees'
import type { EntityType } from '../../types'

const emit = defineEmits<{ close: []; created: [] }>()
const store = useEntityStore()
const empStore = useEmployeeStore()
if (empStore.employees.length === 0) empStore.fetchAll()

const entityColumns = [{ key: 'code', label: 'Code', width: '90px' }, { key: 'name', label: 'Nom' }]
// Une entité désactivée reste visible (grisée, non sélectionnable) plutôt
// que de disparaître — voir même pattern dans EntityCard.vue.
function fetchParents({ searchQuery }: LookupFetchParams) {
  let items = store.entities.filter(e => e.status === 'Active' || e.status === 'Inactive')
  if (searchQuery) { const q = searchQuery.toLowerCase(); items = items.filter(e => e.name.toLowerCase().includes(q) || e.code.toLowerCase().includes(q)) }
  return { items, total: items.length }
}
function isEntityDisabled(item: { status?: string }) { return item.status === 'Inactive' }

const employeeColumns = [{ key: 'code', label: 'Matricule', width: '90px' }, { key: 'name', label: 'Nom' }]
function fetchManagers({ searchQuery }: LookupFetchParams) {
  let items = empStore.employees
  if (searchQuery) { const q = searchQuery.toLowerCase(); items = items.filter(e => e.name.toLowerCase().includes(q) || e.code.toLowerCase().includes(q)) }
  return { items, total: items.length }
}
function isEmployeeDisabled(item: { status?: string }) { return item.status !== 'active' }

const parentCode = ref('')
const managerCode = ref('')
const form = reactive({ name: '', code: '', type: '' as EntityType | '', parentId: '' as string | null, parentName: '', legalIdentifier: '', address: '', managerId: '' as string | null, responsibleName: '', phone: '', email: '' })
const error = ref('')

// Le code suit l'intitulé tant que l'utilisateur ne l'a pas modifié à la
// main (voir décision du 25/07 : suggestion courte dérivée du nom, modifiable).
const codeTouched = ref(false)
function onNameInput() {
  if (!codeTouched.value) form.code = suggestCode(form.name, store.entities.length)
}
function onCodeInput() { codeTouched.value = true }

function onParentSelect(item: Record<string, unknown>) { form.parentId = String(item.id); form.parentName = String(item.name); parentCode.value = String(item.code) }
function onManagerSelect(item: Record<string, unknown>) { form.managerId = String(item.id); form.responsibleName = String(item.name); managerCode.value = String(item.code) }

function validate(): boolean {
  if (!form.name.trim()) { error.value = "L'intitulé est obligatoire"; return false }
  if (!form.code.trim()) { error.value = 'Le code est obligatoire'; return false }
  if (!form.type) { error.value = 'Veuillez choisir un type'; return false }
  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { error.value = 'Format email invalide'; return false }
  error.value = ''
  return true
}

function buildPayload(): Parameters<typeof store.createEntity>[0] {
  return {
    code: form.code, name: form.name, type: form.type as EntityType, parentId: form.parentId || null,
    legalIdentifier: form.legalIdentifier || undefined,
    managerId: form.managerId || null,
    address: form.address || undefined,
    phone: form.phone || undefined, email: form.email || undefined,
  }
}

async function create() {
  if (!validate()) return
  try {
    const created = await store.createEntity(buildPayload())
    await store.submitEntity(created.id)
    emit('created'); emit('close')
  } catch {
    error.value = store.error ?? "La création a échoué. Veuillez réessayer."
  }
}
async function saveDraft() {
  if (!validate()) return
  try {
    await store.createEntity(buildPayload())
    emit('created'); emit('close')
  } catch {
    error.value = store.error ?? "La création a échoué. Veuillez réessayer."
  }
}
</script>

<template>
  <CreateModalShell
    title="Nouvelle entité"
    banner-label="Nouvelle entité"
    create-label="Enregistrer et soumettre"
    :save-error="error"
    @close="emit('close')"
    @create="create"
  >
    <template #form>
      <div class="flex-1 overflow-auto px-6 py-5">
        <div class="max-w-3xl mx-auto">
          <FormSection title="Informations générales">
          <div class="grid grid-cols-2 gap-x-6 gap-y-4 max-sm:grid-cols-1">
            <div :class="[cls.field, 'col-span-full']">
              <label :class="cls.fieldLabel">Intitulé <span class="text-danger">*</span></label>
              <input v-model="form.name" :class="cls.fieldInput" placeholder="ex : Direction des Ressources Humaines" @input="onNameInput" />
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Code <span class="text-danger">*</span></label>
              <input v-model="form.code" :class="cls.fieldInput" placeholder="ex : DIRE-RESS-001" @input="onCodeInput" />
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Type <span class="text-danger">*</span></label>
              <select v-model="form.type" :class="cls.fieldSelect"><option value="">-- Choisir --</option><option value="Direction">Direction</option><option value="Department">Département</option><option value="Service">Service</option></select>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Entité parente</label>
              <TableLookupField :code="parentCode" :name="form.parentName" value-key="code" name-key="name" :columns="entityColumns" :fetch-fn="fetchParents" :is-item-disabled="isEntityDisabled" :item-disabled-reason="() => 'entité désactivée'" modal-title="Sélectionner l'entité parente" placeholder="Code entité" @update:code="parentCode = $event" @update:name="form.parentName = $event" @select="onParentSelect" />
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Identifiant légal</label>
              <input v-model="form.legalIdentifier" :class="cls.fieldInput" placeholder="ex : GPL-001" />
            </div>
            <div :class="[cls.field, 'col-span-full']">
              <label :class="cls.fieldLabel">Adresse</label>
              <textarea v-model="form.address" :class="cls.fieldTextarea" rows="2"></textarea>
            </div>
          </div>

          </FormSection>

          <FormSection title="Contact & Responsable">
          <div class="grid grid-cols-2 gap-x-6 gap-y-4 max-sm:grid-cols-1">
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Responsable</label>
              <TableLookupField :code="managerCode" :name="form.responsibleName" value-key="code" name-key="name" :columns="employeeColumns" :fetch-fn="fetchManagers" :is-item-disabled="isEmployeeDisabled" :item-disabled-reason="() => 'compte désactivé'" modal-title="Sélectionner le responsable" placeholder="Matricule" @update:code="managerCode = $event" @update:name="form.responsibleName = $event" @select="onManagerSelect" />
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Téléphone</label>
              <input type="tel" v-model="form.phone" :class="cls.fieldInput" placeholder="+261 …" />
            </div>
            <div :class="[cls.field, 'col-span-full']">
              <label :class="cls.fieldLabel">Email</label>
              <input type="email" v-model="form.email" :class="cls.fieldInput" placeholder="service@hv.com" />
            </div>
          </div>
          </FormSection>

          <div class="flex items-start gap-2 bg-info-bg text-info text-xs rounded-md px-3 py-2.5">
            <Info class="w-3.5 h-3.5 shrink-0 mt-px" />
            <span>Les validateurs (N+1 à N+4, par type de demande) se configurent après la création, depuis la fiche de l'entité.</span>
          </div>

          <div class="mt-6 pt-4 border-t border-border flex justify-end">
            <button :class="cls.btnOutline" @click="saveDraft">Enregistrer en brouillon</button>
          </div>
        </div>
      </div>
    </template>
  </CreateModalShell>
</template>
