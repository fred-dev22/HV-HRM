<template>
  <div :class="embedded ? '' : 'px-7 py-6 max-w-[1100px] mx-auto w-full'">
    <div v-if="!embedded" :class="L.pageHeader">
      <div>
        <div :class="L.pageTitle">Feuilles de temps</div>
        <div :class="L.pageSub">Consultation et export des feuilles de temps.</div>
      </div>
    </div>
    <div v-else :class="L.pageSub" class="mb-4">Consultation des feuilles de temps : celle d'un employé jour par jour, et la synthèse de tous les employés (RH) ou de votre équipe (validateur).</div>

    <div v-if="subTabs.length > 1" class="flex gap-1.5 flex-wrap mb-4">
      <button
        v-for="t in subTabs" :key="t.key"
        class="px-3 py-1.5 text-[12.5px] font-medium rounded-md border transition-colors"
        :class="sub === t.key ? 'bg-tint text-primary border-primary' : 'bg-background text-muted-foreground border-border hover:text-foreground'"
        @click="sub = t.key"
      >{{ t.label }}</button>
    </div>

    <!-- Feuille individuelle -->
    <template v-if="sub === 'individual'">
      <div :class="L.card" class="mb-3.5">
        <div :class="L.cardHeader"><div :class="L.cardTitle"><Search class="w-4 h-4" /> Rechercher une feuille de temps</div></div>
        <div class="flex items-end gap-3 flex-wrap">
          <div v-if="isHr" :class="cls.field" class="min-w-[260px] flex-1">
            <label :class="cls.fieldLabel">Employé</label>
            <EmployeePicker v-model="employeeId" :employees="employeeItems" />
          </div>
          <div :class="cls.field"><label :class="cls.fieldLabel">Du</label><input v-model="from" type="date" :class="cls.fieldInput" /></div>
          <div :class="cls.field"><label :class="cls.fieldLabel">Au</label><input v-model="to" type="date" :class="cls.fieldInput" /></div>
        </div>
      </div>
      <div v-if="isHr && !employeeId" :class="L.emptyState"><CalendarSearch class="w-8 h-8" /><p class="text-[13px]">Sélectionnez un employé et une période pour afficher la feuille de temps.</p></div>
      <TimesheetDetail v-else :employee-id="isHr ? employeeId : undefined" :from="from" :to="to" />
    </template>

    <!-- Rapport global (RH) ou equipe d'un validateur -->
    <template v-else>
      <TimesheetSummaryTable :kind="sub === 'team' ? 'team' : 'global'" @open="openRow" @period="(f, t) => { period.from = f; period.to = t }" />
    </template>

    <TimesheetCard v-if="opened" :rows="openedRows" :employee-id="opened.employeeId" :from="period.from" :to="period.to" @close="opened = null" />
  </div>
</template>

<script setup lang="ts">
/**
 * Feuilles de temps : feuille individuelle (jour par jour) et rapport global de
 * tous les employes (RH).
 */
import { ref, computed, reactive, onMounted } from 'vue'
import { Search, CalendarSearch } from 'lucide-vue-next'
import * as cls from '../../lib/formClasses'
import * as L from '../../lib/listClasses'
import { todayIso } from '../../lib/date'
import { useAuthStore } from '../../stores/auth'
import { useEmployeeStore } from '../../stores/employees'
import type { TimesheetRow } from '../../stores/time'
import EmployeePicker from '../../components/ui/EmployeePicker.vue'
import TimesheetCard from '../../components/time/TimesheetCard.vue'
import TimesheetDetail from '../../components/time/TimesheetDetail.vue'
import TimesheetSummaryTable from '../../components/time/TimesheetSummaryTable.vue'

defineProps<{ embedded?: boolean }>()

const auth = useAuthStore()
const employeeStore = useEmployeeStore()
const isHr = computed(() => auth.hasPermission('TEMPS_ACCES'))

// Le RH voit le rapport global de tous les employes ; un validateur sans droit RH
// voit la synthese de son equipe (ses employes et ceux de son entite).
type SubKey = 'individual' | 'global' | 'team'
const subTabs = computed(() => {
  const tabs: { key: SubKey; label: string }[] = [{ key: 'individual', label: 'Feuille individuelle' }]
  if (isHr.value) tabs.push({ key: 'global', label: 'Rapport global' })
  else if (auth.hasPermission('TEMPS_VALIDER')) tabs.push({ key: 'team', label: 'Mon équipe' })
  return tabs
})
const sub = ref<SubKey>('individual')

const today = todayIso()
const from = ref(`${today.slice(0, 8)}01`)
const to = ref(today)
const employeeId = ref('')
const opened = ref<TimesheetRow | null>(null)
const period = reactive({ from: from.value, to: to.value })

// Annuaire charge seulement pour le RH, a l'ouverture de l'onglet.
const employeeItems = computed(() =>
  employeeStore.directory.filter(e => e.status !== 'inactive').map(e => ({ id: e.id, label: e.name, sublabel: e.entityName, code: e.code })),
)
onMounted(() => { if (isHr.value && employeeStore.directory.length === 0) employeeStore.fetchDirectory().catch(() => {}) })

const openedRows = ref<TimesheetRow[]>([])
const openRow = (row: TimesheetRow, rows: TimesheetRow[]) => { openedRows.value = rows; opened.value = row }
</script>
