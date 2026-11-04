<template>
  <!-- canCreateForOthers : permission CONGE/MISSION/FRAIS_CREER_POUR_AUTRE. Sans elle,
       aucune bascule ni selecteur : la demande est toujours pour soi-meme (le serveur
       refuse aussi toute demande pour un autre employe). -->
  <div v-if="canCreateForOthers" class="flex flex-col gap-2.5">
    <!-- hideSelfOption : compte systeme (Employee.IsSystem, ex. "Admin
         HV") — pas un vrai membre du personnel, "Pour moi-même" n'a
         aucun sens (aucun solde/existence RH reelle a lui). On saute
         directement au picker ci-dessous, pas de bascule a afficher pour un
         choix qui n'en est plus un. -->
    <div v-if="!hideSelfOption" class="flex gap-1.5">
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

    <!-- Sélection d'un employé : EmployeePicker, le même choix partout dans l'app -->
    <div v-if="modelValue.mode === 'for-employee'" class="flex flex-col gap-1">
      <EmployeePicker
        label="Employé concerné"
        required
        placeholder="Code employé"
        :model-value="modelValue.employeeId"
        :employees="availableEmployees"
        :invalid="!!errorEmployee"
        @update:model-value="onPick"
      />
      <div v-if="errorEmployee" class="text-[11px] text-danger">{{ errorEmployee }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { User, Users } from 'lucide-vue-next'
import EmployeePicker from './EmployeePicker.vue'

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

const props = withDefaults(defineProps<{
  modelValue: BeneficiaryValue
  availableEmployees: EmployeeItem[]
  errorEmployee?: string
  // Voir commentaire dans le template — masque la bascule "Pour moi-même" /
  // "Pour un employé" pour ne garder que le picker. L'appelant reste
  // responsable d'initialiser modelValue.mode à 'for-employee' dans ce cas
  // (ce composant ne le force pas lui-même).
  hideSelfOption?: boolean
  // Permission de creer pour un autre employe (defaut : oui, pour ne rien casser
  // chez un appelant qui ne la fournit pas encore).
  canCreateForOthers?: boolean
}>(), {
  canCreateForOthers: true,
})

const emit = defineEmits<{
  'update:modelValue': [value: BeneficiaryValue]
}>()

const modeBtn = 'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium cursor-pointer border border-border bg-background text-muted-foreground transition-colors hover:bg-card hover:text-foreground'
const modeActive = '!bg-tint !text-primary !border-primary'

function setMode(mode: 'self' | 'for-employee') {
  emit('update:modelValue', { mode, employeeId: '' })
}

function onPick(employeeId: string) {
  emit('update:modelValue', { mode: 'for-employee', employeeId })
}
</script>
