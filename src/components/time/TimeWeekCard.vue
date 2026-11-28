<template>
  <CardModalShell
    :page-title="pageTitle"
    :page-number="row?.code"
    banner-label="Validation hebdomadaire"
    :status-label="week ? WEEK_STATUS_LABELS[week.status] : undefined"
    :is-loading="!week && !loadError"
    :error-msg="loadError"
    :has-data="!!week"
    :is-edit-mode="isEditMode"
    :is-saving="saving"
    :save-error="saveError"
    :show-edit="!!week?.canEdit"
    :show-title-new-button="false"
    :sidebar-items="sidebarItems"
    :current-no="row?.code ?? null"
    :has-prev="index > 0"
    :has-next="index >= 0 && index < rows.length - 1"
    :has-unsaved-changes="dirty"
    @close="emit('close')"
    @enter-edit="enterEdit"
    @cancel-edit="cancelEdit"
    @save="save"
    @go-prev="goEmployee(index - 1)"
    @go-next="goEmployee(index + 1)"
    @select-sidebar="selectSidebar"
    @clear-save-error="saveError = null"
  >
    <template #action-buttons>
      <div class="flex items-center gap-2 flex-wrap w-full">
        <div class="flex items-center gap-1">
          <button :class="L.btnOutline" :disabled="isEditMode || busy" title="Semaine précédente" @click="goWeek(-7)"><ChevronLeft class="w-4 h-4" /></button>
          <span class="text-[13px] font-semibold whitespace-nowrap px-1">Semaine {{ week?.weekNumber }}</span>
          <button :class="L.btnOutline" :disabled="isEditMode || busy" title="Semaine suivante" @click="goWeek(7)"><ChevronRight class="w-4 h-4" /></button>
        </div>
        <template v-if="week && !isEditMode">
          <button v-if="week.status === 'Open'" :class="L.btnOutline" :disabled="busy || !week.canControl" :title="week.blockers.join(' ; ')" @click="run('control')"><ClipboardCheck class="w-4 h-4" /> Contrôlé</button>
          <button v-if="isHr && week.status !== 'Validated'" :class="L.btnPrimary" :disabled="busy || !week.canValidate" :title="week.blockers.join(' ; ')" @click="validate"><CircleCheck class="w-4 h-4" /> Validé</button>
          <button v-if="week.canReopen" :class="L.btnOutline" :disabled="busy" @click="reopening = !reopening"><LockOpen class="w-4 h-4" /> Rouvrir</button>
          <button v-if="pendingIds.length" :class="L.btnOutline" :disabled="busy" @click="approvePending"><Check class="w-4 h-4" /> Approuver {{ pendingIds.length }} saisie(s) en attente</button>
          <button :class="L.btnOutline" :disabled="busy" @click="showResults = !showResults"><Calculator class="w-4 h-4" /> {{ showResults ? 'Cacher les résultats' : 'Voir les résultats' }}</button>
          <button :class="L.btnOutline" :disabled="busy" @click="print"><Printer class="w-4 h-4" /> Imprimer</button>
        </template>
      </div>
    </template>

    <template #form>
      <div v-if="week" class="px-4 py-4">
        <div class="flex items-center justify-between gap-3 flex-wrap mb-2">
          <p class="text-[13px] font-semibold text-foreground">Période du {{ formatDate(week.weekStart) }} au {{ formatDate(week.weekEnd) }}</p>
          <p class="text-[12px] text-muted-foreground">
            <span v-if="week.controlledBy">Contrôlée par {{ week.controlledBy }} {{ formatRelativeDateTime(week.controlledAt) }}. </span>
            <span v-if="week.validatedBy">Validée par {{ week.validatedBy }} {{ formatRelativeDateTime(week.validatedAt) }} : plus de modification.</span>
          </p>
        </div>

        <div v-if="reopening" class="flex items-end gap-2 flex-wrap mb-3 p-3 border border-border rounded-md bg-background">
          <div :class="cls.field" class="flex-1 min-w-[260px]">
            <label :class="cls.fieldLabel">Motif de la réouverture <span class="text-danger">*</span></label>
            <input v-model="reopenReason" type="text" maxlength="300" :class="cls.fieldInput" />
          </div>
          <button :class="L.btnPrimary" :disabled="busy || !reopenReason.trim()" @click="run('reopen', reopenReason)">Rouvrir la semaine</button>
        </div>

        <p v-if="week.status !== 'Validated' && week.blockers.length" class="text-[12px] text-warning bg-warning-bg rounded-md px-3 py-2 mb-2 flex items-start gap-1.5">
          <AlertTriangle class="w-3.5 h-3.5 shrink-0 mt-0.5" /> <span>Avant de contrôler ou valider : {{ week.blockers.join(' ; ') }}.</span>
        </p>
        <p class="text-[12px] text-muted-foreground mb-2">
          {{ calendarLabel(week.calendar) }}
          <router-link v-if="canEditCalendar" :to="{ name: 'hr-config-calendar' }" class="text-info no-underline hover:underline">Modifier les horaires</router-link>
        </p>
        <p v-if="week.site && week.site.minutes" class="text-[12px] text-muted-foreground mb-2">
          Site {{ week.site.name }} : {{ week.site.minutes }} min retirées à la première arrivée et au dernier départ de chaque jour de présence sur site. Les cases montrent les heures pointées, « Travaillé » le temps compté.
        </p>
        <p v-else-if="!week.isCadre" class="text-[12px] text-muted-foreground mb-2">{{ week.site ? `Site ${week.site.name} : aucune minute à déduire.` : 'Aucun site : aucun temps de trajet déduit.' }}</p>
        <p v-if="week.isCadre" class="text-[12px] text-muted-foreground mb-2">Cadre : pas d'heures supplémentaires, de panier ni de permanence en paie.</p>

        <div class="border border-border rounded-md overflow-x-auto">
          <table class="w-full text-[12px] min-w-[1120px]">
            <thead class="bg-background text-muted-foreground text-left">
              <tr>
                <th class="px-2 py-2 font-medium">Horaire</th>
                <th class="px-2 py-2 font-medium">Jour</th>
                <template v-for="n in PAIR_COUNT" :key="n">
                  <th class="px-1 py-2 font-medium border-l border-border">Entrée {{ n }}</th>
                  <th class="px-1 py-2 font-medium">Sortie {{ n }}</th>
                </template>
                <th class="px-1 py-2 font-medium border-l-2 border-danger">Sortie lendemain</th>
                <th class="px-1 py-2 font-medium text-center">Panier</th>
                <th class="px-1 py-2 font-medium text-center">Permanence</th>
                <th class="px-2 py-2 font-medium">Congé</th>
                <th class="px-2 py-2 font-medium text-right">Travaillé</th>
                <th class="px-2 py-2 font-medium text-right">HS calc.</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(d, i) in week.days" :key="d.date" class="border-t border-border" :class="d.incomplete ? 'bg-warning-bg/40' : ''">
                <td class="px-2 py-1.5 whitespace-nowrap text-muted-foreground">
                  <template v-if="d.holiday">Férié</template>
                  <template v-else-if="d.hours">
                    <span class="text-foreground">{{ d.hours }}</span>
                    <span class="block text-[10px]">{{ d.schedule }}, {{ d.pause ? `pause ${d.pause}` : 'sans pause' }}<template v-if="isOvernight(d.hours.slice(0, 5), d.hours.slice(6))">, nuit</template></span>
                  </template>
                  <template v-else>Repos</template>
                </td>
                <td class="px-2 py-1.5 whitespace-nowrap font-medium" :class="isWeekend(d.date) ? 'text-danger' : 'text-foreground'">
                  {{ dayLabel(d.date) }}
                  <AlertTriangle v-if="d.incomplete" class="w-3 h-3 inline text-warning" aria-label="Pointage incomplet" />
                  <Pencil v-if="d.corrected" class="w-3 h-3 inline text-violet-700" aria-label="Jour corrigé" />
                </td>
                <template v-for="n in PAIR_COUNT" :key="n">
                  <td v-for="side in SIDES" :key="side" class="px-1 py-1" :class="side === 'start' ? 'border-l border-border' : ''">
                    <input
                      v-model="drafts[i]!.pairs[n - 1]![side]"
                      type="time"
                      :disabled="!isEditMode || !!lockReason(d)"
                      :title="cellTitle(d, n - 1, side)"
                      :class="[timeCell, cellClass(d, i, n - 1, side)]"
                      :aria-label="`${side === 'start' ? 'Entrée' : 'Sortie'} ${n}, ${dayLabel(d.date)}`"
                    />
                  </td>
                </template>
                <td class="px-1 py-1 border-l-2 border-danger">
                  <input v-model="drafts[i]!.nextDayOut" type="time" :disabled="!isEditMode || !!lockReason(d)" :class="[timeCell, nightClass(d, i)]" :aria-label="`Sortie du lendemain, ${dayLabel(d.date)}`" />
                </td>
                <td class="px-1 py-1 text-center"><input v-model="drafts[i]!.panier" type="checkbox" class="accent-primary" :disabled="!isEditMode" :aria-label="`Panier, ${dayLabel(d.date)}`" /></td>
                <td class="px-1 py-1 text-center"><input v-model="drafts[i]!.permanence" type="checkbox" class="accent-primary" :disabled="!isEditMode" :aria-label="`Permanence, ${dayLabel(d.date)}`" /></td>
                <td class="px-2 py-1.5 max-w-[130px] truncate" :title="d.leave ?? ''">{{ d.leave ?? '-' }}</td>
                <td class="px-2 py-1.5 text-right whitespace-nowrap">
                  {{ d.worked === null ? '-' : formatHours(d.worked) }}
                  <span v-if="d.extraHours" class="block text-[10px] text-muted-foreground" title="Heures déclarées sans horaires">dont {{ formatHours(d.extraHours) }} en durée</span>
                  <span v-if="d.travelDeducted" class="block text-[10px] text-muted-foreground" title="Trajet et changement retirés">trajet -{{ d.travelDeducted }} min</span>
                </td>
                <td class="px-1 py-1 text-right"><span class="inline-block min-w-[52px] px-2 py-1 rounded bg-neutral-bg text-neutral" title="Calculées automatiquement, non modifiables">{{ d.overtime ? String(d.overtime).replace('.', ',') : '0' }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="flex items-center gap-x-4 gap-y-1 flex-wrap mt-2 text-[11px] text-muted-foreground">
          <span v-for="(label, key) in SOURCE_LABELS" :key="key" class="flex items-center gap-1.5">
            <span class="w-3.5 h-3.5 rounded border" :class="SOURCE_CLASSES[key]"></span> {{ label }}
          </span>
          <span class="flex items-center gap-1.5"><span class="w-3.5 h-3.5 rounded border border-dashed border-muted-foreground"></span> En attente d'approbation</span>
          <span class="flex items-center gap-1.5"><Pencil class="w-3 h-3 text-violet-700" /> Jour corrigé</span>
        </div>

        <div v-if="isEditMode" :class="cls.field" class="mt-3 max-w-xl">
          <label :class="cls.fieldLabel">Motif des corrections <span :class="cls.fieldOptional">(facultatif, gardé dans l'historique)</span></label>
          <input v-model="comment" type="text" maxlength="300" :class="cls.fieldInput" placeholder="Ex. oubli de badge à la sortie" />
        </div>

        <div v-if="showResults" class="mt-3">
          <div class="grid grid-cols-8 gap-2 max-lg:grid-cols-4">
            <div v-for="k in results" :key="k.label" :class="L.card">
              <div class="text-[11px] text-muted-foreground">{{ k.label }}</div>
              <div class="text-base font-semibold">{{ k.value }}</div>
            </div>
          </div>
          <p class="text-[11px] text-muted-foreground mt-1">Résultats de la semaine avant le plafond mensuel non imposable, appliqué au calcul de la paie. Les corrections non enregistrées n'y sont pas.</p>
        </div>

        <FormSection title="Historique" :default-open="false" class="mt-3">
          <ul class="flex flex-col gap-2">
            <li v-for="(h, i) in week.history" :key="i" class="flex items-start gap-2 text-[12px]">
              <span class="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0"></span>
              <span class="flex-1"><strong>{{ HISTORY[h.action] ?? h.action }}</strong> par {{ h.actor ?? '?' }}<span v-if="h.comment" class="text-muted-foreground"> : {{ h.comment }}</span></span>
              <span class="text-muted-foreground whitespace-nowrap">{{ new Date(h.createdAt).toLocaleString('fr-FR') }}</span>
            </li>
            <li v-if="!week.history.length" class="text-[12px] text-muted-foreground">Aucun événement.</li>
          </ul>
        </FormSection>
      </div>
    </template>
  </CardModalShell>
</template>

<script setup lang="ts">
/**
 * Semaine d'un employe, sur le modele de l'ancienne application de pointage :
 * un jour par ligne, trois periodes et la sortie du lendemain, panier et
 * permanence, heures supplementaires calculees non modifiables. Le manager
 * corrige puis marque la semaine controlee ; le RH la valide, ce qui la fige.
 */
import { computed, ref, watch } from 'vue'
import { AlertTriangle, Calculator, Check, ChevronLeft, ChevronRight, CircleCheck, ClipboardCheck, LockOpen, Pencil, Printer } from 'lucide-vue-next'
import CardModalShell from '../shared/CardModalShell.vue'
import FormSection from '../ui/form-field/FormSection.vue'
import * as cls from '../../lib/formClasses'
import * as L from '../../lib/listClasses'
import { getApiErrorMessage } from '../../lib/api'
import { formatDate, formatRelativeDateTime } from '../../lib/date'
import { confirmDialog } from '../../lib/confirm'
import { printWeek } from '../../lib/timeWeekPdf'
import { useAuthStore } from '../../stores/auth'
import { useToastStore } from '../../stores/toast'
import { useTimeStore } from '../../stores/time'
import { useTimeWeekStore, WEEK_STATUS_LABELS, type WeekDay, type WeekDayChange, type WeekDetail, type WeekRow } from '../../stores/timeWeeks'
import { PAIR_COUNT, SOURCE_CLASSES, SOURCE_LABELS, addDays, calendarLabel, changeOf, dayLabel, draftOf, isWeekend, lockReason, type DayDraft } from './weekGrid'
import { formatHours } from './timeFormat'
import { isOvernight } from '../../lib/scheduleHours'

const props = defineProps<{
  /** Employes de la liste courante (navigation entre fiches) */
  rows: WeekRow[]
  employeeId: string
  weekStart: string
}>()
const emit = defineEmits<{ close: []; changed: []; week: [weekStart: string] }>()

const auth = useAuthStore()
const store = useTimeWeekStore()
const timeStore = useTimeStore()
const toast = useToastStore()
const isHr = computed(() => auth.hasPermission('TEMPS_ACCES'))
const canEditCalendar = computed(() => auth.hasPermission('CONFIG_CALENDRIER'))

const SIDES = ['start', 'end'] as const
const timeCell = 'h-7 w-[84px] px-1 border rounded text-[12px] outline-none focus:border-primary disabled:cursor-default'
const HISTORY: Record<string, string> = {
  CORRECT: 'Correction', CONTROL: 'Contrôle', UNCONTROL: 'Contrôle retiré', VALIDATE: 'Validation', REOPEN: 'Réouverture',
  ALERT: 'Alerte heures supplémentaires',
}

const currentId = ref(props.employeeId)
const monday = ref(props.weekStart)
const index = computed(() => props.rows.findIndex(r => r.employeeId === currentId.value))
const row = computed(() => props.rows[index.value] ?? null)
const sidebarItems = computed(() => props.rows.map(r => ({ no: r.code, label: r.name })))
const pageTitle = computed(() => (row.value ? `${row.value.code} · ${row.value.name}` : week.value?.employee.name ?? ''))

const week = ref<WeekDetail | null>(null)
const drafts = ref<DayDraft[]>([])
const loadError = ref<string | null>(null)
const isEditMode = ref(false)
const saving = ref(false)
const busy = ref(false)
const saveError = ref<string | null>(null)
const comment = ref('')
const showResults = ref(false)
const reopening = ref(false)
const reopenReason = ref('')

function show(detail: WeekDetail) {
  week.value = detail
  drafts.value = detail.days.map(draftOf)
}

let seq = 0
async function load() {
  const mine = ++seq
  // Derniere lecture de cette semaine affichee tout de suite, puis relue en silence.
  const key = `week:${currentId.value}:${monday.value}`
  const cached = store.cache[key] as WeekDetail | undefined
  loadError.value = null
  if (cached) show(cached)
  else week.value = null
  try {
    const detail = await store.fetchWeek(currentId.value, monday.value)
    if (mine !== seq) return
    store.cache[key] = detail
    if (!isEditMode.value) show(detail)
  } catch (e) {
    if (mine === seq && !cached) loadError.value = getApiErrorMessage(e, 'Chargement de la semaine impossible')
  }
}
watch([currentId, monday], () => {
  isEditMode.value = false
  saveError.value = null
  reopening.value = false
  reopenReason.value = ''
  load()
}, { immediate: true })

// Corrections en cours : vrai des qu'un jour differe de ce qui est enregistre.
const dirty = computed(() => isEditMode.value && !!week.value
  && week.value.days.some((d, i) => changeOf(d, drafts.value[i]!) !== null))

async function leaveAllowed(): Promise<boolean> {
  return !dirty.value || (await confirmDialog('Les corrections non enregistrées seront perdues. Continuer ?'))
}
async function goEmployee(i: number) {
  const next = props.rows[i]
  if (next && (await leaveAllowed())) currentId.value = next.employeeId
}
function selectSidebar(code: string) {
  goEmployee(props.rows.findIndex(r => r.code === code))
}
function goWeek(days: number) {
  monday.value = addDays(monday.value, days)
  emit('week', monday.value)
}

function enterEdit() { saveError.value = null; comment.value = ''; isEditMode.value = true }
function cancelEdit() {
  isEditMode.value = false
  saveError.value = null
  if (week.value) drafts.value = week.value.days.map(draftOf)
}

async function save() {
  if (!week.value) return
  saveError.value = null
  const changes: WeekDayChange[] = []
  for (let i = 0; i < week.value.days.length; i++) {
    const change = changeOf(week.value.days[i]!, drafts.value[i]!)
    if (typeof change === 'string') { saveError.value = change; return }
    if (change) changes.push(change)
  }
  if (!changes.length) { isEditMode.value = false; return }
  saving.value = true
  toast.loading('Enregistrement...')
  try {
    const detail = await store.saveDays(currentId.value, monday.value, changes, comment.value.trim())
    isEditMode.value = false
    show(detail)
    timeStore.viewCache = {}
    toast.success('Semaine enregistrée et recalculée')
    emit('changed')
  } catch (e) {
    saveError.value = getApiErrorMessage(e, 'Enregistrement impossible')
    toast.error(saveError.value)
  } finally {
    saving.value = false
  }
}

async function run(action: 'control' | 'validate' | 'reopen', reason?: string) {
  busy.value = true
  toast.loading('Enregistrement...')
  try {
    show(await store.act(currentId.value, monday.value, action, reason))
    reopening.value = false
    reopenReason.value = ''
    timeStore.viewCache = {}
    toast.success('Effectué avec succès')
    emit('changed')
  } catch (e) {
    toast.error(getApiErrorMessage(e, 'Action impossible'))
  } finally {
    busy.value = false
  }
}

async function validate() {
  const note = week.value?.status === 'Open' ? " Le manager ne l'a pas encore contrôlée." : ''
  if (await confirmDialog(`Valider la semaine ? Elle ne pourra plus être modifiée.${note}`)) await run('validate')
}

const pendingIds = computed(() => week.value?.days.flatMap(d => d.pendingEntryIds) ?? [])
async function approvePending() {
  const ids = [...pendingIds.value]
  if (!(await confirmDialog(`Approuver ${ids.length} saisie(s) en attente de cette semaine ?`))) return
  busy.value = true
  toast.loading('Approbation...')
  let refused = ''
  for (const id of ids) {
    try { await timeStore.approve(id) } catch (e) { refused = getApiErrorMessage(e, 'Approbation impossible') }
  }
  busy.value = false
  if (refused) toast.error(refused)
  else toast.success('Effectué avec succès')
  await load()
  emit('changed')
}

async function print() {
  if (!week.value) return
  try { await printWeek(week.value) } catch { toast.error('Impression impossible') }
}

// ── Couleurs ──
function sourceClass(d: WeekDay, i: number, changed: boolean, pairIndex: number): string {
  if (changed) return SOURCE_CLASSES.Corrected
  const punch = d.punches[pairIndex]
  if (!punch) return 'bg-card border-border'
  return `${SOURCE_CLASSES[punch.source]}${punch.pending ? ' border-dashed italic opacity-70' : ''}`
}
function cellClass(d: WeekDay, i: number, pairIndex: number, side: 'start' | 'end'): string {
  const value = drafts.value[i]!.pairs[pairIndex]![side]
  const changed = value !== draftOf(d).pairs[pairIndex]![side]
  if (!value && !changed) return 'bg-card border-border'
  return sourceClass(d, i, changed, pairIndex)
}
function nightClass(d: WeekDay, i: number): string {
  const value = drafts.value[i]!.nextDayOut
  const changed = value !== draftOf(d).nextDayOut
  if (!value && !changed) return 'bg-card border-border'
  return sourceClass(d, i, changed, d.punches.findIndex(p => p.nextDay))
}
function cellTitle(d: WeekDay, pairIndex: number, side: 'start' | 'end'): string {
  const locked = isEditMode.value ? lockReason(d) : null
  if (locked) return locked
  const punch = d.punches[pairIndex]
  return punch?.[side] ? `${SOURCE_LABELS[punch.source]}${punch.pending ? ', en attente' : ''}` : ''
}

const results = computed(() => {
  const t = week.value?.totals
  if (!t) return []
  return [
    { label: 'Travaillé', value: formatHours(t.worked) },
    { label: 'Heures sup.', value: formatHours(t.overtime) },
    { label: 'À 130 %', value: formatHours(t.hs130) },
    { label: 'À 150 %', value: formatHours(t.hs150) },
    { label: 'Nuit', value: formatHours(t.night) },
    { label: 'Dimanche et férié', value: formatHours(t.holiday) },
    { label: 'Paniers', value: String(t.panier) },
    { label: 'Permanence', value: `${t.permanenceAmount.toLocaleString('fr-FR')} Ar` },
  ]
})
</script>
