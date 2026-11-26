<template>
  <CreateModalShell
    title="Saisie en lot"
    banner-label="Saisie de temps en lot"
    :create-label="createLabel"
    saving-label="En cours…"
    :create-disabled="createDisabled"
    create-disabled-reason="Aucune saisie à créer avec ces lignes."
    :save-error="error"
    :is-saving="saving"
    @close="close"
    @create="submit"
  >
    <template #form>
      <div class="flex-1 overflow-auto px-6 py-5">
        <div class="max-w-4xl mx-auto">
          <!-- Resultat apres creation -->
          <FormSection v-if="outcome" title="Résultat">
            <p class="text-[13px] mb-2"><strong>{{ outcome.created }}</strong> saisie(s) créée(s), {{ outcome.notCreated.length }} ligne(s) non créée(s).</p>
            <div class="border border-border rounded-md max-h-[360px] overflow-auto">
              <div v-for="(l, i) in outcome.notCreated" :key="i" class="px-2.5 py-1.5 text-[12px] border-b border-border last:border-b-0">
                {{ l.name }} · {{ shortDate(l.date) }} : <span class="text-warning">{{ l.reason }}</span>
              </div>
            </div>
          </FormSection>

          <!-- Etape 2 : les journees preparees, ajustables une par une -->
          <template v-else-if="rows.length">
            <FormSection title="Lignes à créer">
              <div class="flex items-center justify-between gap-3 flex-wrap mb-2">
                <p class="text-[13px]">
                  <strong>{{ toCreate }}</strong> saisie(s) prête(s) sur {{ rows.length }} ligne(s). Rien n'est encore enregistré.
                  <span v-if="conflicts" class="text-warning">{{ conflicts }} en conflit : choisissez, sinon elles ne seront pas créées.</span>
                </p>
                <button type="button" class="text-[12px] text-info cursor-pointer bg-transparent border-0 hover:underline" @click="backToCriteria">Modifier les critères</button>
              </div>
              <p v-if="leftOut.length" class="text-[12px] text-muted-foreground mb-2">Journées écartées : {{ leftOut.join(' ; ') }}.</p>
              <div class="border border-border rounded-md max-h-[420px] overflow-auto">
                <table class="w-full text-[12px]">
                  <thead class="bg-background text-muted-foreground text-left sticky top-0 z-10">
                    <tr>
                      <th class="px-2 py-1.5 font-medium">Date</th>
                      <template v-if="needsTimes">
                        <th class="px-2 py-1.5 font-medium">Entrée</th>
                        <th class="px-2 py-1.5 font-medium">Sortie</th>
                      </template>
                      <th class="px-2 py-1.5 font-medium min-w-[220px]">Contrôle</th>
                      <th class="px-2 py-1.5 w-[64px]"></th>
                    </tr>
                  </thead>
                  <!-- Un bloc par employe : ses heures d'un coup, puis chaque journee -->
                  <tbody v-for="g in groups" :key="g.employeeId">
                    <tr class="border-t border-border bg-tint">
                      <td :colspan="needsTimes ? 5 : 3" class="px-2 py-1.5">
                        <div class="flex items-center gap-x-3 gap-y-1.5 flex-wrap">
                          <span class="font-semibold text-foreground">{{ g.name }} <span class="text-muted-foreground font-normal">{{ g.code }}</span></span>
                          <div v-if="needsTimes" class="flex items-center gap-1.5 ml-auto">
                            <span class="text-muted-foreground">Ses heures :</span>
                            <input v-model="draftOf(g.employeeId).start" type="time" :class="cell" :aria-label="`Entrée de ${g.name}`" />
                            <input v-model="draftOf(g.employeeId).end" type="time" :class="cell" :aria-label="`Sortie de ${g.name}`" />
                            <button type="button" :class="smallButton" :disabled="!canApply(g.employeeId)" @click="applyTo(g.employeeId)">Appliquer à ses journées</button>
                          </div>
                          <button type="button" :class="[smallButton, needsTimes ? '' : 'ml-auto']" @click="addDay(g.employeeId)"><Plus class="w-3 h-3" /> Ajouter un jour</button>
                        </div>
                      </td>
                    </tr>
                    <tr v-for="r in g.rows" :key="r.key" class="border-t border-border align-top">
                      <td class="px-2 py-1"><input v-model="r.date" type="date" :class="cell" /></td>
                      <template v-if="needsTimes">
                        <td class="px-2 py-1"><input v-model="r.start" type="time" :class="cell" /></td>
                        <td class="px-2 py-1"><input v-model="r.end" type="time" :class="cell" /></td>
                      </template>
                      <td class="px-2 py-1.5">
                        <span v-if="!r.check" class="text-muted-foreground">À vérifier</span>
                        <div v-else class="flex flex-col gap-1">
                          <span :class="TONES[r.check.action]">{{ describe(r.check) }}</span>
                          <select v-if="r.check.action === 'conflict' || r.onConflict" :value="r.onConflict" :class="cell" @change="choose(r, ($event.target as HTMLSelectElement).value)">
                            <option value="">Choisir...</option>
                            <option value="skip">Garder l'existant</option>
                            <option v-if="r.check.canReplace || r.onConflict === 'replace'" value="replace">Remplacer par cette ligne</option>
                          </select>
                        </div>
                      </td>
                      <td class="px-2 py-1.5 whitespace-nowrap text-right">
                        <button v-if="needsTimes" type="button" class="text-muted-foreground hover:text-primary cursor-pointer mr-2" title="Ajouter une autre période ce jour" @click="addPeriod(r)"><Plus class="w-3.5 h-3.5" /></button>
                        <button type="button" class="text-muted-foreground hover:text-danger cursor-pointer" title="Retirer cette ligne" @click="removeRow(r)"><X class="w-3.5 h-3.5" /></button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p class="text-[12px] text-muted-foreground mt-2">Réglez les heures d'un employé d'un coup, ou changez une journée seule. Chaque saisie suit ensuite le circuit de validation de l'employé.</p>
            </FormSection>
          </template>

          <!-- Etape 1 : qui, quoi, quand -->
          <template v-else>
            <FormSection title="Employés">
              <div class="grid grid-cols-2 gap-3 max-sm:grid-cols-1 mb-2">
                <div :class="cls.field">
                  <label :class="cls.fieldLabel">Entité</label>
                  <select v-model="entity" :class="cls.fieldSelect">
                    <option value="">Toutes</option>
                    <option v-for="name in entityNames" :key="name" :value="name">{{ name }}</option>
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
                  <div :class="cls.fieldRow">
                    <div :class="cls.field">
                      <label :class="cls.fieldLabel">Heure de début <span class="text-danger">*</span></label>
                      <input v-model="form.start" type="time" :class="cls.fieldInput" />
                    </div>
                    <div :class="cls.field">
                      <label :class="cls.fieldLabel">Heure de fin <span class="text-danger">*</span></label>
                      <input v-model="form.end" type="time" :class="cls.fieldInput" />
                    </div>
                  </div>
                  <div v-if="duration > 0" class="flex"><span :class="cls.hintChipInfo">Durée par jour : {{ formatHours(duration) }}</span></div>
                </template>
                <div v-else class="flex"><span :class="cls.hintChipNeutral">Compte pour 1 par jour : aucun horaire à saisir.</span></div>

                <div :class="cls.field">
                  <label :class="cls.fieldLabel">Commentaire <span :class="cls.fieldOptional">(facultatif)</span></label>
                  <textarea v-model="form.comments" :class="cls.fieldTextarea" rows="2" maxlength="500" placeholder="Ex. astreinte de la semaine, chantier hors site..."></textarea>
                </div>
                <p class="text-[12px] text-muted-foreground">Ces valeurs sont communes au départ : à l'étape suivante, vous pouvez les changer employé par employé et jour par jour. Les journées de congé approuvé sont écartées, ainsi que les paniers et permanences déjà déclarés.</p>
              </div>
            </FormSection>
          </template>
        </div>
      </div>
    </template>
  </CreateModalShell>
