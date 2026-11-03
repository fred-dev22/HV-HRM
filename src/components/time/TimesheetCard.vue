<template>
  <CardModalShell
    v-if="current"
    :page-title="`${current.name} · Feuille de temps`"
    :page-number="current.employeeNumber"
    banner-label="Fiche feuille de temps"
    :is-edit-mode="false"
    :show-edit="false"
    :show-title-new-button="false"
    :sidebar-items="sidebarItems"
    :current-no="current.employeeNumber"
    :has-prev="currentIndex > 0"
    :has-next="currentIndex >= 0 && currentIndex < rows.length - 1"
    @close="emit('close')"
    @go-prev="go(currentIndex - 1)"
    @go-next="go(currentIndex + 1)"
    @select-sidebar="selectSidebar"
  >
    <template #form>
      <div class="px-6 py-5 max-w-4xl">
        <FormSection title="Période">
          <p class="text-[13px] text-foreground">Du {{ formatDate(from) }} au {{ formatDate(to) }}</p>
        </FormSection>
        <FormSection title="Détail jour par jour">
          <TimesheetDetail :employee-id="current.employeeId" :from="from" :to="to" />
        </FormSection>
      </div>
    </template>
  </CardModalShell>
</template>

<script setup lang="ts">
/**
 * Fiche feuille de temps d'un employe, sur CardModalShell comme les autres fiches
 * du HRM : navigation entre les employes de la liste a gauche, lecture seule.
 */
import { ref, computed, watch } from 'vue'
import CardModalShell from '../shared/CardModalShell.vue'
import FormSection from '../ui/form-field/FormSection.vue'
import TimesheetDetail from './TimesheetDetail.vue'
import { formatDate } from '../../lib/date'
import type { TimesheetRow } from '../../stores/time'

const props = defineProps<{ rows: TimesheetRow[]; employeeId: string; from: string; to: string }>()
const emit = defineEmits<{ close: [] }>()

const currentId = ref(props.employeeId)
watch(() => props.employeeId, (v) => { currentId.value = v })

const current = computed(() => props.rows.find(r => r.employeeId === currentId.value) ?? null)
const currentIndex = computed(() => props.rows.findIndex(r => r.employeeId === currentId.value))
const sidebarItems = computed(() => props.rows.map(r => ({ no: r.employeeNumber, label: r.name })))

function go(i: number) {
  const r = props.rows[i]
  if (r) currentId.value = r.employeeId
}
function selectSidebar(no: string) {
  const r = props.rows.find(x => x.employeeNumber === no)
  if (r) currentId.value = r.employeeId
}
</script>
