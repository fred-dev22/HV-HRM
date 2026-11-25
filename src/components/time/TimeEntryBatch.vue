<template>
  <CreateModalShell
    title="Saisie en lot"
    banner-label="Saisie de temps en lot"
    :create-label="createLabel"
    saving-label="En cours…"
    :create-disabled="!!report && !done && report.planned === 0"
    create-disabled-reason="Aucune saisie à créer avec ces critères."
    :save-error="error"
    :is-saving="saving"
    @close="close"
    @create="submit"
  >
    <template #form>
      <div class="flex-1 overflow-auto px-6 py-5">
        <div class="max-w-3xl mx-auto">
          <!-- Resultat du controle ou de la creation, en tete pour rester visible -->
          <FormSection v-if="report" :title="done ? 'Résultat' : 'Contrôle avant création'">
            <p class="text-[13px] mb-2">
              <template v-if="done"><strong>{{ report.created }}</strong> saisie(s) créée(s).</template>
              <template v-else><strong>{{ report.planned }}</strong> saisie(s) seront créées. Rien n'est encore enregistré.</template>
            </p>
            <div class="border border-border rounded-md max-h-[220px] overflow-auto">
              <table class="w-full text-[12px]">
                <thead class="bg-background text-muted-foreground text-left sticky top-0">
                  <tr><th class="px-2.5 py-1.5 font-medium">Employé</th><th class="px-2.5 py-1.5 font-medium w-[90px]">{{ done ? 'Créées' : 'À créer' }}</th><th class="px-2.5 py-1.5 font-medium">Journées écartées</th></tr>
                </thead>
                <tbody>
                  <tr v-for="e in report.employees" :key="e.employeeId" class="border-t border-border align-top">
                    <td class="px-2.5 py-1.5">{{ e.name }} <span class="text-muted-foreground">{{ e.code }}</span></td>
                    <td class="px-2.5 py-1.5 font-medium">{{ e.planned }}</td>
                    <td class="px-2.5 py-1.5">
                      <div v-for="s in e.skipped" :key="s.reason" class="text-warning">{{ s.reason }} : {{ shortDates(s.dates) }}</div>
                      <span v-if="!e.skipped.length" class="text-muted-foreground">-</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </FormSection>

          <FormSection title="Employés">
            <div class="grid grid-cols-2 gap-3 max-sm:grid-cols-1 mb-2">
              <div :class="cls.field">
                <label :class="cls.fieldLabel">Équipe (entité et sous-entités)</label>
                <select v-model="entityId" :class="cls.fieldSelect">
                  <option value="">Toute l'entreprise</option>
                  <option v-for="u in entityOptions" :key="u.id" :value="u.id">{{ u.label }}</option>
                </select>
              </div>
              <div :class="cls.field">
                <label :class="cls.fieldLabel">Rechercher</label>
                <input v-model="search" type="search" :class="cls.fieldInput" placeholder="Nom ou matricule" />
              </div>
            </div>
            <div class="flex items-center justify-between mb-1.5">
              <label class="flex items-center gap-2 text-[13px] cursor-pointer">
                <input type="checkbox" class="accent-primary" :checked="allShownSelected" :disabled="!shown.length" @change="toggleShown" />
                Tout cocher ({{ shown.length }} affiché(s))
              </label>
              <span class="text-[12px] text-muted-foreground">{{ selected.length }} employé(s) choisi(s)</span>
            </div>
            <div class="border border-border rounded-md max-h-[230px] overflow-auto">
              <label v-for="e in shown" :key="e.id" class="flex items-center gap-2.5 px-2.5 py-1.5 border-b border-border last:border-b-0 text-[13px] cursor-pointer hover:bg-background">
                <input v-model="selected" type="checkbox" :value="e.id" class="accent-primary" />
                <span class="flex-1 min-w-0 truncate">{{ e.name }} <span class="text-muted-foreground text-[11px]">{{ e.code }}</span></span>
                <span class="text-muted-foreground text-[11px] truncate max-w-[200px]">{{ e.entityName }}</span>
              </label>
              <p v-if="!shown.length" class="px-2.5 py-3 text-[12px] text-muted-foreground">Aucun employé pour ces critères.</p>
            </div>
          </FormSection>

          <FormSection title="Élément à saisir">
            <div class="flex flex-col gap-4">
              <div :class="cls.field">
                <label :class="cls.fieldLabel">Type de saisie <span class="text-danger">*</span></label>
                <select v-model="form.entryType" :class="cls.fieldSelect">
                  <option v-for="(label, key) in ENTRY_TYPE_LABELS" :key="key" :value="key">{{ label }}</option>
                </select>
              </div>

              <div :class="cls.fieldRow">
                <div :class="cls.field">
                  <label :class="cls.fieldLabel">Du <span class="text-danger">*</span></label>
                  <input v-model="form.from" type="date" :class="cls.fieldInput" />
                </div>
                <div :class="cls.field">
                  <label :class="cls.fieldLabel">Au <span class="text-danger">*</span></label>
                  <input v-model="form.to" type="date" :min="form.from" :class="cls.fieldInput" />
                </div>
              </div>

              <div :class="cls.field">
                <label :class="cls.fieldLabel">Jours concernés <span class="text-danger">*</span></label>
                <div class="flex flex-wrap gap-x-4 gap-y-1.5">
                  <label v-for="d in WEEKDAYS" :key="d.value" :class="cls.radioItem">
                    <input v-model="form.weekdays" type="checkbox" :value="d.value" /> {{ d.label }}
                  </label>
                </div>
                <label :class="cls.radioItem" class="mt-1">
                  <input v-model="form.includeHolidays" type="checkbox" /> Inclure les jours fériés
                </label>
              </div>

              <template v-if="needsTimes">
                <div class="grid grid-cols-3 gap-3 max-sm:grid-cols-1">
                  <div :class="cls.field">
                    <label :class="cls.fieldLabel">Heure de début</label>
                    <input v-model="form.start" type="time" :class="cls.fieldInput" />
                  </div>
                  <div :class="cls.field">
                    <label :class="cls.fieldLabel">Heure de fin</label>
                    <input v-model="form.end" type="time" :class="cls.fieldInput" />
                  </div>
                  <div :class="cls.field">
                    <label :class="cls.fieldLabel">ou durée par jour (h)</label>
                    <input v-model="form.hours" type="number" min="0.25" max="24" step="0.25" :disabled="!!(form.start || form.end)" :class="cls.fieldInput" />
                  </div>
                </div>
                <div v-if="duration > 0" class="flex"><span :class="cls.hintChipInfo">Durée par jour : {{ formatHours(duration) }}</span></div>
              </template>
              <div v-else class="flex"><span :class="cls.hintChipNeutral">Compte pour 1 par jour : aucun horaire à saisir.</span></div>

              <div :class="cls.field">
                <label :class="cls.fieldLabel">Commentaire <span :class="cls.fieldOptional">(facultatif)</span></label>
                <textarea v-model="form.comments" :class="cls.fieldTextarea" rows="2" maxlength="500" placeholder="Ex. astreinte de la semaine, chantier hors site..."></textarea>
              </div>
              <p class="text-[12px] text-muted-foreground">Les journées de congé approuvé et celles déjà déclarées avec le même type sont écartées. Chaque saisie suit ensuite le circuit de validation de l'employé.</p>
            </div>
          </FormSection>
        </div>
      </div>
    </template>
  </CreateModalShell>
