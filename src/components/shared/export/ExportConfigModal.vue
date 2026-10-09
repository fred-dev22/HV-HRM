<script setup lang="ts">
/**
 * Modale d'export configurable : l'utilisateur choisit les colonnes, leur
 * ordre et leur titre, peut ajouter une colonne a valeur fixe (ex : un code
 * Sage), choisit Excel ou CSV, voit un apercu en direct, puis exporte. Les
 * reglages peuvent etre enregistres comme modele reutilisable.
 *
 * Generique : ne connait aucune logique metier. La page fournit les colonnes
 * possibles (`sources`), les lignes deja filtrees (`rows`) et, au besoin, ses
 * propres filtres via le slot `filters`.
 */
import { ref, computed, watch } from 'vue'
import { ArrowLeft, X, ArrowUp, ArrowDown, Plus, Trash2, Download, Save, Loader2 } from 'lucide-vue-next'
import * as cls from '../../../lib/formClasses'
import { useToastStore } from '../../../stores/toast'
import {
  buildTable, buildCsv, buildXlsx, csvBlob, downloadBlob,
  type ExportColumnConfig, type ExportSource, type ExportFormat, type CsvOptions,
} from '../../../lib/exportFile'
import {
  listTemplates, saveTemplate, deleteTemplate, loadLastSettings, saveLastSettings,
  type ExportSettings, type ExportTemplate,
} from '../../../lib/exportTemplates'

const props = defineProps<{
  open: boolean
  title: string
  /** Cle de stockage des modeles/derniers reglages (une par page). */
  scope: string
  fileBaseName: string
  sources: ExportSource[]
  rows: any[]
  defaultColumns: ExportColumnConfig[]
  /** Modeles livres avec l'application (non supprimables). */
  presets?: ExportTemplate[]
}>()
const emit = defineEmits<{ close: [] }>()

const toast = useToastStore()

const columns = ref<ExportColumnConfig[]>([])
const format = ref<ExportFormat>('xlsx')
const includeHeader = ref(true)
const csv = ref<CsvOptions>({ delimiter: ';', decimal: ',' })
const exporting = ref(false)

const savedTemplates = ref<ExportTemplate[]>([])
const selectedTemplateId = ref('')
const showSave = ref(false)
const templateName = ref('')

const showFixed = ref(false)
const fixedHeader = ref('')
const fixedValue = ref('')

let uidCounter = 0
const newUid = () => `col-${Date.now().toString(36)}-${uidCounter++}`

function cloneColumns(list: ExportColumnConfig[]): ExportColumnConfig[] {
  return list.map(c => ({ ...c, uid: newUid() }))
}

// Une donnee qui n'existe plus (type de conge supprime...) ne doit pas casser
// un modele ancien : on l'ecarte.
function validColumns(list: ExportColumnConfig[]): ExportColumnConfig[] {
  const keys = new Set(props.sources.map(s => s.key))
  return list.filter(c => c.sourceKey === null || keys.has(c.sourceKey))
}

function apply(settings: ExportSettings) {
  const cols = validColumns(settings.columns)
  columns.value = cloneColumns(cols.length ? cols : props.defaultColumns)
  format.value = settings.format
  includeHeader.value = settings.includeHeader
  csv.value = { ...settings.csv }
}

function currentSettings(): ExportSettings {
  return {
    columns: columns.value.map(c => ({ ...c })),
    format: format.value,
    includeHeader: includeHeader.value,
    csv: { ...csv.value },
  }
}

const DEFAULT_SETTINGS = (): ExportSettings => ({
  columns: props.defaultColumns,
  format: 'xlsx',
  includeHeader: true,
  csv: { delimiter: ';', decimal: ',' },
})

watch(() => props.open, (isOpen) => {
  if (!isOpen) return
  savedTemplates.value = listTemplates(props.scope)
  selectedTemplateId.value = ''
  showSave.value = false
  showFixed.value = false
  apply(loadLastSettings(props.scope) ?? DEFAULT_SETTINGS())
}, { immediate: true })

/* ── Modeles ─────────────────────────────────────────────────── */
const allTemplates = computed(() => [...(props.presets ?? []), ...savedTemplates.value])
const selectedIsSaved = computed(() => savedTemplates.value.some(t => t.id === selectedTemplateId.value))

function onTemplateChange() {
  const tpl = allTemplates.value.find(t => t.id === selectedTemplateId.value)
  if (tpl) apply(tpl)
}

