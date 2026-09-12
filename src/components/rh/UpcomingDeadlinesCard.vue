<template>
  <div :class="card">
    <div :class="cardHeader">
      <div :class="cardTitle">
        <CalendarClock class="w-4 h-4 text-primary" />
        Échéances à venir
        <span v-if="store.items.length" class="bg-primary text-primary-foreground text-[11px] font-semibold px-[7px] py-px rounded-full">
          {{ store.items.length }}
        </span>
      </div>
      <RouterLink :to="{ name: 'hr-deadlines' }" class="text-xs text-info no-underline cursor-pointer">Tout voir</RouterLink>
    </div>

    <div v-if="store.loading" class="py-6 text-center text-[13px] text-muted-foreground">Chargement...</div>
    <div v-else-if="store.items.length === 0" class="py-6 text-center text-[13px] text-muted-foreground">
      Aucune échéance dans les 30 prochains jours.
    </div>
    <ul v-else class="flex flex-col">
      <li
        v-for="d in top" :key="d.category + d.entityId + d.date"
        class="flex items-center gap-2.5 py-2 border-b border-border last:border-b-0"
      >
        <span class="w-8 h-8 rounded-full flex items-center justify-center shrink-0" :class="iconWrap(d.category)">
          <component :is="iconFor(d.category)" class="w-4 h-4" />
        </span>
        <div class="flex-1 min-w-0">
          <div class="text-[13px] font-medium text-foreground truncate">{{ d.subjectName }}</div>
          <div class="text-xs text-muted-foreground truncate">
            {{ CATEGORY_LABELS[d.category] }}<template v-if="d.entityName"> · {{ d.entityName }}</template>
          </div>
        </div>
        <span class="text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap shrink-0" :class="whenClass(d.daysUntil)">
          {{ whenText(d.daysUntil) }}
        </span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
/**
 * Widget tableau de bord RH : les 5 prochaines echeances datees (fins de CDD /
 * stage / periode d'essai / contrat, anniversaires) sur 30 jours. Monte
 * seulement pour les comptes EMPLOYE_VOIR_TOUT (voir DashboardHR.vue). Le lien
 * "Tout voir" ouvre HrDeadlinesView.vue.
 */
import { computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { CalendarClock, CalendarX, GraduationCap, Cake, UserCheck, FileClock } from 'lucide-vue-next'
import { useRemindersStore, CATEGORY_LABELS } from '../../stores/reminders'
import type { DeadlineCategory } from '../../stores/reminders'

const store = useRemindersStore()
onMounted(() => { if (store.items.length === 0) store.fetchUpcoming() })

const top = computed(() => store.items.slice(0, 5))

const card = 'bg-card border border-border rounded-lg p-3.5'
const cardHeader = 'flex items-center justify-between mb-3'
const cardTitle = 'flex items-center gap-1.5 text-sm font-semibold text-foreground'

const ICONS: Record<DeadlineCategory, unknown> = {
  cdd_end: CalendarX,
  internship_end: GraduationCap,
  birthday: Cake,
  trial_end: UserCheck,
  contract_end: FileClock,
}
function iconFor(c: DeadlineCategory) { return ICONS[c] }
function iconWrap(c: DeadlineCategory): string {
  return c === 'birthday' ? 'bg-success-bg text-success' : 'bg-primary/10 text-primary'
}

function whenText(days: number): string {
  if (days <= 0) return "aujourd'hui"
  if (days === 1) return 'dans 1 jour'
  return `dans ${days} jours`
}
function whenClass(days: number): string {
  if (days <= 1) return 'bg-danger-bg text-danger'
  if (days <= 7) return 'bg-warning-bg text-warning'
  return 'bg-neutral-bg text-neutral'
}
</script>
