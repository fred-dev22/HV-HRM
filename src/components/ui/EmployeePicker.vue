<template>
  <!-- Choix d'un employe : le meme partout dans l'application (matricule, nom, entite),
       celui de la demande de conge. Ne pas recreer un select ou une liste a part. -->
  <TableLookupField
    :label="label"
    :required="required"
    :code="selectedCode"
    :name="selectedName"
    :columns="lookupColumns"
    :fetch-fn="fetchEmployees"
    value-key="code"
    name-key="label"
    :modal-title="modalTitle"
    :placeholder="placeholder"
    :invalid="invalid"
    :disabled="disabled"
    :is-item-disabled="isDisabled"
    :item-disabled-reason="disabledReason"
    @select="onSelect"
    @update:code="onCode"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import TableLookupField from './table-lookup/TableLookupField.vue'
import type { LookupColumn, LookupFetchParams } from './table-lookup/TableLookupField.vue'

export interface EmployeePickerItem {
  id: string
  label: string
  sublabel?: string
  code?: string
  status?: string
}

const props = withDefaults(defineProps<{
  modelValue?: string
  employees: EmployeePickerItem[]
  label?: string
  required?: boolean
  invalid?: boolean
  disabled?: boolean
  placeholder?: string
  modalTitle?: string
  // Lignes grisees (non choisissables) avec leur motif ; par defaut : compte desactive.
  disabledReasonOf?: (employeeId: string) => string
}>(), {
  placeholder: 'Matricule',
  modalTitle: 'Sélectionner un employé',
})

const emit = defineEmits<{ 'update:modelValue': [id: string] }>()

const lookupColumns: LookupColumn[] = [
  { key: 'code', label: 'Matricule', width: '90px' },
  { key: 'label', label: 'Nom' },
  { key: 'sublabel', label: 'Entité' },
]

// Le matricule sert de cle d'affichage ; l'id reste la valeur emise.
const rows = computed(() => props.employees.map(e => ({ ...e, code: e.code || e.id })))
const selected = computed(() => rows.value.find(e => e.id === props.modelValue))
const selectedCode = computed(() => selected.value?.code ?? '')
const selectedName = computed(() => selected.value?.label ?? '')

// Les lignes du sélecteur arrivent sous forme d'objets génériques : on lit id et status à la main.
const isDisabled = (item: Record<string, unknown>) => !!disabledReason(item)
function disabledReason(item: Record<string, unknown>): string {
  const custom = props.disabledReasonOf?.(String(item.id))
  if (custom) return custom
  const status = item.status as string | undefined
  return status && status !== 'active' ? 'compte désactivé' : ''
}

function fetchEmployees(params: LookupFetchParams) {
  const q = (params.searchQuery ?? '').toLowerCase()
  const found = q
    ? rows.value.filter(e => e.label.toLowerCase().includes(q) || (e.sublabel ?? '').toLowerCase().includes(q) || e.code.toLowerCase().includes(q))
    : rows.value
  const start = (params.page - 1) * params.pageSize
  return { items: found.slice(start, start + params.pageSize), total: found.length }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function onSelect(item: any) { emit('update:modelValue', String(item.id)) }
// Le champ "Effacer" du composant de base vide le code : on vide aussi la valeur.
function onCode(code: string) { if (!code) emit('update:modelValue', '') }
</script>