function confirmSaveTemplate() {
  const name = templateName.value.trim()
  if (!name) return
  const tpl = saveTemplate(props.scope, name, currentSettings())
  savedTemplates.value = listTemplates(props.scope)
  selectedTemplateId.value = tpl.id
  templateName.value = ''
  showSave.value = false
  toast.success(`Modèle « ${tpl.name} » enregistré`)
  toast.hideAfter(2500)
}

function removeTemplate() {
  deleteTemplate(props.scope, selectedTemplateId.value)
  savedTemplates.value = listTemplates(props.scope)
  selectedTemplateId.value = ''
}

/* ── Colonnes ────────────────────────────────────────────────── */
const sourceByKey = computed(() => new Map(props.sources.map(s => [s.key, s])))
const availableSources = computed(() => {
  const used = new Set(columns.value.map(c => c.sourceKey))
  return props.sources.filter(s => !used.has(s.key))
})
const addKey = ref('')

function addSource() {
  const src = sourceByKey.value.get(addKey.value)
  if (!src) return
  columns.value.push({ uid: newUid(), sourceKey: src.key, header: src.label })
  addKey.value = ''
}

function addFixed() {
  const header = fixedHeader.value.trim()
  if (!header) return
  columns.value.push({ uid: newUid(), sourceKey: null, header, fixedValue: fixedValue.value })
  fixedHeader.value = ''
  fixedValue.value = ''
  showFixed.value = false
}

function move(index: number, delta: number) {
  const target = index + delta
  if (target < 0 || target >= columns.value.length) return
  const next = [...columns.value]
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item!)
  columns.value = next
}

function remove(index: number) {
  columns.value = columns.value.filter((_, i) => i !== index)
}

function resetToDefault() {
  apply(DEFAULT_SETTINGS())
  selectedTemplateId.value = ''
}

/* ── Apercu + export ─────────────────────────────────────────── */
const PREVIEW_ROWS = 5
const preview = computed(() => buildTable(columns.value, props.sources, props.rows.slice(0, PREVIEW_ROWS)))
const canExport = computed(() => columns.value.length > 0 && props.rows.length > 0 && !exporting.value)

function fileName(ext: string) {
  const day = new Date().toISOString().slice(0, 10)
  return `${props.fileBaseName}-${day}.${ext}`
}

async function doExport() {
  if (!canExport.value) return
  exporting.value = true
  try {
    const table = buildTable(columns.value, props.sources, props.rows)
    if (format.value === 'xlsx') {
      downloadBlob(await buildXlsx(table, includeHeader.value, props.title), fileName('xlsx'))
    } else {
      downloadBlob(csvBlob(buildCsv(table, csv.value, includeHeader.value)), fileName('csv'))
    }
    saveLastSettings(props.scope, currentSettings())
    toast.success(`Export terminé : ${props.rows.length} ligne(s)`)
    toast.hideAfter(3000)
    emit('close')
  } catch {
    toast.error("L'export a échoué. Veuillez réessayer.")
    toast.hideAfter(4000)
  } finally {
    exporting.value = false
  }
}

const labelFor = (c: ExportColumnConfig) =>
  c.sourceKey === null ? `Valeur fixe : « ${c.fixedValue ?? ''} »` : (sourceByKey.value.get(c.sourceKey)?.label ?? '')
</script>