</template>

<script setup lang="ts">
/**
 * Saisie de temps en lot (RH, ou manager pour son equipe), en deux temps : les
 * criteres preparent une ligne par employe et par jour ; les heures se reglent
 * ensuite employe par employe ou journee par journee (autre jour, seconde
 * periode), puis le serveur controle les lignes avant creation. Une ligne en conflit n'est creee que si le choix est fait.
 */
import { computed, reactive, ref, watch } from 'vue'
import { Plus, X } from 'lucide-vue-next'
import CreateModalShell from '../shared/CreateModalShell.vue'
import FormSection from '../ui/form-field/FormSection.vue'
import * as cls from '../../lib/formClasses'
import { getApiErrorMessage } from '../../lib/api'
import { todayIso } from '../../lib/date'
import { useToastStore } from '../../stores/toast'
import {
  useTimeStore, ENTRY_TYPE_LABELS,
  type TimeEntryType, type TimeEntryBatchPayload, type TimeEntryEmployee, type TimeEntryLine, type TimeEntryLineResult,
} from '../../stores/time'
import { formatHours, hoursBetween } from './timeFormat'

const emit = defineEmits<{ close: []; saved: [] }>()

const store = useTimeStore()
const toast = useToastStore()

const error = ref('')
// Liste chargee seulement a l'ouverture de cette fenetre.
const employees = ref<TimeEntryEmployee[]>([])
store.fetchEntryEmployees()
  .then(list => (employees.value = list))
  .catch((e) => { error.value = getApiErrorMessage(e, 'Chargement des employés impossible') })

