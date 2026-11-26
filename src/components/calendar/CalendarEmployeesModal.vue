<template>
  <CreateModalShell
    title="Appliquer ces horaires à des employés"
    banner-label="Calendrier par employé"
    :create-label="selected.length ? `Appliquer à ${selected.length} employé(s)` : 'Appliquer'"
    saving-label="Enregistrement…"
    :create-disabled="!selected.length"
    create-disabled-reason="Cochez au moins un employé"
    :save-error="error"
    :is-saving="saving"
    @close="close"
    @create="submit"
  >
    <template #form>
      <div class="flex-1 overflow-auto px-6 py-5">
        <div class="max-w-3xl mx-auto">
          <FormSection title="Horaires appliqués">
            <dl class="text-[13px] grid grid-cols-[170px_1fr] gap-y-1">
              <template v-for="line in summary" :key="line.days">
                <dt class="text-muted-foreground">{{ line.days }}</dt>
                <dd class="text-foreground">{{ line.hours }}</dd>
              </template>
            </dl>
            <p class="text-[12px] text-muted-foreground mt-2">Chaque employé coché reçoit ces horaires en propre : ils passent avant ceux de sa catégorie et le calendrier global, pour le module Temps de travail.</p>
          </FormSection>

          <FormSection title="Employés">
            <div class="flex items-end gap-3 flex-wrap mb-2">
              <div :class="cls.field" class="flex-1 min-w-[220px]">
                <label :class="cls.fieldLabel">Rechercher</label>
                <input v-model="search" type="search" :class="cls.fieldInput" placeholder="Nom, matricule ou entité" />
              </div>
              <span class="text-[12px] text-muted-foreground pb-2">{{ selected.length }} coché(s)</span>
            </div>
            <label class="flex items-center gap-2 text-[13px] cursor-pointer mb-1.5">
              <input type="checkbox" class="accent-primary" :checked="allShownSelected" :disabled="!shown.length" @change="toggleShown" />
              Tout cocher ({{ shown.length }} affiché(s))
            </label>
            <div class="border border-border rounded-md max-h-[300px] overflow-auto">
              <label v-for="e in shown" :key="e.id" class="flex items-center gap-2.5 px-2.5 py-1.5 border-b border-border last:border-b-0 text-[13px] cursor-pointer hover:bg-background">
                <input v-model="selected" type="checkbox" :value="e.id" class="accent-primary" />
                <span class="flex-1 min-w-0 truncate">{{ e.name }} <span class="text-muted-foreground text-[11px]">{{ e.code }}</span></span>
                <span v-if="owners.has(e.id.toLowerCase())" class="text-[11px] text-warning whitespace-nowrap">a déjà un horaire propre</span>
                <span class="text-muted-foreground text-[11px] truncate max-w-[180px]">{{ e.entityName }}</span>
              </label>
              <p v-if="!shown.length" class="px-2.5 py-3 text-[12px] text-muted-foreground">Aucun employé pour ces critères.</p>
            </div>
          </FormSection>
        </div>
      </div>
    </template>
  </CreateModalShell>
</template>

<script setup lang="ts">
/**
 * Memes horaires (la semaine affichee dans le calendrier) pour plusieurs
 * employes : le calendrier propre de chacun est cree ou remplace.
 */
import { computed, ref } from 'vue'
import CreateModalShell from '../shared/CreateModalShell.vue'
import FormSection from '../ui/form-field/FormSection.vue'
import * as cls from '../../lib/formClasses'
import { getApiErrorMessage } from '../../lib/api'
import { confirmDialog } from '../../lib/confirm'
import { weekSummary } from '../../lib/weekSummary'
import { useCalendarStore } from '../../stores/calendar'
import { useToastStore } from '../../stores/toast'
import type { WorkingDays } from '../../types'

export interface CalendarEmployee { id: string; name: string; code: string; entityName: string }

const props = defineProps<{
  employees: CalendarEmployee[]
  week: WorkingDays
  /** Employes qui ont deja un calendrier propre */
  ownerIds: string[]
}>()
const emit = defineEmits<{ close: []; applied: [employeeIds: string[]] }>()

const store = useCalendarStore()
const toast = useToastStore()

const selected = ref<string[]>([])
const search = ref('')
const saving = ref(false)
const error = ref('')
const summary = computed(() => weekSummary(props.week))
const owners = computed(() => new Set(props.ownerIds.map(id => id.toLowerCase())))

const shown = computed(() => {
  const q = search.value.trim().toLowerCase()
  return props.employees.filter(e => !q || `${e.name} ${e.code} ${e.entityName}`.toLowerCase().includes(q))
})
const allShownSelected = computed(() => shown.value.length > 0 && shown.value.every(e => selected.value.includes(e.id)))
function toggleShown() {
  const ids = shown.value.map(e => e.id)
  selected.value = allShownSelected.value
    ? selected.value.filter(id => !ids.includes(id))
    : [...new Set([...selected.value, ...ids])]
}

async function submit() {
  if (saving.value || !selected.value.length) return
  error.value = ''
  const replaced = selected.value.filter(id => owners.value.has(id.toLowerCase())).length
  if (replaced && !(await confirmDialog(`${replaced} employé(s) ont déjà un horaire propre : il sera remplacé. Continuer ?`))) return
  saving.value = true
  toast.loading('Enregistrement...')
  try {
    const ids = [...selected.value]
    await store.applyToEmployees(ids, props.week)
    toast.success(`Horaires appliqués à ${ids.length} employé(s)`)
    emit('applied', ids)
    emit('close')
  } catch (e) {
    error.value = getApiErrorMessage(e, 'Enregistrement impossible')
    toast.error(error.value)
  } finally {
    saving.value = false
  }
}

function close() { if (!saving.value) emit('close') }
</script>
