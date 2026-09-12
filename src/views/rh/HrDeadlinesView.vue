<template>
  <div class="px-7 py-6 max-w-[1100px] mx-auto w-full">
    <div :class="L.pageHeader">
      <div>
        <div :class="L.pageTitle">Échéances à venir</div>
        <div :class="L.pageSub">
          Fins de CDD, de stage, de période d'essai et de contrat, anniversaires.
          {{ scopeNote }}
        </div>
      </div>
      <button v-if="canRunNow" :class="L.btnOutline" :disabled="running" @click="runNow">
        <BellRing class="w-4 h-4" /> {{ running ? 'Envoi...' : 'Lancer les rappels maintenant' }}
      </button>
    </div>

    <!-- Filtres -->
    <div class="flex items-end gap-3 flex-wrap mb-4 bg-card border border-border rounded-lg p-3.5">
      <div :class="cls.field">
        <label :class="cls.fieldLabel">Du</label>
        <input type="date" v-model="from" :class="cls.fieldInput" />
      </div>
      <div :class="cls.field">
        <label :class="cls.fieldLabel">Au</label>
        <input type="date" v-model="to" :class="cls.fieldInput" />
      </div>
      <button :class="L.btnPrimary" @click="reload"><Search class="w-4 h-4" /> Appliquer</button>
      <div class="flex items-center gap-1.5 flex-wrap ml-auto">
        <button
          v-for="c in CATEGORY_KEYS" :key="c"
          class="text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors"
          :class="activeCats.has(c) ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'"
          @click="toggleCat(c)"
        >
          {{ CATEGORY_LABELS[c] }}
        </button>
      </div>
    </div>

    <div v-if="store.loading" :class="L.emptyState">
      <CalendarClock class="w-8 h-8" /><p class="text-[13px]">Chargement...</p>
    </div>
    <div v-else-if="store.error" :class="L.emptyState">
      <CircleAlert class="w-8 h-8 text-danger" /><p class="text-[13px]">{{ store.error }}</p>
    </div>
    <div v-else-if="filtered.length === 0" :class="L.emptyState">
      <CalendarClock class="w-8 h-8" /><p class="text-[13px]">Aucune échéance sur cette période.</p>
    </div>
    <div v-else class="flex flex-col gap-5">
      <div v-for="group in grouped" :key="group.month">
        <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 capitalize">{{ group.month }}</div>
        <div :class="L.tableCard">
          <table :class="L.table">
            <tbody>
              <tr v-for="d in group.items" :key="d.category + d.entityId + d.date" :class="L.rowHover">
                <td :class="L.td" class="w-9">
                  <span class="w-7 h-7 rounded-full flex items-center justify-center" :class="d.category === 'birthday' ? 'bg-success-bg text-success' : 'bg-primary/10 text-primary'">
                    <component :is="iconFor(d.category)" class="w-3.5 h-3.5" />
                  </span>
                </td>
                <td :class="L.td" class="font-medium">
                  <RouterLink v-if="d.href" :to="d.href" class="hover:text-primary hover:underline">{{ d.subjectName }}</RouterLink>
                  <span v-else>{{ d.subjectName }}</span>
                </td>
                <td :class="L.td" class="text-muted-foreground">{{ CATEGORY_LABELS[d.category] }}</td>
                <td :class="L.td" class="text-muted-foreground">{{ d.entityName || '-' }}</td>
                <td :class="L.td" class="whitespace-nowrap">{{ formatDate(d.date) }}</td>
                <td :class="L.td" class="text-right">
                  <span class="text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap" :class="whenClass(d.daysUntil)">
                    {{ whenText(d.daysUntil) }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Ecran Administration "Echeances a venir" (backlog "Rappels d'echeances").
 * Branche sur GET /reminders/upcoming : perimetre entreprise pour
 * EMPLOYE_VOIR_TOUT, perimetre equipe (unites gerees) pour EMPLOYE_VOIR_EQUIPE.
 * Le cron quotidien du backend cree deja les notifications ; le bouton "Lancer
 * les rappels maintenant" (EMPLOYE_VOIR_TOUT) declenche la meme passe a la
 * demande.
 */
import { ref, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import {
  CalendarClock, CalendarX, GraduationCap, Cake, UserCheck, FileClock,
  BellRing, Search, CircleAlert,
} from 'lucide-vue-next'
import * as cls from '../../lib/formClasses'
import * as L from '../../lib/listClasses'
import { formatDate, todayIso } from '../../lib/date'
import { withToast } from '../../lib/withToast'
import { useToastStore } from '../../stores/toast'
import { getApiErrorMessage } from '../../lib/api'
import { useAuthStore } from '../../stores/auth'
import { useRemindersStore, CATEGORY_LABELS } from '../../stores/reminders'
import type { DeadlineCategory } from '../../stores/reminders'

const store = useRemindersStore()
const auth = useAuthStore()
const toast = useToastStore()

const canRunNow = computed(() => auth.hasPermission('EMPLOYE_VOIR_TOUT'))
const scopeNote = computed(() =>
  auth.hasPermission('EMPLOYE_VOIR_TOUT')
    ? 'Périmètre entreprise.'
    : 'Périmètre limité aux unités que vous gérez.',
)

const CATEGORY_KEYS: DeadlineCategory[] = ['cdd_end', 'internship_end', 'birthday', 'trial_end', 'contract_end']
const activeCats = ref<Set<DeadlineCategory>>(new Set(CATEGORY_KEYS))
function toggleCat(c: DeadlineCategory) {
  const next = new Set(activeCats.value)
  if (next.has(c)) next.delete(c)
  else next.add(c)
  // Ne jamais tout decocher : au moins une categorie visible.
  activeCats.value = next.size === 0 ? new Set(CATEGORY_KEYS) : next
}

const today = todayIso()
const from = ref(today)
const to = ref(addDaysIso(today, 90))

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function reload() { store.fetchUpcoming(from.value || undefined, to.value || undefined) }
onMounted(reload)

const filtered = computed(() => store.items.filter((d) => activeCats.value.has(d.category)))

const grouped = computed(() => {
  const map = new Map<string, typeof store.items>()
  for (const d of filtered.value) {
    const key = new Date(d.date + 'T00:00:00Z').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(d)
  }
  return [...map.entries()].map(([month, items]) => ({ month, items }))
})

const running = ref(false)
async function runNow() {
  running.value = true
  try {
    const r = await withToast('Envoi des rappels...', () => store.runNow(), () => 'Envoi impossible')
    toast.success(`${r.notificationsCreated} rappel(s) envoyé(s), ${r.skippedAlreadySent} déjà notifié(s).`)
  } catch (e) {
    toast.error(getApiErrorMessage(e, 'Envoi impossible'))
  } finally {
    running.value = false
  }
}

const ICONS: Record<DeadlineCategory, unknown> = {
  cdd_end: CalendarX, internship_end: GraduationCap, birthday: Cake, trial_end: UserCheck, contract_end: FileClock,
}
function iconFor(c: DeadlineCategory) { return ICONS[c] }

function whenText(days: number): string {
  if (days < 0) return 'échue'
  if (days === 0) return "aujourd'hui"
  if (days === 1) return 'dans 1 jour'
  return `dans ${days} jours`
}
function whenClass(days: number): string {
  if (days <= 1) return 'bg-danger-bg text-danger'
  if (days <= 7) return 'bg-warning-bg text-warning'
  return 'bg-neutral-bg text-neutral'
}
</script>