const WEEKDAYS = [
  { value: 1, label: 'Lun' }, { value: 2, label: 'Mar' }, { value: 3, label: 'Mer' }, { value: 4, label: 'Jeu' },
  { value: 5, label: 'Ven' }, { value: 6, label: 'Sam' }, { value: 0, label: 'Dim' },
]
const cell = 'h-7 px-1.5 border border-border rounded text-[12px] bg-background outline-none focus:border-primary'
const smallButton = 'inline-flex items-center gap-1 h-7 px-2 border border-border rounded text-[12px] bg-card text-foreground cursor-pointer hover:border-primary disabled:opacity-50 disabled:cursor-not-allowed'

// ── Choix des employes ──
const entity = ref('')
const search = ref('')
const selected = ref<string[]>([])
const entityNames = computed(() => [...new Set(employees.value.map(e => e.entityName).filter(Boolean))].sort((a, b) => a.localeCompare(b)))
const shown = computed(() => {
  const q = search.value.trim().toLowerCase()
  return employees.value
    .filter(e => !entity.value || e.entityName === entity.value)
    .filter(e => !q || e.name.toLowerCase().includes(q) || e.code.toLowerCase().includes(q))
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
  entryType: 'travail_hors_site' as TimeEntryType, from: todayIso(), to: todayIso(), weekdays: [1, 2, 3, 4, 5],
  includeHolidays: false, start: '', end: '', comments: '',
})
const needsTimes = computed(() => form.entryType !== 'panier' && form.entryType !== 'permanence')
const duration = computed(() => hoursBetween(form.start, form.end))

// ── Lignes ──
interface Row {
  key: number
  employeeId: string
  name: string
  code: string
  date: string
  start: string
  end: string
  onConflict: '' | 'skip' | 'replace'
  check: TimeEntryLineResult | null
}
let nextKey = 0
const rows = ref<Row[]>([])
const leftOut = ref<string[]>([])
const outcome = ref<{ created: number; notCreated: { name: string; date: string; reason: string }[] } | null>(null)
const saving = ref(false)

const pending = computed(() => rows.value.some(r => !r.check))
const toCreate = computed(() => rows.value.filter(r => r.check?.action === 'create' || r.check?.action === 'replace').length)
const conflicts = computed(() => rows.value.filter(r => r.check?.action === 'conflict').length)

