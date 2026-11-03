<template>
  <div>
    <div v-if="loading" class="text-[13px] text-muted-foreground p-4">Chargement...</div>
    <div v-else-if="error" class="text-[13px] text-danger p-4">{{ error }}</div>
    <template v-else-if="sheet">
      <div class="grid grid-cols-4 gap-2.5 mb-3.5 max-sm:grid-cols-2">
        <div v-for="k in kpis" :key="k.label" :class="L.card">
          <div class="text-[11px] text-muted-foreground">{{ k.label }}</div>
          <div class="text-lg font-semibold" :class="k.tone">{{ formatHours(k.value) }}</div>
        </div>
      </div>
      <div :class="L.tableCard">
        <table :class="L.table">
          <thead>
            <tr>
              <th :class="L.th">Date</th><th :class="L.th">Entrée</th><th :class="L.th">Sortie</th>
              <th :class="L.th">Prévu</th><th :class="L.th">Travaillé</th><th :class="L.th">Heures supp.</th><th :class="L.th">Absence</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in sheet.days" :key="d.date" :class="L.rowHover">
              <td :class="L.td" class="whitespace-nowrap">{{ formatDate(d.date) }}</td>
              <td :class="L.td">{{ clock(d.in) }}</td>
              <td :class="L.td">{{ clock(d.out) }}</td>
              <td :class="L.td">{{ d.required || '-' }}</td>
              <td :class="L.td">{{ d.worked || '-' }}</td>
              <td :class="[L.td, d.overtime > 0 ? 'text-success font-medium' : '']">{{ d.overtime || '-' }}</td>
              <td :class="[L.td, d.absence > 0 ? 'text-danger font-medium' : '']">{{ d.absence || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
/** Feuille de temps d'un employe sur une periode : synthese et detail jour par jour. */
import { ref, computed, watch } from 'vue'
import * as L from '../../lib/listClasses'
import { formatDate } from '../../lib/date'
import { getApiErrorMessage } from '../../lib/api'
import { useTimeStore, type Timesheet } from '../../stores/time'
import { clock, formatHours } from './timeFormat'

const props = defineProps<{ employeeId?: string; from: string; to: string }>()
const emit = defineEmits<{ loaded: [sheet: Timesheet] }>()

const store = useTimeStore()
const sheet = ref<Timesheet | null>(null)
const loading = ref(false)
const error = ref('')

const kpis = computed(() => {
  const s = sheet.value?.summary
  return s
    ? [
        { label: 'Prévu', value: s.required, tone: '' },
        { label: 'Travaillé', value: s.worked, tone: '' },
        { label: 'Heures supplémentaires', value: s.overtime, tone: 'text-success' },
        { label: 'Absences', value: s.absence, tone: s.absence > 0 ? 'text-danger' : '' },
      ]
    : []
})

let seq = 0
watch(() => [props.employeeId, props.from, props.to], async () => {
  if (!props.from || !props.to || props.from > props.to) { sheet.value = null; return }
  const mine = ++seq
  loading.value = true
  error.value = ''
  try {
    const result = await store.fetchTimesheet(props.from, props.to, props.employeeId)
    if (mine !== seq) return
    sheet.value = result
    emit('loaded', result)
  } catch (e) {
    if (mine === seq) { sheet.value = null; error.value = getApiErrorMessage(e, 'Feuille de temps indisponible') }
  } finally {
    if (mine === seq) loading.value = false
  }
}, { immediate: true })
</script>
