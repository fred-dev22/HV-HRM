<template>
  <div class="px-7 py-6 flex flex-col gap-4 max-w-[1200px] mx-auto w-full">

    <!-- En-tête -->
    <div>
      <h1 class="text-xl font-bold text-foreground">Temps de travail</h1>
      <p class="text-[13px] text-muted-foreground mt-0.5">Saisies de temps et validation, feuilles de temps, export vers la paie et configuration du pointage.</p>
    </div>

    <!-- Onglets -->
    <div class="flex gap-1 border-b-[1.5px] border-border overflow-x-auto">
      <button
        v-for="tb in visibleTabs" :key="tb.key"
        class="flex items-center gap-1.5 px-[18px] py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors whitespace-nowrap cursor-pointer bg-transparent"
        :class="activeTab === tb.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'"
        @click="selectTab(tb.key)"
      >
        <component :is="tb.icon" class="w-4 h-4" />
        {{ tb.label }}
      </button>
    </div>

    <TimeEntriesView v-if="activeTab === 'entries'" embedded />
    <TimeValidationView v-else-if="activeTab === 'validation'" embedded />
    <TimeSheetsView v-else-if="activeTab === 'timesheets'" embedded />
    <TimePayrollExportView v-else-if="activeTab === 'payroll'" embedded />
    <TimeConfigView v-else-if="activeTab === 'config'" embedded />
  </div>
</template>

<script setup lang="ts">
/**
 * Temps de travail : une seule entree de menu, des onglets (comme Calendrier ou
 * Classification) reprenant les ecrans du systeme de pointage. Chaque onglet
 * n'apparait que si l'utilisateur en a le droit. L'onglet courant est dans
 * l'adresse (?tab=...) : un rechargement ou un ancien lien retombe au bon endroit.
 */
import { computed, watch, type Component } from 'vue'
import { ClipboardList, ClipboardCheck, CalendarDays, FileSpreadsheet, Settings } from 'lucide-vue-next'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import TimeEntriesView from './TimeEntriesView.vue'
import TimeValidationView from './TimeValidationView.vue'
import TimeSheetsView from './TimeSheetsView.vue'
import TimePayrollExportView from './TimePayrollExportView.vue'
import TimeConfigView from './TimeConfigView.vue'

type TabKey = 'entries' | 'validation' | 'timesheets' | 'payroll' | 'config'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const TABS: { key: TabKey; label: string; icon: Component; permissions: string[] }[] = [
  { key: 'entries', icon: ClipboardList,    label: 'Saisies manuelles',  permissions: ['TEMPS_SAISIR', 'TEMPS_ACCES'] },
  { key: 'validation', icon: ClipboardCheck, label: 'Validation',         permissions: ['TEMPS_VALIDER', 'TEMPS_ACCES'] },
  { key: 'timesheets', icon: CalendarDays, label: 'Feuilles de temps',  permissions: ['TEMPS_SAISIR', 'TEMPS_VALIDER', 'TEMPS_ACCES'] },
  { key: 'payroll', icon: FileSpreadsheet,    label: 'Export paie',        permissions: ['TEMPS_ACCES'] },
  { key: 'config', icon: Settings,     label: 'Configuration',      permissions: ['TEMPS_ACCES'] },
]

// Anciens liens (?tab=mine / ?tab=admin) vers leur nouvel onglet.
const LEGACY: Record<string, TabKey> = { mine: 'entries', admin: 'config', team: 'timesheets' }

const visibleTabs = computed(() => TABS.filter(tb => auth.hasAnyPermission(tb.permissions)))

const activeTab = computed<TabKey | null>(() => {
  const asked = typeof route.query.tab === 'string' ? route.query.tab : ''
  const wanted = LEGACY[asked] ?? asked
  const match = visibleTabs.value.find(tb => tb.key === wanted)
  return (match ?? visibleTabs.value[0])?.key ?? null
})

function selectTab(key: TabKey) {
  if (key !== activeTab.value) router.replace({ query: { ...route.query, tab: key } })
}

// Onglet demande dans l'adresse mais inconnu ou non autorise : on corrige l'adresse.
watch([activeTab, () => route.query.tab], () => {
  if (activeTab.value && route.query.tab !== activeTab.value) router.replace({ query: { ...route.query, tab: activeTab.value } })
}, { immediate: true })
</script>