const createLabel = computed(() => {
  if (outcome.value) return 'Fermer'
  if (!rows.value.length) return 'Préparer les lignes'
  return pending.value ? 'Vérifier les lignes' : `Créer ${toCreate.value} saisie(s)`
})
const createDisabled = computed(() => !outcome.value && rows.value.length > 0 && !pending.value && toCreate.value === 0)

// Toute modification d'une ligne (ou son retrait) perime le controle de l'ensemble :
// une ligne peut en chevaucher une autre.
const signature = computed(() => JSON.stringify(rows.value.map(r => [r.key, r.date, r.start, r.end, r.onConflict])))
watch(signature, () => { rows.value.forEach(r => (r.check = null)); error.value = '' })

function choose(row: Row, value: string) {
  row.onConflict = value as Row['onConflict']
  // Le choix se verifie tout de suite : c'est un clic, pas une saisie en cours.
  void verify()
}

// ── Lignes regroupees par employe ──
const groups = computed(() => {
  const out = new Map<string, { employeeId: string; name: string; code: string; rows: Row[] }>()
  for (const r of rows.value) {
    let g = out.get(r.employeeId)
    if (!g) out.set(r.employeeId, (g = { employeeId: r.employeeId, name: r.name, code: r.code, rows: [] }))
    g.rows.push(r)
  }
  return [...out.values()]
})

// Heures saisies en tete de bloc, appliquees a la demande.
const drafts = reactive<Record<string, { start: string; end: string }>>({})
const draftOf = (employeeId: string) => (drafts[employeeId] ??= { start: form.start, end: form.end })
const canApply = (employeeId: string) => hoursBetween(draftOf(employeeId).start, draftOf(employeeId).end) > 0

// Une fois par journee : les secondes periodes d'un jour ne sont pas touchees.
function applyTo(employeeId: string) {
  const { start, end } = draftOf(employeeId)
  const done = new Set<string>()
  for (const r of rows.value) {
    if (r.employeeId !== employeeId || done.has(r.date)) continue
    done.add(r.date)
    Object.assign(r, { start, end, onConflict: '' })
  }
}

// Insere apres la ligne donnee.
function insertAfter(row: Row, changes: Partial<Row>) {
  rows.value.splice(rows.value.indexOf(row) + 1, 0, { ...row, ...changes, key: ++nextKey, onConflict: '', check: null })
}
const addPeriod = (row: Row) => insertAfter(row, { start: '', end: '' })

function addDay(employeeId: string) {
  const own = rows.value.filter(r => r.employeeId === employeeId)
  const last = own[own.length - 1]!
  const next = new Date(`${own.map(r => r.date).sort().pop()}T00:00:00Z`)
  next.setUTCDate(next.getUTCDate() + 1)
  const { start, end } = draftOf(employeeId)
  insertAfter(last, { date: next.toISOString().slice(0, 10), start, end })
}

function removeRow(row: Row) {
  rows.value.splice(rows.value.indexOf(row), 1)
}

function backToCriteria() {
  rows.value = []
  leftOut.value = []
  error.value = ''
}

function buildPayload(): TimeEntryBatchPayload | string {
  if (!selected.value.length) return 'Choisissez au moins un employé.'
  if (selected.value.length > 200) return 'Pas plus de 200 employés à la fois.'
  if (!form.from || !form.to) return 'Indiquez la période.'
  if (form.to < form.from) return 'La date de fin doit être après la date de début.'
  if (!form.weekdays.length) return 'Choisissez au moins un jour de la semaine.'
  const payload: TimeEntryBatchPayload = {
    EmployeeIds: [...selected.value], From: form.from, To: form.to, Weekdays: [...form.weekdays],
    IncludeHolidays: form.includeHolidays, EntryType: form.entryType, Comments: form.comments || undefined, DryRun: true,
  }
  if (!needsTimes.value) return payload
  if (!form.start || !form.end) return "Renseignez l'heure de début et l'heure de fin."
  if (duration.value <= 0) return "L'heure de fin doit être après l'heure de début."
  return { ...payload, StartTime: form.start, EndTime: form.end }
}