</template>

<script setup lang="ts">
/**
 * Saisie de temps en lot (RH) : un meme element (permanence, panier, hors site,
 * mission...) pour plusieurs employes sur les jours choisis d'une periode. Un
 * premier clic controle (rien n'est ecrit), le second cree. Toute modification
 * du formulaire annule le controle.
 */
import { computed, reactive, ref, watch } from 'vue'
import CreateModalShell from '../shared/CreateModalShell.vue'
import FormSection from '../ui/form-field/FormSection.vue'
import * as cls from '../../lib/formClasses'
import { getApiErrorMessage } from '../../lib/api'
import { todayIso } from '../../lib/date'
import { useToastStore } from '../../stores/toast'
import { useEmployeeStore } from '../../stores/employees'
import { useEntityStore } from '../../stores/entities'
import { useTimeStore, ENTRY_TYPE_LABELS, type TimeEntryType, type TimeEntryBatchPayload, type TimeEntryBatchReport } from '../../stores/time'
import { formatHours, hoursBetween } from './timeFormat'

const emit = defineEmits<{ close: []; saved: [] }>()

const store = useTimeStore()
const toast = useToastStore()
const employeeStore = useEmployeeStore()
const entityStore = useEntityStore()

// Annuaire et entites charges seulement a l'ouverture de cette fenetre.
Promise.all([entityStore.fetchAll(), employeeStore.fetchDirectory()]).catch((e) => {
  error.value = getApiErrorMessage(e, 'Chargement des employés impossible')
})

const WEEKDAYS = [
  { value: 1, label: 'Lun' }, { value: 2, label: 'Mar' }, { value: 3, label: 'Mer' }, { value: 4, label: 'Jeu' },
  { value: 5, label: 'Ven' }, { value: 6, label: 'Sam' }, { value: 0, label: 'Dim' },
]

// ── Choix des employes ──
const entityId = ref('')
const search = ref('')
const selected = ref<string[]>([])

