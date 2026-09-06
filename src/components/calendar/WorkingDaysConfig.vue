<template>
  <div>

    <!-- ── 7 toggles de jours avec horaires + pauses ── -->
    <div class="flex flex-col gap-0.5">
      <div
        v-for="key in DAY_ORDER" :key="key"
        class="flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors flex-nowrap min-h-[44px] max-md:flex-wrap"
        :class="{ 'bg-primary/10': days[key].enabled }"
      >
        <!-- Nom du jour -->
        <span class="text-[13px] font-medium text-foreground w-[90px] shrink-0">{{ DAY_LABELS[key] }}</span>

        <!-- Toggle actif/inactif -->
        <label class="relative inline-flex items-center cursor-pointer shrink-0">
          <input type="checkbox" class="sr-only peer" v-model="days[key].enabled" />
          <span :class="toggleTrack"></span>
        </label>

        <!-- Horaires + Pause (une seule ligne) -->
        <template v-if="days[key].enabled">
          <input type="time" :class="[timeInput, dayHoursError(key) && '!border-danger']" v-model="days[key].start" />
          <span :class="sep">→</span>
          <input type="time" :class="[timeInput, dayHoursError(key) && '!border-danger']" v-model="days[key].end" />
          <span v-if="dayHoursError(key)" class="text-[10px] text-danger flex items-center gap-[3px] whitespace-nowrap shrink-0">
            <CircleAlert class="w-3 h-3" />
            {{ dayHoursError(key) }}
          </span>
          <span v-else class="text-[11px] font-semibold text-primary bg-primary/10 rounded px-2 py-0.5 whitespace-nowrap shrink-0">{{ calcDayHours(days[key]) }} eff.</span>

          <!-- Séparateur visuel -->
          <span class="text-border text-base select-none shrink-0 max-md:hidden" aria-hidden="true">|</span>

          <!-- Toggle Pause -->
          <label class="flex items-center gap-1.5 cursor-pointer shrink-0">
            <span class="relative inline-flex items-center shrink-0">
              <input type="checkbox" class="sr-only peer" v-model="days[key].breakEnabled" />
              <span :class="toggleTrackSm"></span>
            </span>
            <span class="text-[11px] text-muted-foreground whitespace-nowrap">Pause</span>
          </label>

          <!-- Plage de pause -->
          <template v-if="days[key].breakEnabled">
            <input type="time" :class="[timeInputSm, dayBreakError(key) && '!border-danger']" v-model="days[key].breakStart" />
            <span :class="sep">→</span>
            <input type="time" :class="[timeInputSm, dayBreakError(key) && '!border-danger']" v-model="days[key].breakEnd" />
            <span v-if="dayBreakError(key)" class="text-[10px] text-danger flex items-center gap-[3px] whitespace-nowrap shrink-0">
              <CircleAlert class="w-3 h-3" />
              {{ dayBreakError(key) }}
            </span>
          </template>
          <span v-else class="text-[11px] text-muted-foreground italic whitespace-nowrap">Aucune pause</span>
        </template>
        <span v-else class="text-[11px] text-muted-foreground italic">Jour non travaillé</span>
      </div>
    </div>

    <!-- ── Récapitulatif hebdomadaire ── -->
    <div v-if="!hideSummary" class="flex items-center gap-2 mt-3.5 px-3.5 py-2.5 rounded-lg bg-background border border-border text-[13px] font-medium text-foreground">
      <Clock class="w-[15px] h-[15px] text-primary" />
      {{ calendarStore.daysPerWeek }} jour{{ calendarStore.daysPerWeek > 1 ? 's' : '' }}
      · {{ calendarStore.formatMinutes(calendarStore.weeklyMinutes) }} par semaine
    </div>

  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Clock, CircleAlert } from 'lucide-vue-next'
import { useCalendarStore } from '../../stores/calendar'
import type { WorkingDays, WorkingDayConfig } from '../../types'

// hideSummary: masque le récapitulatif interne quand l'appelant affiche déjà
// son propre résumé (ex: OnboardingWizard, qui ajoute son propre bandeau
// juste en dessous).
defineProps<{ hideSummary?: boolean }>()

// Lit et écrit directement dans calendarStore — aucune prop. Pas
// d'auto-enregistrement ici : les edits restent en memoire jusqu'a ce que
// l'appelant declenche explicitement calendarStore.updateWorkingDays()
// (bouton "Enregistrer" dans CalendarView, ou "Continuer" dans l'onboarding).
const calendarStore = useCalendarStore()
const days = computed(() => calendarStore.calendar.workingDays)

// ── Classes du design system ─────────────────────────────────
const toggleTrack = "w-9 h-5 rounded-full bg-foreground/20 transition-colors peer-checked:bg-primary relative after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:w-3.5 after:h-3.5 after:bg-white after:rounded-full after:shadow after:transition-all peer-checked:after:left-[19px]"
const toggleTrackSm = "w-7 h-4 rounded-full bg-foreground/20 transition-colors peer-checked:bg-primary relative after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:w-2.5 after:h-2.5 after:bg-white after:rounded-full after:transition-all peer-checked:after:left-[15px]"
const sep = 'text-muted-foreground text-sm shrink-0'
const timeInput = 'h-8 px-2 border border-border rounded-md text-[13px] text-foreground bg-card outline-none w-24 shrink-0 transition-colors focus:border-primary'
const timeInputSm = 'h-7 px-2 border border-border rounded-md text-xs text-foreground bg-card outline-none w-20 shrink-0 transition-colors focus:border-primary'

const DAY_ORDER: (keyof WorkingDays)[] = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
const DAY_LABELS: Record<keyof WorkingDays, string> = {
  monday:'Lundi', tuesday:'Mardi', wednesday:'Mercredi',
  thursday:'Jeudi', friday:'Vendredi', saturday:'Samedi', sunday:'Dimanche',
}

function calcDayHours(day: WorkingDayConfig): string {
  const workMin  = calendarStore.toMinutes(day.end) - calendarStore.toMinutes(day.start)
  const breakMin = day.breakEnabled
    ? calendarStore.toMinutes(day.breakEnd) - calendarStore.toMinutes(day.breakStart)
    : 0
  return calendarStore.formatMinutes(Math.max(0, workMin - breakMin))
}

function dayHoursError(key: keyof WorkingDays): string | null {
  const day = days.value[key]
  if (!day.enabled) return null
  if (calendarStore.toMinutes(day.end) <= calendarStore.toMinutes(day.start)) return 'Fin avant ou égale au début'
  return null
}

function dayBreakError(key: keyof WorkingDays): string | null {
  const day = days.value[key]
  if (!day.enabled || !day.breakEnabled) return null
  const bStart = calendarStore.toMinutes(day.breakStart)
  const bEnd   = calendarStore.toMinutes(day.breakEnd)
  if (bEnd <= bStart)                            return 'Fin avant début'
  if (bStart < calendarStore.toMinutes(day.start)) return 'Avant l\'heure de début'
  if (bEnd   > calendarStore.toMinutes(day.end))   return 'Après l\'heure de fin'
  return null
}
</script>
