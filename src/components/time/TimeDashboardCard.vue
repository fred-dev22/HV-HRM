<template>
  <!-- Pointage en bref pour le tableau de bord RH. Chiffres exacts calcules en base
       (GET /dashboard/summary, bloc "time"). -->
  <div v-if="time" class="bg-card border border-border rounded-lg p-3.5 mb-3.5">
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <Clock3 class="w-4 h-4 text-primary" /> Temps de travail
      </div>
      <router-link :to="{ name: 'hr-time' }" class="text-xs text-info no-underline cursor-pointer">Ouvrir le module</router-link>
    </div>

    <div class="grid grid-cols-4 gap-2.5 max-md:grid-cols-2">
      <router-link :to="{ name: 'hr-time', query: { tab: 'validation' } }" :class="tile" class="no-underline text-foreground hover:border-primary/30">
        <div :class="label">Saisies à valider</div>
        <div :class="value">{{ time.pendingEntries }}</div>
        <div :class="sub">en attente de décision</div>
      </router-link>
      <div :class="tile">
        <div :class="label">Pointés aujourd'hui</div>
        <div :class="value">{{ time.clockedToday }}</div>
        <div :class="sub">employés à la pointeuse</div>
      </div>
      <div :class="tile">
        <div :class="label">Heures du mois</div>
        <div :class="value">{{ hours(time.workedHoursMonth) }}</div>
        <div :class="sub">sur {{ hours(time.requiredHoursMonth) }} prévues</div>
      </div>
      <div :class="tile">
        <div :class="label">Heures supp. du mois</div>
        <div :class="value">{{ hours(time.overtimeHoursMonth) }}</div>
        <div :class="sub">calculées à ce jour</div>
      </div>
    </div>

    <div class="flex items-center gap-3 flex-wrap mt-3 text-xs text-muted-foreground">
      <span v-if="time.lastImportAt">Dernier import de la pointeuse : {{ formatDate(time.lastImportAt) }} ({{ importStatus }})</span>
      <span v-else>Aucun import de la pointeuse pour le moment.</span>
      <router-link
        v-if="time.unmatchedPeople > 0"
        :to="{ name: 'hr-time', query: { tab: 'config' } }"
        class="inline-flex items-center gap-1 bg-warning-bg text-warning font-semibold px-2.5 py-[3px] rounded-full no-underline"
      >
        <AlertTriangle class="w-3 h-3" /> {{ time.unmatchedPeople }} personne{{ time.unmatchedPeople > 1 ? 's' : '' }} de la pointeuse sans employé
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Clock3, AlertTriangle } from 'lucide-vue-next'
import { useDashboardStore } from '../../stores/dashboard'
import { formatDate } from '../../lib/date'

const dashboard = useDashboardStore()
const time = computed(() => dashboard.summary?.time ?? null)

const tile = 'bg-background border border-border rounded-lg px-3.5 py-3 block'
const label = 'text-[13px] text-muted-foreground mb-1'
const value = 'text-[24px] font-semibold leading-none'
const sub = 'text-xs text-muted-foreground mt-[3px]'

const hours = (n: number) => `${n.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} h`
const IMPORT_STATUS: Record<string, string> = { Completed: 'terminé', Failed: 'en échec', Processing: 'en cours', Pending: 'en attente' }
const importStatus = computed(() => IMPORT_STATUS[time.value?.lastImportStatus ?? ''] ?? time.value?.lastImportStatus ?? '')
</script>