const entityOptions = computed(() => {
  const out: { id: string; label: string }[] = []
  const walk = (parentId: string | null, depth: number) => {
    for (const u of entityStore.entities.filter(e => e.parentId === parentId)) {
      out.push({ id: u.id, label: `${'   '.repeat(depth)}${u.name}` })
      walk(u.id, depth + 1)
    }
  }
  walk(null, 0)
  return out
})
// L'entite choisie et toutes ses descendantes.
const scope = computed(() => {
  if (!entityId.value) return null
  const ids = new Set([entityId.value])
  const queue = [entityId.value]
  while (queue.length) {
    for (const child of entityStore.getChildren(queue.shift()!)) {
      if (!ids.has(child.id)) { ids.add(child.id); queue.push(child.id) }
    }
  }
  return ids
})
const shown = computed(() => {
  const q = search.value.trim().toLowerCase()
  return employeeStore.directory
    .filter(e => e.status !== 'inactive')
    .filter(e => !scope.value || scope.value.has(e.entityId ?? ''))
    .filter(e => !q || e.name.toLowerCase().includes(q) || e.code.toLowerCase().includes(q))
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
})
const allShownSelected = computed(() => shown.value.length > 0 && shown.value.every(e => selected.value.includes(e.id)))
function toggleShown() {
  const ids = shown.value.map(e => e.id)
  selected.value = allShownSelected.value
    ? selected.value.filter(id => !ids.includes(id))
    : [...new Set([...selected.value, ...ids])]
}

// ── Element a saisir ──
const form = reactive({
  entryType: 'permanence' as TimeEntryType, from: todayIso(), to: todayIso(), weekdays: [1, 2, 3, 4, 5],
  includeHolidays: false, start: '', end: '', hours: '' as string | number, comments: '',
})
const needsTimes = computed(() => form.entryType !== 'panier' && form.entryType !== 'permanence')
const duration = computed(() => hoursBetween(form.start, form.end))

// ── Controle puis creation ──
const error = ref('')
const saving = ref(false)
const report = ref<TimeEntryBatchReport | null>(null)
const done = ref(false)

const createLabel = computed(() => {
  if (done.value) return 'Fermer'
  return report.value ? `Créer ${report.value.planned} saisie(s)` : 'Contrôler'
})
// Un controle ne vaut que pour le formulaire qui l'a produit.
watch(() => JSON.stringify([selected.value, form]), () => { report.value = null; done.value = false; error.value = '' })

function buildPayload(): TimeEntryBatchPayload | string {
  if (!selected.value.length) return 'Choisissez au moins un employé.'
  if (selected.value.length > 200) return 'Pas plus de 200 employés à la fois.'
  if (!form.from || !form.to) return 'Indiquez la période.'
  if (form.to < form.from) return 'La date de fin doit être après la date de début.'
  if (!form.weekdays.length) return 'Choisissez au moins un jour de la semaine.'
  const payload: TimeEntryBatchPayload = {
    EmployeeIds: [...selected.value], From: form.from, To: form.to, Weekdays: [...form.weekdays],
    IncludeHolidays: form.includeHolidays, EntryType: form.entryType, Comments: form.comments || undefined,
  }
  if (!needsTimes.value) return payload
  if (form.start || form.end) {
    if (!form.start || !form.end) return "Renseignez l'heure de début et l'heure de fin."
    if (duration.value <= 0) return "L'heure de fin doit être après l'heure de début."
    return { ...payload, StartTime: form.start, EndTime: form.end }
  }
  const hours = Number(form.hours)
  if (!(hours > 0 && hours <= 24)) return "Indiquez l'heure de début et de fin, ou la durée par jour."
  return { ...payload, Hours: hours }
}

async function submit() {
  if (saving.value) return
  if (done.value) { close(); return }
  error.value = ''
  const payload = buildPayload()
  if (typeof payload === 'string') { error.value = payload; return }
  const creating = !!report.value
  const expected = report.value?.planned ?? 0
  const sent = JSON.stringify([selected.value, form])
  saving.value = true
  if (creating) toast.loading('Enregistrement...')
  try {
    const result = await store.createBatch({ ...payload, DryRun: !creating })
    if (!creating) {
      // Formulaire modifie pendant le controle : resultat perime, ignore.
      if (sent === JSON.stringify([selected.value, form])) report.value = result
      return
    }
    emit('saved')
    if (result.created === expected) {
      toast.success(`${result.created} saisie(s) créée(s)`)
      emit('close')
      return
    }
    // Ecart avec le controle (donnees changees entre-temps) : on montre le detail.
    toast.error(`${result.created} saisie(s) créée(s) sur ${expected}`)
    report.value = result
    done.value = true
  } catch (e) {
    error.value = getApiErrorMessage(e, creating ? 'Enregistrement impossible' : 'Contrôle impossible')
    if (creating) toast.error(error.value)
  } finally {
    saving.value = false
  }
}

// La fenetre ne se ferme pas pendant l'enregistrement.
function close() { if (!saving.value) emit('close') }

function shortDates(dates: string[]): string {
  const first = dates.slice(0, 4).map(d => `${d.slice(8, 10)}/${d.slice(5, 7)}`).join(', ')
  return dates.length > 4 ? `${first} et ${dates.length - 4} autre(s)` : first
}
</script>
