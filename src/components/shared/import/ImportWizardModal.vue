<script setup lang="ts">
/**
 * Assistant d'import CSV generique en 3 etapes (recommandations + fichier ->
 * apercu editable -> import + recapitulatif), utilise par les 7 domaines du
 * Lot D (voir configs/*.ts). Le wizard ne connait aucune logique metier —
 * tout est pilote par la config passee en prop.
 *
 * Coquille alignee sur CreateModalShell.vue (banniere + barre de titre,
 * memes classes) pour rester visuellement identique aux autres modales de
 * creation, avec en plus les etapes en ronds (meme pattern que
 * OnboardingWizard.vue) puisque c'est un assistant a plusieurs etapes.
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import Papa from 'papaparse'
import {
  ArrowLeft, ArrowRight, Check, X, Upload, Download, FileWarning, CheckCircle2, AlertTriangle, Loader2,
} from 'lucide-vue-next'
import { api, getApiErrorMessage } from '../../../lib/api'
import * as cls from '../../../lib/formClasses'
import { useToastStore } from '../../../stores/toast'
import type { ImportConfig, ImportColumn, ParsedRow, ImportRowResult } from './importTypes'

const props = defineProps<{ open: boolean; config: ImportConfig }>()
const emit = defineEmits<{ close: []; imported: [] }>()

const router = useRouter()
const toast = useToastStore()

const STEP_LABELS = ['Fichier', 'Aperçu', 'Import'] as const

// Tableau d'apercu (etape 2) souvent plus large que l'ecran — sur un poste
// de bureau avec souris classique (pas de pave tactile), rien ne permet de
// deplacer la molette verticale en defilement horizontal, et la scrollbar
// native peut etre quasi invisible selon les reglages Windows (retour
// client). On convertit donc le scroll vertical en scroll horizontal quand
// la souris est au-dessus du tableau ET qu'il deborde reellement, sans
// toucher au scroll vertical normal de la page sinon.
const previewTableRef = ref<HTMLElement | null>(null)
function onPreviewWheel(e: WheelEvent) {
  const el = previewTableRef.value
  if (!el || el.scrollWidth <= el.clientWidth) return
  e.preventDefault()
  el.scrollLeft += e.deltaY
}

const step = ref<1 | 2 | 3>(1)
const fileError = ref('')
const fileName = ref('')
const fileReady = ref(false)
// Vrai pendant l'analyse du fichier (Papa.parse + resolution de toutes les
// lignes/colonnes) — pour un gros fichier ce n'est pas instantane, sans
// indicateur l'utilisateur ne voit rien bouger et reclique plusieurs fois en
// pensant que c'est bloque. Desactive "Suivant" et affiche le meme toast
// global que le reste de l'app pendant ce temps.
const parsingFile = ref(false)
const dragOver = ref(false)
const rows = ref<ParsedRow[]>([])

const blockingDependency = computed(() => props.config.dependencies.find(d => d.required && !d.ok()))

/* ── Étape 1 : recommandations + fichier ─────────────────────── */
function downloadSample() {
  // Inclut aussi les colonnes "extra" (ex: Créer un compte) — sans ça, un
  // champ pourtant importable n'apparaissait jamais dans le fichier exemple,
  // personne ne savait qu'il existait.
  const headers = [...props.config.columns, ...(props.config.extraColumns ?? [])].map(c => c.csvHeader)
  const csv = Papa.unparse({ fields: headers, data: props.config.sampleRows.map(r => headers.map(h => r[h] ?? '')) })
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `exemple-${props.config.title.toLowerCase().replace(/\s+/g, '-')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function resolveSelect(col: ImportColumn, rawValue: string): string {
  if (!col.options) return rawValue
  const norm = rawValue.trim().toLowerCase()
  if (!norm) return ''
  const match = col.options().find(o => (o.code && o.code.toLowerCase() === norm) || o.label.toLowerCase() === norm)
  return match ? match.value : ''
}

// Le champ date de l'aperçu est un <input type="date"> natif : il n'accepte
// QUE le format ISO (AAAA-MM-JJ) et affiche silencieusement vide sinon, même
// si la cellule du fichier a bien une valeur — sans ça, un fichier ouvert/
// resauvegardé dans Excel en local FR (format JJ/MM/AAAA par défaut)
// paraissait avoir des dates manquantes alors qu'elles étaient bien
// présentes, juste dans un format que le champ ne sait pas afficher.
function resolveDate(rawValue: string): string {
  const v = rawValue.trim()
  if (!v || /^\d{4}-\d{2}-\d{2}$/.test(v)) return v
  const eu = v.match(/^(\d{1,2})[/\-\\](\d{1,2})[/\-\\](\d{4})$/)
  if (eu) {
    // Non-null : les 3 groupes sont obligatoires dans le pattern (aucun `?`),
    // leur presence est garantie des que le match reussit — RegExpMatchArray
    // ne le sait juste pas statiquement.
    const [, d, m, y] = eu
    return `${y}-${m!.padStart(2, '0')}-${d!.padStart(2, '0')}`
  }
  return v
}

function isTruthy(v: string): boolean {
  return ['1', 'true', 'oui', 'yes', 'x'].includes(v.trim().toLowerCase())
}

// Compare les en-têtes sans tenir compte des accents/casse/espaces —
// un fichier tape a la main ("intitule" sans accent) ou resauvegarde
// depuis Excel avec un encodage different ("IntitulÃ©") ne doit pas
// echouer sur une comparaison strictement egale a col.csvHeader alors
// que la colonne est manifestement la bonne.
function normalizeHeader(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

// Fait correspondre chaque en-tete attendu (config) au vrai nom de colonne
// tel qu'il apparait dans le fichier, via la comparaison normalisee
// ci-dessus — utilise a la fois pour la verification des colonnes
// manquantes et pour la lecture des cellules dans buildRows().
function buildHeaderMap(actualHeaders: string[]): Map<string, string> {
  return new Map(actualHeaders.map(h => [normalizeHeader(h), h]))
}

function buildRows(parsed: Record<string, string>[], headerMap: Map<string, string>) {
  rows.value = parsed.map((raw) => {
    const values: Record<string, string> = {}
    const rawValues: Record<string, string> = {}
    for (const col of props.config.columns) {
      const actualKey = headerMap.get(normalizeHeader(col.csvHeader)) ?? col.csvHeader
      const cell = (raw[actualKey] ?? '').trim()
      rawValues[col.key] = cell
      values[col.key] = col.type === 'select' ? resolveSelect(col, cell) : col.type === 'date' ? resolveDate(cell) : cell
    }
    const extra: Record<string, unknown> = {}
    for (const col of props.config.extraColumns ?? []) {
      const actualKey = headerMap.get(normalizeHeader(col.csvHeader)) ?? col.csvHeader
      const cell = (raw[actualKey] ?? '').trim()
      extra[col.key] = col.type === 'boolean' ? isTruthy(cell) : cell
    }
    return { values, raw: rawValues, extra }
  })
}

// Ne fait plus avancer a l'etape 2 automatiquement — l'utilisateur doit
// confirmer via "Suivant" (voir goNext), pour pouvoir se rattraper si le
// fichier deposé n'est pas le bon avant de passer a l'apercu.
function handleFile(file: File | undefined) {
  fileError.value = ''
  fileReady.value = false
  if (!file) return
  if (!file.name.toLowerCase().endsWith('.csv')) {
    fileError.value = 'Le fichier doit être au format CSV (.csv).'
    return
  }
  fileName.value = file.name
  parsingFile.value = true
  toast.loading('Analyse du fichier en cours…')
  Papa.parse<Record<string, string>>(file, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      if (results.data.length === 0) {
        fileError.value = 'Le fichier est vide ou illisible.'
        parsingFile.value = false
        toast.hide()
        return
      }
      const headers = results.meta.fields ?? []
      const headerMap = buildHeaderMap(headers)
      const missing = props.config.columns.filter(c => c.required && !headerMap.has(normalizeHeader(c.csvHeader)))
      if (missing.length > 0) {
        // Liste aussi ce qui a ete detecte dans le fichier — permet de
        // reperer immediatement un probleme d'encodage (accents corrompus,
        // ex: "IntitulÃ©") plutot qu'un simple nom de colonne different.
        fileError.value = `Colonne(s) manquante(s) dans le fichier : ${missing.map(c => c.csvHeader).join(', ')}. Colonnes détectées dans le fichier : ${headers.join(', ') || 'aucune'}.`
        parsingFile.value = false
        toast.hide()
        return
      }
      buildRows(results.data, headerMap)
      fileReady.value = true
      parsingFile.value = false
      toast.success(`${results.data.length} ligne(s) analysée(s)`)
    },
    // err.message vient de PapaParse (toujours en anglais) — jamais affiché
    // tel quel, voir Lot F #3.
    error: () => {
      fileError.value = "Le fichier n'a pas pu être lu. Vérifiez qu'il s'agit bien d'un CSV valide."
      parsingFile.value = false
      toast.hide()
    },
  })
}

function onFileInput(e: Event) {
  if (parsingFile.value) return
  handleFile((e.target as HTMLInputElement).files?.[0])
}
function onDrop(e: DragEvent) {
  dragOver.value = false
  if (parsingFile.value) return
  handleFile(e.dataTransfer?.files?.[0])
}

/* ── Étape 2 : aperçu éditable ────────────────────────────────── */
function missingRequiredMessage(row: ParsedRow): string | undefined {
  const missing = props.config.columns.filter(c => c.required && !row.values[c.key])
  if (missing.length === 0) return undefined
  return `Champ(s) requis manquant(s) : ${missing.map(c => c.label).join(', ')}`
}
function rowIssueMessage(row: ParsedRow): string | undefined {
  return missingRequiredMessage(row) ?? props.config.rowValidation?.(row)
}
function rowHasIssue(row: ParsedRow): boolean {
  return !!rowIssueMessage(row)
}
const issueCount = computed(() => rows.value.filter(rowHasIssue).length)

function removeRow(index: number) {
  rows.value.splice(index, 1)
}

/* ── Étape 3 : import + récapitulatif ────────────────────────── */
const importing = ref(false)
const progress = ref({ current: 0, total: 0 })
const results = ref<ImportRowResult[]>([])
const done = ref(false)

function buildPayload(row: ParsedRow): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  for (const col of props.config.columns) {
    const v = row.values[col.key]
    if (!v) continue
    if (col.type === 'boolean') body[col.key] = isTruthy(v)
    else if (col.type === 'number') body[col.key] = Number(v)
    else body[col.key] = v
  }
  return props.config.transformPayload ? props.config.transformPayload(row, body) : body
}

async function startImport() {
  step.value = 3
  importing.value = true
  done.value = false
  results.value = []
  progress.value = { current: 0, total: rows.value.length }

  for (let i = 0; i < rows.value.length; i++) {
    const row = rows.value[i]!
    try {
      const { data } = await api.post(props.config.createEndpoint, buildPayload(row))
      let warning: string | undefined
      if (props.config.onRowCreated) {
        // Effet de bord (ex: creation de compte) — un echec ne fait pas
        // echouer la ligne elle-meme (l'entite principale a bien ete creee),
        // mais doit rester visible plutot que d'etre avale silencieusement.
        await props.config.onRowCreated(data, row.extra).catch((err) => {
          warning = getApiErrorMessage(err, "Un effet secondaire de cette ligne a échoué.")
        })
      }
      results.value.push({ index: i, success: true, warning })
    } catch (err) {
      results.value.push({ index: i, success: false, error: getApiErrorMessage(err, 'Échec de la création') })
    }
    progress.value.current = i + 1
  }

  importing.value = false
  done.value = true
  emit('imported')
}

const succeededCount = computed(() => results.value.filter(r => r.success).length)
const failedResults = computed(() => results.value.filter(r => !r.success))
const warnedResults = computed(() => results.value.filter(r => r.success && r.warning))

/* ── Navigation générale (assistant à étapes) ────────────────────── */
function goToDependency(dep: { routeTo: import('vue-router').RouteLocationRaw }) {
  emit('close')
  router.push(dep.routeTo)
}
// Reste vrai apres le clic sur "Suivant" tant qu'on est encore a l'etape 1 —
// bloque un double-clic (l'utilisateur qui reclique en pensant que c'est
// bloque). Ne se reinitialise que si on revient a l'etape 1 depuis l'etape 2
// (voir goBack), jamais tout seul.
const nextClicked = ref(false)
function goNext() {
  if (step.value === 1 && fileReady.value && !nextClicked.value) {
    nextClicked.value = true
    step.value = 2
  }
}
function goBack() {
  if (step.value === 2) {
    step.value = 1
    nextClicked.value = false
  }
}

// Bouton principal de la barre de titre : son libellé/action dépend de
// l'étape courante, comme "Ajouter"/"Créer" sur CreateModalShell mais
// variable ici puisqu'il y a plusieurs étapes.
const primaryLabel = computed(() => {
  if (step.value === 1) return 'Suivant'
  if (step.value === 2) return `Importer ${rows.value.length} élément(s)`
  return 'Fermer'
})
const primaryDisabled = computed(() => {
  if (step.value === 1) return !fileReady.value || !!blockingDependency.value || nextClicked.value
  if (step.value === 2) return rows.value.length === 0
  return false
})
function onPrimaryClick() {
  if (step.value === 1) goNext()
  else if (step.value === 2) startImport()
  else handleClose()
}

function stepCircleClass(s: number): string {
  if (s > step.value) return 'bg-card text-muted-foreground border-2 border-border'
  return 'bg-primary text-white' + (s === step.value ? ' shadow-[0_0_0_4px_var(--color-primary-light)]' : '')
}

function reset() {
  step.value = 1
  fileError.value = ''
  fileName.value = ''
  fileReady.value = false
  rows.value = []
  results.value = []
  progress.value = { current: 0, total: 0 }
  done.value = false
}
function handleClose() {
  if (importing.value) return
  reset()
  emit('close')
}

const onKeydown = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="#below-topbar" defer>
    <div v-if="open" class="absolute inset-0 z-50 flex">
      <div class="absolute inset-0 bg-black/60 backdrop-blur-md" @click="handleClose"></div>

      <div class="relative z-10 flex flex-col w-full h-full bg-card overflow-hidden mx-4 lg:mx-auto lg:max-w-[1040px] shadow-[0_8px_32px_rgba(0,0,0,0.16)]">
        <!-- Bannière -->
        <div class="bg-primary text-primary-foreground px-6 py-2 flex items-center justify-between text-sm shrink-0">
          <div class="flex items-center gap-2">
            <button :disabled="importing" class="p-1 hover:bg-white/20 rounded transition disabled:opacity-50" title="Fermer" @click="handleClose">
              <ArrowLeft class="w-5 h-5" />
            </button>
            <span>Importer · {{ config.title }}</span>
          </div>
          <div class="flex items-center gap-3">
            <span class="flex items-center gap-1 text-yellow-200">
              <Upload class="w-4 h-4" /> Import
            </span>
          </div>
        </div>

        <!-- Barre de titre -->
        <div class="bg-card border-b border-border px-6 py-4 shrink-0">
          <div class="flex items-center justify-between">
            <h1 class="text-2xl font-semibold text-card-foreground">{{ config.title }}</h1>
            <div class="flex items-center gap-2">
              <button
                v-if="step === 2"
                :disabled="importing"
                class="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-card-foreground border border-border rounded hover:bg-background transition disabled:opacity-50 cursor-pointer"
                @click="goBack"
              >
                <ArrowLeft class="w-4 h-4" /> Retour
              </button>
              <button
                v-if="!importing"
                :disabled="primaryDisabled"
                class="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-primary-foreground bg-primary rounded hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                @click="onPrimaryClick"
              >
                <Check v-if="step === 3" class="w-4 h-4" />
                {{ primaryLabel }}
                <ArrowRight v-if="step < 3" class="w-4 h-4" />
              </button>
              <button
                v-if="step < 3"
                :disabled="importing"
                class="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-card-foreground border border-border rounded hover:bg-background transition disabled:opacity-50 cursor-pointer"
                @click="handleClose"
              >
                <X class="w-4 h-4" /> Annuler
              </button>
            </div>
          </div>

          <!-- Étapes en ronds — même pattern que OnboardingWizard.vue -->
          <div class="flex items-start max-w-[420px] w-full mx-auto mt-5">
            <template v-for="(label, i) in STEP_LABELS" :key="label">
              <div class="flex flex-col items-center shrink-0">
                <div class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-[12px] transition-all shrink-0" :class="stepCircleClass(i + 1)">
                  <Check v-if="i + 1 < step" class="w-3.5 h-3.5" />
                  <span v-else>{{ i + 1 }}</span>
                </div>
                <span class="text-[11px] font-medium mt-1.5 text-center" :class="i + 1 === step ? 'text-primary' : 'text-muted-foreground'">{{ label }}</span>
              </div>
              <div v-if="i < STEP_LABELS.length - 1" class="flex-1 h-[2px] rounded-sm self-center mb-4 transition-colors" :class="i + 1 < step ? 'bg-primary' : 'bg-border'"></div>
            </template>
          </div>
        </div>

        <!-- Contenu -->
        <div class="overflow-y-auto flex-1 px-6 py-5">

          <!-- ═══ ÉTAPE 1 ═══ -->
          <template v-if="step === 1">
            <p class="text-[13px] text-muted-foreground mb-4">{{ config.intro }}</p>

            <div v-if="config.dependencies.length" class="mb-5 flex flex-col gap-2">
              <div
                v-for="(dep, i) in config.dependencies" :key="i"
                class="flex items-center justify-between gap-3 rounded-md px-3 py-2.5 text-[12px]"
                :class="dep.ok() ? 'bg-success-bg text-success' : dep.required ? 'bg-danger-bg text-danger' : 'bg-warning-bg text-warning'"
              >
                <div class="flex items-center gap-2">
                  <CheckCircle2 v-if="dep.ok()" class="w-4 h-4 shrink-0" />
                  <AlertTriangle v-else class="w-4 h-4 shrink-0" />
                  <span>{{ dep.label }}</span>
                </div>
                <button v-if="!dep.ok()" type="button" class="underline font-medium shrink-0 cursor-pointer" @click="goToDependency(dep)">
                  Aller créer
                </button>
              </div>
              <p v-if="blockingDependency" class="text-[11px] text-danger">
                Assurez-vous d'avoir déjà importé ou créé ces éléments avant de continuer.
              </p>
            </div>

            <template v-if="!blockingDependency">
              <button type="button" :class="[cls.btnPrimary, 'mb-4']" @click="downloadSample">
                <Download class="w-3.5 h-3.5" /> Télécharger un exemple CSV
              </button>

              <label
                class="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg py-10 px-4 text-center transition-colors"
                :class="[
                  parsingFile ? 'opacity-60 pointer-events-none cursor-wait' : 'cursor-pointer',
                  dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40',
                ]"
                @dragover.prevent="dragOver = true"
                @dragleave.prevent="dragOver = false"
                @drop.prevent="onDrop"
              >
                <Loader2 v-if="parsingFile" class="w-6 h-6 text-primary animate-spin" />
                <Upload v-else class="w-6 h-6 text-muted-foreground" />
                <span v-if="parsingFile" class="text-[13px] text-foreground font-medium">Analyse du fichier en cours, patientez…</span>
                <span v-else class="text-[13px] text-foreground font-medium">Glissez un fichier CSV ici, ou cliquez pour parcourir</span>
                <span v-if="fileReady" class="text-[11px] text-success flex items-center gap-1"><CheckCircle2 class="w-3.5 h-3.5" /> {{ fileName }} — {{ rows.length }} ligne(s), prêt</span>
                <span v-else-if="fileName && !parsingFile" class="text-[11px] text-primary">{{ fileName }}</span>
                <input type="file" accept=".csv" class="hidden" :disabled="parsingFile" @change="onFileInput" />
              </label>

              <p v-if="fileError" :class="[cls.fieldErrorBlock, 'mt-3']">
                <FileWarning class="w-3.5 h-3.5 shrink-0" /> {{ fileError }}
              </p>
              <p v-if="fileReady" class="text-[12px] text-muted-foreground mt-3">
                Fichier différent ? Déposez-en un autre ci-dessus avant de cliquer sur « Suivant ».
              </p>
            </template>
          </template>

          <!-- ═══ ÉTAPE 2 ═══ -->
          <template v-else-if="step === 2">
            <div class="flex items-center justify-between mb-3">
              <span class="text-[13px] text-foreground">{{ rows.length }} ligne(s) détectée(s)</span>
              <span v-if="issueCount > 0" class="text-[12px] text-warning flex items-center gap-1">
                <AlertTriangle class="w-3.5 h-3.5" /> {{ issueCount }} ligne(s) à corriger
              </span>
            </div>

            <div ref="previewTableRef" class="import-preview-scroll overflow-x-auto border border-border rounded-lg" @wheel="onPreviewWheel">
              <table class="w-full text-[12px] border-collapse">
                <thead>
                  <tr class="bg-background">
                    <th class="px-2 py-2 text-left font-semibold text-muted-foreground w-8"></th>
                    <th v-for="col in config.columns" :key="col.key" class="px-2 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">
                      {{ col.label }}<span v-if="col.required" class="text-danger">*</span>
                    </th>
                    <th v-for="col in config.extraColumns ?? []" :key="col.key" class="px-2 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">
                      {{ col.label }}
                    </th>
                    <th class="px-2 py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, i) in rows" :key="i" class="border-t border-border" :class="rowHasIssue(row) ? 'bg-danger-bg/30' : ''">
                    <td class="px-2 py-1.5 text-center">
                      <AlertTriangle v-if="rowHasIssue(row)" class="w-3.5 h-3.5 text-danger inline" :title="rowIssueMessage(row)" />
                      <CheckCircle2 v-else class="w-3.5 h-3.5 text-success inline" />
                    </td>
                    <td v-for="col in config.columns" :key="col.key" class="px-2 py-1.5">
                      <select
                        v-if="col.type === 'select'"
                        v-model="row.values[col.key]"
                        class="h-7 px-1.5 border border-border rounded text-[12px] bg-background outline-none w-full min-w-[130px]"
                        :class="{ '!border-danger': col.required && !row.values[col.key] }"
                      >
                        <option value="">{{ row.raw[col.key] ? `« ${row.raw[col.key]} » introuvable` : '—' }}</option>
                        <option v-for="opt in col.options!()" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                      </select>
                      <input
                        v-else-if="col.type === 'boolean'"
                        type="checkbox"
                        class="accent-primary"
                        :checked="isTruthy(row.values[col.key] ?? '')"
                        @change="row.values[col.key] = ($event.target as HTMLInputElement).checked ? 'true' : 'false'"
                      />
                      <input
                        v-else
                        :type="col.type === 'date' ? 'date' : col.type === 'number' ? 'number' : 'text'"
                        v-model="row.values[col.key]"
                        class="h-7 px-1.5 border border-border rounded text-[12px] bg-background outline-none w-full min-w-[100px]"
                        :class="{ '!border-danger': col.required && !row.values[col.key] }"
                      />
                    </td>
                    <td v-for="col in config.extraColumns ?? []" :key="col.key" class="px-2 py-1.5">
                      <input
                        v-if="col.type === 'boolean'"
                        type="checkbox"
                        class="accent-primary"
                        :checked="!!row.extra[col.key]"
                        @change="row.extra[col.key] = ($event.target as HTMLInputElement).checked"
                      />
                    </td>
                    <td class="px-2 py-1.5 text-center">
                      <button type="button" class="text-muted-foreground hover:text-danger cursor-pointer" title="Retirer cette ligne" @click="removeRow(i)">
                        <X class="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>

          <!-- ═══ ÉTAPE 3 ═══ -->
          <template v-else>
            <div v-if="!done" class="flex flex-col items-center justify-center gap-4 py-10">
              <Loader2 class="w-8 h-8 text-primary animate-spin" />
              <div class="text-[13px] text-foreground">
                Import en cours, élément {{ progress.current }} sur {{ progress.total }}
              </div>
              <div class="w-full max-w-md h-2 bg-background rounded-full overflow-hidden border border-border">
                <div class="h-full bg-primary transition-all" :style="{ width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%` }"></div>
              </div>
            </div>

            <div v-else class="flex flex-col gap-4">
              <div class="flex items-center gap-4">
                <div class="flex-1 bg-success-bg rounded-lg px-4 py-3 text-center">
                  <div class="text-[22px] font-semibold text-success">{{ succeededCount }}</div>
                  <div class="text-[11px] text-success">Réussi(s)</div>
                </div>
                <div class="flex-1 bg-danger-bg rounded-lg px-4 py-3 text-center">
                  <div class="text-[22px] font-semibold text-danger">{{ failedResults.length }}</div>
                  <div class="text-[11px] text-danger">Échoué(s)</div>
                </div>
              </div>

              <div v-if="failedResults.length > 0" class="border border-border rounded-lg overflow-hidden">
                <div class="bg-background px-3 py-2 text-[11px] font-semibold text-muted-foreground">Détail des erreurs</div>
                <div class="max-h-56 overflow-y-auto">
                  <div v-for="r in failedResults" :key="r.index" class="px-3 py-2 text-[12px] border-t border-border flex items-start gap-2">
                    <span class="text-muted-foreground shrink-0">Ligne {{ r.index + 1 }}</span>
                    <span class="text-danger">{{ r.error }}</span>
                  </div>
                </div>
              </div>

              <div v-if="warnedResults.length > 0" class="border border-warning/30 rounded-lg overflow-hidden">
                <div class="bg-warning-bg px-3 py-2 text-[11px] font-semibold text-warning flex items-center gap-1.5">
                  <AlertTriangle class="w-3.5 h-3.5" /> Créé(s) avec un avertissement — à corriger manuellement
                </div>
                <div class="max-h-56 overflow-y-auto">
                  <div v-for="r in warnedResults" :key="r.index" class="px-3 py-2 text-[12px] border-t border-border flex items-start gap-2">
                    <span class="text-muted-foreground shrink-0">Ligne {{ r.index + 1 }}</span>
                    <span class="text-warning">{{ r.warning }}</span>
                  </div>
                </div>
              </div>
            </div>
          </template>

        </div>

      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* Scrollbar horizontale toujours visible et epaisse (retour client : sur
   desktop + souris classique, la scrollbar native Windows est souvent trop
   fine/masquee pour etre reperee ou attrapee a la souris). Le defilement
   molette->horizontal (voir onPreviewWheel) reste le moyen principal, ceci
   est la solution de repli visuelle. */
.import-preview-scroll {
  scrollbar-width: auto;
}
.import-preview-scroll::-webkit-scrollbar {
  height: 12px;
}
.import-preview-scroll::-webkit-scrollbar-track {
  background: var(--color-background);
}
.import-preview-scroll::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 6px;
}
.import-preview-scroll::-webkit-scrollbar-thumb:hover {
  background: var(--color-muted-foreground);
}
</style>