<template>
  <Teleport to="#below-topbar" defer>
    <div v-if="open" class="absolute inset-0 z-50 flex">
      <div class="absolute inset-0 bg-black/60 backdrop-blur-md" @click="emit('close')"></div>

      <div class="relative z-10 flex flex-col w-full h-full bg-card overflow-hidden mx-4 lg:mx-auto lg:max-w-[980px] shadow-[0_8px_32px_rgba(0,0,0,0.16)]">
        <!-- Bannière -->
        <div class="bg-primary text-primary-foreground px-6 py-2 flex items-center justify-between text-sm shrink-0">
          <div class="flex items-center gap-2">
            <button class="p-1 hover:bg-white/20 rounded transition" title="Fermer" @click="emit('close')"><ArrowLeft class="w-5 h-5" /></button>
            <span>Exporter · {{ title }}</span>
          </div>
          <span class="flex items-center gap-1 text-yellow-200"><Download class="w-4 h-4" /> Export</span>
        </div>

        <!-- Titre + actions -->
        <div class="bg-card border-b border-border px-6 py-4 shrink-0 flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-semibold text-card-foreground">Exporter {{ title.toLowerCase() }}</h1>
            <p class="text-[13px] text-muted-foreground mt-0.5">Choisissez les colonnes, leur ordre et le format du fichier.</p>
          </div>
          <div class="flex items-center gap-2">
            <button :disabled="!canExport" class="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-primary-foreground bg-primary rounded hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer" @click="doExport">
              <Loader2 v-if="exporting" class="w-4 h-4 animate-spin" /><Download v-else class="w-4 h-4" />
              Exporter {{ rows.length }} ligne(s)
            </button>
            <button class="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-card-foreground border border-border rounded hover:bg-background transition cursor-pointer" @click="emit('close')"><X class="w-4 h-4" /> Annuler</button>
          </div>
        </div>

        <div class="flex-1 overflow-auto px-6 py-5 flex flex-col gap-5">
          <!-- Modèles -->
          <section class="flex flex-wrap items-end gap-3">
            <div :class="cls.field" class="min-w-[240px]">
              <label :class="cls.fieldLabel">Modèle d'export</label>
              <select v-model="selectedTemplateId" :class="cls.fieldSelect" @change="onTemplateChange">
                <option value="">Réglages actuels</option>
                <optgroup v-if="presets?.length" label="Modèles prédéfinis">
                  <option v-for="t in presets" :key="t.id" :value="t.id">{{ t.name }}</option>
                </optgroup>
                <optgroup v-if="savedTemplates.length" label="Mes modèles">
                  <option v-for="t in savedTemplates" :key="t.id" :value="t.id">{{ t.name }}</option>
                </optgroup>
              </select>
            </div>
            <button v-if="!showSave" :class="cls.btnOutline" @click="showSave = true"><Save class="w-4 h-4" /> Enregistrer comme modèle</button>
            <div v-else class="flex items-end gap-2">
              <div :class="cls.field">
                <label :class="cls.fieldLabel">Nom du modèle</label>
                <input v-model="templateName" :class="cls.fieldInput" placeholder="ex : Sage paie mensuel" @keyup.enter="confirmSaveTemplate" />
              </div>
              <button :class="cls.btnPrimary" :disabled="!templateName.trim()" @click="confirmSaveTemplate">Enregistrer</button>
              <button :class="cls.btnOutline" @click="showSave = false">Annuler</button>
            </div>
            <button v-if="selectedIsSaved" :class="cls.btnOutline" @click="removeTemplate"><Trash2 class="w-4 h-4" /> Supprimer ce modèle</button>
            <button class="text-xs text-muted-foreground hover:text-primary cursor-pointer ml-auto" @click="resetToDefault">Rétablir les réglages par défaut</button>
          </section>

          <div class="grid grid-cols-[1.4fr_1fr] gap-5 max-[900px]:grid-cols-1">
            <!-- Colonnes -->
            <section class="border border-border rounded-lg p-4 flex flex-col gap-3">
              <h2 class="text-sm font-semibold text-foreground">Colonnes du fichier ({{ columns.length }})</h2>
              <p v-if="!columns.length" class="text-[13px] text-muted-foreground">Aucune colonne : ajoutez-en ci-dessous.</p>
              <ul class="flex flex-col gap-2">
                <li v-for="(c, i) in columns" :key="c.uid" class="flex items-center gap-2 bg-background border border-border rounded-md px-2 py-1.5">
                  <div class="flex flex-col">
                    <button class="p-0.5 text-muted-foreground hover:text-primary disabled:opacity-30 cursor-pointer" :disabled="i === 0" title="Monter" @click="move(i, -1)"><ArrowUp class="w-3.5 h-3.5" /></button>
                    <button class="p-0.5 text-muted-foreground hover:text-primary disabled:opacity-30 cursor-pointer" :disabled="i === columns.length - 1" title="Descendre" @click="move(i, 1)"><ArrowDown class="w-3.5 h-3.5" /></button>
                  </div>
                  <div class="flex-1 min-w-0">
                    <input v-model="c.header" :class="cls.fieldInput" :placeholder="labelFor(c)" aria-label="Titre de la colonne" />
                    <div class="text-[11px] text-muted-foreground mt-0.5 truncate">{{ labelFor(c) }}</div>
                  </div>
                  <button class="p-1 text-muted-foreground hover:text-danger cursor-pointer" title="Retirer cette colonne" @click="remove(i)"><Trash2 class="w-4 h-4" /></button>
                </li>
              </ul>

              <div class="flex items-end gap-2 pt-1">
                <div :class="cls.field" class="flex-1">
                  <label :class="cls.fieldLabel">Ajouter une donnée</label>
                  <select v-model="addKey" :class="cls.fieldSelect" @change="addSource">
                    <option value="">Choisir une colonne…</option>
                    <option v-for="s in availableSources" :key="s.key" :value="s.key">{{ s.label }}</option>
                  </select>
                </div>
                <button :class="cls.btnOutline" @click="showFixed = !showFixed"><Plus class="w-4 h-4" /> Valeur fixe</button>
              </div>

              <div v-if="showFixed" class="flex items-end gap-2 bg-background border border-border rounded-md p-3">
                <div :class="cls.field" class="flex-1">
                  <label :class="cls.fieldLabel">Titre de la colonne</label>
                  <input v-model="fixedHeader" :class="cls.fieldInput" placeholder="ex : Code" />
                </div>
                <div :class="cls.field" class="flex-1">
                  <label :class="cls.fieldLabel">Valeur (identique partout)</label>
                  <input v-model="fixedValue" :class="cls.fieldInput" placeholder="ex : 0" @keyup.enter="addFixed" />
                </div>
                <button :class="cls.btnPrimary" :disabled="!fixedHeader.trim()" @click="addFixed">Ajouter</button>
              </div>
            </section>

            <!-- Filtres + format -->
            <section class="flex flex-col gap-4">
              <div class="border border-border rounded-lg p-4 flex flex-col gap-3">
                <h2 class="text-sm font-semibold text-foreground">Données à exporter</h2>
                <slot name="filters" />
                <p class="text-[12px] text-muted-foreground">{{ rows.length }} ligne(s) seront exportées.</p>
              </div>

              <div class="border border-border rounded-lg p-4 flex flex-col gap-3">
                <h2 class="text-sm font-semibold text-foreground">Format du fichier</h2>
                <div :class="cls.field">
                  <label :class="cls.fieldLabel">Type de fichier</label>
                  <select v-model="format" :class="cls.fieldSelect">
                    <option value="xlsx">Excel (.xlsx)</option>
                    <option value="csv">CSV (.csv)</option>
                  </select>
                </div>
                <template v-if="format === 'csv'">
                  <div :class="cls.field">
                    <label :class="cls.fieldLabel">Séparateur de colonnes</label>
                    <select v-model="csv.delimiter" :class="cls.fieldSelect">
                      <option value=";">Point-virgule ( ; )</option>
                      <option value=",">Virgule ( , )</option>
                      <option value="&#9;">Tabulation</option>
                    </select>
                  </div>
                  <div :class="cls.field">
                    <label :class="cls.fieldLabel">Séparateur décimal</label>
                    <select v-model="csv.decimal" :class="cls.fieldSelect">
                      <option value=",">Virgule (12,5)</option>
                      <option value=".">Point (12.5)</option>
                    </select>
                  </div>
                </template>
                <label class="flex items-center gap-2 text-[13px] text-foreground cursor-pointer">
                  <input v-model="includeHeader" type="checkbox" class="accent-primary" /> Inclure la ligne de titres
                </label>
              </div>
            </section>
          </div>

          <!-- Aperçu -->
          <section class="border border-border rounded-lg p-4 flex flex-col gap-2">
            <h2 class="text-sm font-semibold text-foreground">Aperçu ({{ Math.min(rows.length, PREVIEW_ROWS) }} première(s) ligne(s))</h2>
            <div v-if="columns.length && rows.length" class="overflow-auto">
              <table class="text-[12px] w-full border-collapse">
                <thead v-if="includeHeader">
                  <tr><th v-for="(h, i) in preview.headers" :key="i" class="text-left font-semibold px-2.5 py-1.5 bg-background border border-border whitespace-nowrap">{{ h || '(sans titre)' }}</th></tr>
                </thead>
                <tbody>
                  <tr v-for="(r, ri) in preview.rows" :key="ri"><td v-for="(v, ci) in r" :key="ci" class="px-2.5 py-1.5 border border-border whitespace-nowrap">{{ v }}</td></tr>
                </tbody>
              </table>
            </div>
            <p v-else class="text-[13px] text-muted-foreground">{{ rows.length ? 'Ajoutez au moins une colonne.' : 'Aucune ligne à exporter avec ces filtres.' }}</p>
          </section>
        </div>
      </div>
    </div>
  </Teleport>
</template>
