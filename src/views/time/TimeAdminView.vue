<template>
  <div class="px-7 py-6 max-w-[1100px] mx-auto w-full">
    <div :class="L.pageHeader">
      <div>
        <div :class="L.pageTitle">Temps de travail</div>
        <div :class="L.pageSub">Import de la pointeuse, saisies, heures supplémentaires, export Sage et réglages.</div>
      </div>
    </div>

    <div class="flex gap-1 border-b border-border mb-4">
      <button
        v-for="t in TABS" :key="t.key"
        class="px-3.5 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors"
        :class="tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'"
        @click="selectTab(t.key)"
      >{{ t.label }}</button>
    </div>

    <!-- ─────────── Import de la pointeuse ─────────── -->
    <section v-if="tab === 'import'" class="flex flex-col gap-4">
      <div :class="L.card">
        <div :class="L.cardHeader"><div :class="L.cardTitle"><FolderOpen class="w-4 h-4" /> Dossier surveillé</div></div>
        <div v-if="cfg" class="flex items-end gap-3 flex-wrap">
          <div :class="cls.field" class="flex-1 min-w-[260px]">
            <label :class="cls.fieldLabel">Dossier des exports Morpho</label>
            <input v-model="cfg.folderPath" type="text" placeholder="D:\morpho\exports" :class="cls.fieldInput" />
          </div>
          <div :class="cls.field">
            <label :class="cls.fieldLabel">Planification (cron)</label>
            <input v-model="cfg.cronSchedule" type="text" placeholder="0 6 * * *" :class="cls.fieldInput" class="!w-40" />
          </div>
          <label class="flex items-center gap-2 text-[13px] pb-2">
            <input v-model="cfg.isScheduleActive" type="checkbox" /> Import planifié actif
          </label>
          <button :class="L.btnOutline" @click="saveConfig">Enregistrer</button>
        </div>
      </div>

      <div :class="L.card">
        <div :class="L.cardHeader"><div :class="L.cardTitle"><Upload class="w-4 h-4" /> Importer</div></div>
        <div class="flex items-center gap-3 flex-wrap">
          <button :class="L.btnPrimary" :disabled="busy" @click="importFolder"><FolderOpen class="w-4 h-4" /> Importer le dossier</button>
          <label :class="L.btnOutline" class="cursor-pointer inline-flex items-center gap-1.5">
            <Upload class="w-4 h-4" /> Envoyer un fichier .xlsx
            <input type="file" accept=".xlsx" class="hidden" @change="importFile" />
          </label>
          <button :class="L.btnOutline" :disabled="busy" @click="rematch">Rattacher les pointages sans employé</button>
        </div>
        <p v-if="summaryText" class="text-[13px] mt-3" :class="summaryTone">{{ summaryText }}</p>
      </div>

      <div :class="L.tableCard">
        <table :class="L.table">
          <thead>
            <tr><th :class="L.th">Fichier</th><th :class="L.th">Date</th><th :class="L.th">Origine</th><th :class="L.th">Statut</th><th :class="L.th">Lignes</th><th :class="L.th">Anomalies</th></tr>
          </thead>
          <tbody>
            <tr v-if="store.imports.length === 0"><td :class="L.td" colspan="6" class="text-center text-muted-foreground">Aucun import.</td></tr>
            <tr v-for="i in store.imports" :key="i.id" :class="L.rowHover">
              <td :class="L.td" class="font-medium">{{ i.fileName }}</td>
              <td :class="L.td" class="whitespace-nowrap">{{ new Date(i.importDate).toLocaleString('fr-FR') }}</td>
              <td :class="L.td">{{ i.triggeredBy === 'schedule' ? 'Planifié' : 'Manuel' }}</td>
              <td :class="L.td">
                <span class="text-[11px] font-medium px-2 py-0.5 rounded-full" :class="i.status === 'Completed' ? 'bg-success-bg text-success' : i.status === 'Failed' ? 'bg-danger-bg text-danger' : 'bg-warning-bg text-warning'">{{ IMPORT_STATUS[i.status] ?? i.status }}</span>
              </td>
              <td :class="L.td">{{ i.processedRecords }} / {{ i.totalRecords }}</td>
              <td :class="L.td" class="text-muted-foreground" :title="i.errorDetails ?? ''">{{ i.errorCount > 0 ? `${i.errorCount}` : '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- ─────────── Saisies de tous ─────────── -->
    <section v-if="tab === 'entries'">
      <div class="flex items-end gap-3 mb-3">
        <div :class="cls.field">
          <label :class="cls.fieldLabel">Statut</label>
          <select v-model="statusFilter" :class="cls.fieldSelect" @change="store.fetchAll(statusFilter)">
            <option value="">Tous</option>
            <option v-for="(label, key) in ENTRY_STATUS_LABELS" :key="key" :value="key">{{ label }}</option>
          </select>
        </div>
      </div>
      <div :class="L.tableCard">
        <table :class="L.table">
          <thead>
            <tr><th :class="L.th">Employé</th><th :class="L.th">Date</th><th :class="L.th">Type</th><th :class="L.th">Heures</th><th :class="L.th">Statut</th><th :class="L.th">Commentaire</th></tr>
          </thead>
          <tbody>
            <tr v-if="store.allEntries.length === 0"><td :class="L.td" colspan="6" class="text-center text-muted-foreground">Aucune saisie.</td></tr>
            <tr v-for="e in store.allEntries" :key="e.id" :class="L.rowHover">
              <td :class="L.td" class="font-medium">{{ e.employeeName }} <span class="text-muted-foreground font-normal">{{ e.employeeNumber }}</span></td>
              <td :class="L.td" class="whitespace-nowrap">{{ formatDate(e.date) }}</td>
              <td :class="L.td">{{ e.entryType ? ENTRY_TYPE_LABELS[e.entryType] : '-' }}</td>
              <td :class="L.td">{{ e.hours }}</td>
              <td :class="L.td">{{ ENTRY_STATUS_LABELS[e.status] }}</td>
              <td :class="L.td" class="text-muted-foreground">{{ e.rejectionReason || e.comments || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- ─────────── Heures supplementaires et export ─────────── -->
    <section v-if="tab === 'overtime'" class="flex flex-col gap-4">
      <div :class="L.card">
        <div class="flex items-end gap-3 flex-wrap">
          <div :class="cls.field"><label :class="cls.fieldLabel">Du</label><input v-model="from" type="date" :class="cls.fieldInput" /></div>
          <div :class="cls.field"><label :class="cls.fieldLabel">Au</label><input v-model="to" type="date" :class="cls.fieldInput" /></div>
          <div :class="cls.field">
            <label :class="cls.fieldLabel">Méthode</label>
            <select v-model="method" :class="cls.fieldSelect">
              <option value="daily">Dépassement de l'horaire du jour</option>
              <option value="weekly">Cumul hebdomadaire au-delà de 40 h</option>
            </select>
          </div>
          <button :class="L.btnPrimary" :disabled="busy" @click="calculate"><Calculator class="w-4 h-4" /> Calculer</button>
          <button :class="L.btnOutline" :disabled="busy" @click="loadReport"><Search class="w-4 h-4" /> Afficher le rapport</button>
          <button :class="L.btnOutline" :disabled="busy" @click="downloadSage"><FileSpreadsheet class="w-4 h-4" /> Export Sage (.xlsx)</button>
        </div>
        <p v-if="calcText" class="text-[13px] mt-3 text-muted-foreground">{{ calcText }}</p>
      </div>

      <div v-if="report" :class="L.tableCard">
        <table :class="L.table">
          <thead>
            <tr><th :class="L.th">Matricule</th><th :class="L.th">Employé</th><th v-for="c in reportCodes" :key="c" :class="L.th">{{ c }}</th></tr>
          </thead>
          <tbody>
            <tr v-if="report.employees.length === 0"><td :class="L.td" :colspan="2 + reportCodes.length" class="text-center text-muted-foreground">Aucune ligne calculée sur cette période.</td></tr>
            <tr v-for="e in report.employees" :key="e.employeeId" :class="L.rowHover">
              <td :class="L.td">{{ e.employeeNumber }}</td>
              <td :class="L.td" class="font-medium">{{ e.name }}</td>
              <td v-for="c in reportCodes" :key="c" :class="L.td">{{ e.totalsByCode[c] ?? '' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- ─────────── Reglages ─────────── -->
    <section v-if="tab === 'settings'" class="flex flex-col gap-4">
      <div :class="L.card">
        <div :class="L.cardHeader"><div :class="L.cardTitle"><Settings class="w-4 h-4" /> Paramètres du calcul</div></div>
        <div class="flex flex-col gap-2">
          <div v-for="s in editableSettings" :key="s.key" class="flex items-center gap-3">
            <label class="text-[13px] flex-1 min-w-0">{{ s.label }}</label>
            <input v-model.number="s.value" type="number" min="0" step="0.5" :class="cls.fieldInput" class="!w-24 shrink-0" />
            <button :class="L.btnOutline" @click="saveSetting(s)">Enregistrer</button>
          </div>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <div :class="L.card">
          <div :class="L.cardTitle" class="mb-2">Codes de paie</div>
          <table :class="L.table">
            <thead><tr><th :class="L.th">Code</th><th :class="L.th">Type</th><th :class="L.th">Code Sage</th></tr></thead>
            <tbody>
              <tr v-for="c in store.codes" :key="c.code"><td :class="L.td" class="font-medium">{{ c.code }}</td><td :class="L.td">{{ c.type }}</td><td :class="L.td">{{ c.sageTypeCode ?? '-' }}</td></tr>
            </tbody>
          </table>
        </div>
        <div :class="L.card">
          <div :class="L.cardTitle" class="mb-2">Prime de permanence</div>
          <table :class="L.table">
            <thead><tr><th :class="L.th">Jour</th><th :class="L.th">Montant</th></tr></thead>
            <tbody>
              <tr v-for="r in store.rates" :key="r.dayType"><td :class="L.td">{{ RATE_LABELS[r.dayType] ?? r.dayType }}</td><td :class="L.td">{{ r.amount }}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
/**
 * Administration du module Temps de travail (TEMPS_ACCES) : import de la
 * pointeuse Morpho, saisies de tous, calcul des heures supplementaires et
 * export Sage, reglages du calcul.
 */
import { ref, computed, onMounted } from 'vue'
import { FolderOpen, Upload, Calculator, Search, FileSpreadsheet, Settings } from 'lucide-vue-next'
import * as cls from '../../lib/formClasses'
import * as L from '../../lib/listClasses'
import { formatDate, todayIso } from '../../lib/date'
import { getApiErrorMessage } from '../../lib/api'
import { useToastStore } from '../../stores/toast'
import {
  useTimeStore, ENTRY_TYPE_LABELS, ENTRY_STATUS_LABELS,
  type MorphoConfig, type MorphoImportSummary, type OvertimeReport, type TimeSetting,
} from '../../stores/time'

const store = useTimeStore()
const toast = useToastStore()

const TABS = [
  { key: 'import', label: 'Import pointeuse' },
  { key: 'entries', label: 'Saisies' },
  { key: 'overtime', label: 'Heures supplémentaires' },
  { key: 'settings', label: 'Réglages' },
] as const
type TabKey = (typeof TABS)[number]['key']
const tab = ref<TabKey>('import')

const IMPORT_STATUS: Record<string, string> = { Pending: 'En attente', Processing: 'En cours', Completed: 'Terminé', Failed: 'Échoué' }
const RATE_LABELS: Record<string, string> = { OUVRABLE: 'Jour ouvrable', SAMEDI: 'Samedi', DIMANCHE_FERIE: 'Dimanche ou férié' }
// Les corrections optionnelles sont des interrupteurs 0/1 : affichees comme les autres parametres.
const editableSettings = ref<TimeSetting[]>([])

const busy = ref(false)
const cfg = ref<MorphoConfig | null>(null)
const statusFilter = ref('')
const summaryText = ref('')
const summaryTone = ref('text-muted-foreground')

const today = todayIso()
const from = ref(`${today.slice(0, 8)}01`)
const to = ref(today)
const method = ref<'daily' | 'weekly'>('daily')
const report = ref<OvertimeReport | null>(null)
const calcText = ref('')
const reportCodes = computed(() => {
  const codes = new Set<string>()
  for (const e of report.value?.employees ?? []) for (const c of Object.keys(e.totalsByCode)) codes.add(c)
  return [...codes].sort()
})

async function run(label: string, action: () => Promise<unknown>, fallback: string) {
  busy.value = true
  toast.loading(label)
  try {
    const result = await action()
    toast.success('Effectué avec succès')
    return { ok: true as const, result }
  } catch (e) {
    toast.error(getApiErrorMessage(e, fallback))
    return { ok: false as const, result: undefined }
  } finally {
    busy.value = false
  }
}

async function selectTab(key: TabKey) {
  tab.value = key
  if (key === 'import') await Promise.all([store.fetchConfig().then(() => (cfg.value = store.config && { ...store.config })), store.fetchImports()])
  if (key === 'entries') await store.fetchAll(statusFilter.value)
  if (key === 'settings') {
    await store.fetchSettings()
    editableSettings.value = store.settings.map((s) => ({ ...s }))
  }
}
onMounted(() => selectTab('import'))

async function saveConfig() {
  if (cfg.value) await run('Enregistrement...', () => store.saveConfig(cfg.value!), 'Enregistrement impossible')
}

function showSummary(s: MorphoImportSummary) {
  summaryText.value =
    `${s.imported} fichier(s) importé(s), ${s.skipped} ignoré(s), ${s.failed} échoué(s). ` +
    (s.unmatchedRows > 0 ? `${s.unmatchedRows} ligne(s) sans employé correspondant (matricule inconnu).` : 'Tous les pointages sont rattachés à un employé.')
  summaryTone.value = s.failed > 0 || s.unmatchedRows > 0 ? 'text-warning' : 'text-success'
}

async function importFolder() {
  const r = await run('Import du dossier...', () => store.importFolder(), 'Import impossible')
  if (r.ok) showSummary(r.result as MorphoImportSummary)
}
async function importFile(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const r = await run('Import du fichier...', () => store.importFile(file), 'Import impossible')
  if (r.ok) showSummary(r.result as MorphoImportSummary)
  input.value = ''
}
async function rematch() {
  const r = await run('Rattachement...', () => store.rematch(), 'Rattachement impossible')
  if (r.ok) {
    const res = r.result as { matched: number; stillUnmatched: number }
    summaryText.value = `${res.matched} pointage(s) rattaché(s), ${res.stillUnmatched} toujours sans employé.`
    summaryTone.value = res.stillUnmatched > 0 ? 'text-warning' : 'text-success'
  }
}

async function calculate() {
  const r = await run('Calcul en cours...', () => store.calculate(from.value, to.value, method.value), 'Calcul impossible')
  if (r.ok) {
    const res = r.result as Awaited<ReturnType<typeof store.calculate>>
    calcText.value =
      `${res.hours.calculated} jour(s) calculé(s) (${res.hours.skipped} ignoré(s)), ` +
      `${res.overtime.calculated} ligne(s) de paie, ${res.overtime.excludedCadres} cadre(s) exclu(s).`
    await loadReport()
  }
}
async function loadReport() {
  try {
    report.value = await store.fetchReport(from.value, to.value)
  } catch (e) {
    toast.error(getApiErrorMessage(e, 'Chargement du rapport impossible'))
  }
}
async function downloadSage() {
  await run('Génération de l\'export...', () => store.downloadSageXlsx(from.value, to.value), 'Export impossible')
}

async function saveSetting(s: TimeSetting) {
  await run('Enregistrement...', () => store.saveSetting(s.key, s.value), 'Enregistrement impossible')
}
</script>
