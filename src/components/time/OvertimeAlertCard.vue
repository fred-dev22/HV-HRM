<template>
  <!-- Alerte heures supplementaires : employes ayant atteint le seuil du mois (GET /time/overtime-alerts). -->
  <div v-if="visible && data" class="bg-card border border-border rounded-lg p-3.5">
    <div class="flex items-center justify-between gap-3 mb-1">
      <div class="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <AlertTriangle class="w-4 h-4" :class="data.employees.length ? 'text-warning' : 'text-primary'" />
        Alerte heures supplémentaires
        <span v-if="data.employees.length" class="bg-warning-bg text-warning text-[11px] font-semibold px-2 py-[1px] rounded-full">{{ data.employees.length }}</span>
      </div>
      <router-link :to="{ name: timeRoute, query: { tab: 'weeks' } }" class="text-xs text-info no-underline hover:underline whitespace-nowrap">Validation hebdo</router-link>
    </div>
    <p class="text-xs text-muted-foreground mb-2.5">
      <span class="capitalize">{{ monthLabel }}</span> : seuil d'alerte {{ hours(data.alertHours) }}, seuil légal {{ hours(data.legalHours) }}.
      <template v-if="data.lastCalculatedDate">Dernières heures prises en compte : {{ formatDate(data.lastCalculatedDate) }}.</template>
    </p>

    <p v-if="!data.lastCalculatedDate" class="text-[13px] text-muted-foreground">Aucune heure enregistrée pour ce mois.</p>
    <p v-else-if="!data.employees.length" class="text-[13px] text-muted-foreground">
      Personne n'a atteint le seuil ce mois-ci{{ isHr ? '' : ' dans votre équipe' }}.
    </p>
    <div v-else class="max-h-[260px] overflow-auto">
      <div v-for="e in data.employees" :key="e.employeeId" class="flex items-center gap-3 py-2 border-b border-border last:border-b-0">
        <div class="min-w-0 w-[200px] max-sm:w-[130px]">
          <div class="text-[13px] font-medium truncate">{{ e.name }}</div>
          <div class="text-[11px] text-muted-foreground">{{ e.code }}</div>
        </div>
        <div class="flex-1 h-1.5 bg-background rounded-full overflow-hidden">
          <div class="h-full rounded-full" :class="e.legalCapReached ? 'bg-danger' : 'bg-warning'" :style="{ width: `${Math.min(100, (e.hours / data.legalHours) * 100)}%` }"></div>
        </div>
        <div class="text-[13px] font-semibold whitespace-nowrap w-[64px] text-right">{{ hours(e.hours) }}</div>
        <span class="text-[11px] font-medium px-2 py-[2px] rounded-full whitespace-nowrap w-[124px] text-center" :class="e.legalCapReached ? 'bg-danger-bg text-danger' : 'bg-warning-bg text-warning'">
          {{ e.legalCapReached ? 'Seuil légal atteint' : `Reste ${hours(data.legalHours - e.hours)}` }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Carte des tableaux de bord : le manager y voit les employes qu'il suit (le RH,
 * tout le monde) qui ont atteint le seuil d'heures supplementaires du mois, pour
 * reorganiser les horaires. Une alerte leur est aussi envoyee au controle d'une
 * semaine.
 */
import { computed, ref } from 'vue'
import { AlertTriangle } from 'lucide-vue-next'
import { TIME_MODULE_ENABLED } from '../../config/features'
import { formatDate } from '../../lib/date'
import { useAuthStore } from '../../stores/auth'
import { useTimeStore, type OvertimeAlerts } from '../../stores/time'

defineProps<{ timeRoute: 'hr-time' | 'employee-time' }>()

const auth = useAuthStore()
const store = useTimeStore()

const isHr = computed(() => auth.hasPermission('TEMPS_ACCES'))
const visible = computed(() => TIME_MODULE_ENABLED && (isHr.value || auth.hasPermission('TEMPS_VALIDER')))

// Derniere lecture affichee tout de suite, puis toujours relue en arriere-plan.
const key = `overtime-alerts:${auth.user?.id ?? ''}`
const data = ref<OvertimeAlerts | null>(store.getCached<OvertimeAlerts>(key) ?? null)
if (visible.value) {
  store.fetchOvertimeAlerts()
    .then((result) => { data.value = result; store.setCached(key, result) })
    // Un tableau de bord ne doit pas echouer pour une carte : elle reste absente.
    .catch(() => {})
}

const monthLabel = computed(() => (data.value
  ? new Date(`${data.value.month}-01T00:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  : ''))
const hours = (n: number) => `${n.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} h`
</script>