async function prepare() {
  const payload = buildPayload()
  if (typeof payload === 'string') { error.value = payload; return }
  const report = await store.createBatch(payload)
  const byId = new Map(employees.value.map(e => [e.id.toLowerCase(), e]))
  leftOut.value = report.employees.flatMap(e => e.skipped.map(s => `${e.name} (${s.reason.toLowerCase()} : ${s.dates.map(shortDate).slice(0, 4).join(', ')}${s.dates.length > 4 ? '...' : ''})`))
  for (const key of Object.keys(drafts)) delete drafts[key]
  rows.value = report.lines.map((l) => {
    const employee = byId.get(l.employeeId.toLowerCase())
    return {
      key: ++nextKey, employeeId: l.employeeId, name: employee?.name ?? '', code: employee?.code ?? '', date: l.date,
      start: payload.StartTime ?? '', end: payload.EndTime ?? '', onConflict: '', check: null,
    }
  })
  if (!rows.value.length) { error.value = `Aucune journée à créer. ${leftOut.value.join(' ; ')}`; return }
  await check()
}

function toLine(r: Row): TimeEntryLine {
  const line: TimeEntryLine = { EmployeeId: r.employeeId, Date: r.date, EntryType: form.entryType, Comments: form.comments || undefined }
  if (needsTimes.value) {
    if (r.start) line.StartTime = r.start
    if (r.end) line.EndTime = r.end
  }
  if (r.onConflict) line.OnConflict = r.onConflict
  return line
}

async function check() {
  const sent = signature.value
  const results = await store.sendEntryLines(rows.value.map(toLine), { dryRun: true, source: 'Manual' })
  // Lignes modifiees pendant le controle : resultat perime, ignore.
  if (sent !== signature.value) return
  results.forEach((res) => { const row = rows.value[res.index]; if (row) row.check = res })
}

async function verify() {
  if (saving.value) return
  saving.value = true
  error.value = ''
  try { await check() } catch (e) { error.value = getApiErrorMessage(e, 'Contrôle impossible') } finally { saving.value = false }
}

async function create() {
  toast.loading('Enregistrement...')
  const sent = [...rows.value]
  const results = await store.sendEntryLines(sent.map(toLine), { dryRun: false, source: 'Manual' })
  emit('saved')
  const created = results.filter(r => r.action === 'create' || r.action === 'replace').length
  const notCreated = results
    .filter(r => r.action !== 'create' && r.action !== 'replace')
    .map(r => ({ name: sent[r.index]!.name, date: sent[r.index]!.date, reason: r.message ?? 'Non créée' }))
  toast.success(`${created} saisie(s) créée(s)`)
  if (!notCreated.length) { emit('close'); return }
  outcome.value = { created, notCreated }
}

async function submit() {
  if (saving.value) return
  if (outcome.value) { close(); return }
  error.value = ''
  const step = !rows.value.length ? prepare : pending.value ? check : create
  saving.value = true
  try {
    await step()
  } catch (e) {
    error.value = getApiErrorMessage(e, step === create ? 'Enregistrement impossible' : 'Contrôle impossible')
    if (step === create) toast.error(error.value)
  } finally {
    saving.value = false
  }
}

// La fenetre ne se ferme pas pendant l'enregistrement.
function close() { if (!saving.value) emit('close') }

const TONES: Record<TimeEntryLineResult['action'], string> = {
  create: 'text-success', replace: 'text-info', skip: 'text-muted-foreground', conflict: 'text-warning', error: 'text-danger',
}
function describe(r: TimeEntryLineResult): string {
  const base = r.action === 'create' ? 'Prête' : r.action === 'replace' ? 'Remplace la saisie existante' : r.message ?? ''
  return [base, ...r.warnings].filter(Boolean).join(' ; ')
}
function shortDate(date: string): string { return `${date.slice(8, 10)}/${date.slice(5, 7)}` }
</script>
