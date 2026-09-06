<template>
  <div class="flex flex-col gap-2.5">
    <div class="flex gap-1.5">
      <button
        :class="[modeBtn, modelValue.mode === 'self' && modeActive]"
        @click="setMode('self')"
      >
        <User class="w-3.5 h-3.5" /> Pour moi-même
      </button>
      <button
        :class="[modeBtn, modelValue.mode === 'for-employee' && modeActive]"
        @click="setMode('for-employee')"
      >
        <Users class="w-3.5 h-3.5" /> Pour un employé
      </button>
    </div>

    <!-- Sélection d'un employé = sélection d'une ENTITÉ → TableLookupField -->
    <div v-if="modelValue.mode === 'for-employee'" class="flex flex-col gap-1">
      <TableLookupField
        label="Employé concerné"
        required
        :code="selectedCode"
        :name="selectedName"
        :columns="lookupColumns"
        :fetch-fn="fetchEmployees"
        value-key="id"
        name-key="label"
        modal-title="Sélectionner un employé"
        placeholder="Code employé"
        :invalid="!!errorEmployee"
        :is-item-disabled="(item) => item.status && item.status !== 'active'"
        :item-disabled-reason="() => 'compte désactivé'"
        @select="onSelect"
      />
      <div v-if="errorEmployee" class="text-[11px] text-danger">{{ errorEmployee }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { User, Users } from 'lucide-vue-next'
import TableLookupField from './table-lookup/TableLookupField.vue'
import type { LookupColumn, LookupFetchParams } from './table-lookup/TableLookupField.vue'

export interface BeneficiaryValue {
  mode: 'self' | 'for-employee'
  employeeId: string
}

interface EmployeeItem {
  id: string
  label: string
  sublabel?: string
  code?: string
  initials?: string
  avatarColor?: string
  status?: string
}

const props = defineProps<{
  modelValue: BeneficiaryValue
  availableEmployees: EmployeeItem[]
  errorEmployee?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: BeneficiaryValue]
}>()

const modeBtn = 'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium cursor-pointer border border-border bg-background text-muted-foreground transition-colors hover:bg-card hover:text-foreground'
const modeActive = '!bg-primary/10 !text-primary !border-primary'

function setMode(mode: 'self' | 'for-employee') {
  emit('update:modelValue', { mode, employeeId: '' })
}

/* ── Lookup employé ─────────────────────────────────────────── */
const lookupColumns: LookupColumn[] = [
  { key: 'code', label: 'Code', width: '90px' },
  { key: 'label', label: 'Nom' },
  { key: 'sublabel', label: 'Entité' },
]

const selectedEmp = computed(() => props.availableEmployees.find(e => e.id === props.modelValue.employeeId))
const selectedCode = computed(() => selectedEmp.value?.code ?? selectedEmp.value?.id ?? '')
const selectedName = computed(() => selectedEmp.value?.label ?? '')

// fetchFn local sur la liste fournie (les employés sont des entités du store)
function fetchEmployees(params: LookupFetchParams) {
  const q = (params.searchQuery ?? '').toLowerCase()
  let rows = props.availableEmployees
  if (q) {
    rows = rows.filter(e =>
      e.label.toLowerCase().includes(q) ||
      (e.sublabel ?? '').toLowerCase().includes(q) ||
      (e.code ?? e.id).toLowerCase().includes(q),
    )
  }
  const total = rows.length
  const start = (params.page - 1) * params.pageSize
  return { items: rows.slice(start, start + params.pageSize), total }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function onSelect(item: any) {
  emit('update:modelValue', { mode: 'for-employee', employeeId: String(item.id) })
}
</script>
