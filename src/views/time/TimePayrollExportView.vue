<template>
  <div :class="embedded ? '' : 'px-7 py-6 max-w-[1100px] mx-auto w-full'">
    <div v-if="!embedded" :class="L.pageHeader">
      <div>
        <div :class="L.pageTitle">Export paie</div>
        <div :class="L.pageSub">Calcul des heures puis export vers Sage.</div>
      </div>
    </div>
    <div v-else :class="L.pageSub" class="mb-4">Calculez les heures de la période, puis exportez vers Sage.</div>

    <div class="flex flex-col gap-4">
      <!-- Période -->
      <div :class="L.card">
        <div :class="L.cardHeader"><div :class="L.cardTitle"><span class="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold inline-flex items-center justify-center shrink-0">1</span> <CalendarRange class="w-4 h-4" /> Période de calcul</div></div>
        <div class="flex items-end gap-3 flex-wrap">
          <div :class="cls.field"><label :class="cls.fieldLabel">Du</label><input v-model="from" type="date" :class="cls.fieldInput" /></div>
          <div :class="cls.field"><label :class="cls.fieldLabel">Au</label><input v-model="to" type="date" :class="cls.fieldInput" /></div>
          <p class="text-[12px] text-muted-foreground pb-2">Les calculs s'appliquent à tous les employés sur cette période et sont enregistrés en base. Un recalcul remplace le précédent.</p>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <!-- T4 -->
        <div :class="L.card" class="flex flex-col">
          <div :class="L.cardHeader"><div :class="L.cardTitle"><span class="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold inline-flex items-center justify-center shrink-0">2</span> <Clock class="w-4 h-4" /> Calcul T4 : heures journalières</div></div>
          <p class="text-[13px] text-muted-foreground mb-4">Calcule, pour chaque employé et chaque jour, les heures travaillées (pointeuse et saisies de travail approuvées) et les heures prévues par son horaire.</p>
          <!-- Pied de carte : les deux boutons restent alignes d'une carte a l'autre. -->
          <div class="mt-auto border-t border-border pt-3">
            <button :class="L.btnPrimary" :disabled="busy" @click="runDaily"><Calculator class="w-4 h-4" /> Lancer le calcul T4</button>
            <p v-if="dailyText" class="text-[13px] mt-3 px-3 py-2 rounded-md bg-success-bg text-success flex items-center gap-1.5"><CircleCheck class="w-4 h-4 shrink-0" /> {{ dailyText }}</p>
          </div>
        </div>

        <!-- T5 -->
        <div :class="L.card" class="flex flex-col">
          <div :class="L.cardHeader"><div :class="L.cardTitle"><span class="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold inline-flex items-center justify-center shrink-0">3</span> <TrendingUp class="w-4 h-4" /> Calcul T5 : heures supplémentaires</div></div>
          <p class="text-[13px] text-muted-foreground mb-4">Répartit les heures supplémentaires par code (HS01 à HS10), ajoute le panier et la permanence. Les cadres sont exclus.</p>
          <div class="rounded-md bg-background px-3 py-2.5 mb-4">
            <div class="text-[11px] text-muted-foreground">Méthode de calcul</div>
            <div class="text-[13px] font-semibold text-foreground">Cumul hebdomadaire au-delà de 40 h</div>
          </div>
          <div :class="cls.field" class="mb-4">
            <label for="payroll-code" :class="cls.fieldLabel">Code à calculer</label>
            <select id="payroll-code" v-model="onlyCode" :class="cls.fieldSelect" class="w-full">
              <option value="">Tous les codes</option>
              <option v-for="c in CALCULATED_CODES" :key="c.code" :value="c.code">{{ c.label }}</option>
            </select>
            <p v-if="onlyCode" class="text-[12px] text-muted-foreground">Seules les lignes {{ onlyCode }} de la période sont remplacées, les autres codes restent tels quels.</p>
          </div>
          <div class="mt-auto border-t border-border pt-3">
            <button :class="L.btnPrimary" :disabled="busy || !dailyReady" @click="runOvertime"><Calculator class="w-4 h-4" /> {{ onlyCode ? `Recalculer ${onlyCode}` : 'Lancer le calcul T5' }}</button>
            <p v-if="!dailyReady" class="text-[12px] text-muted-foreground mt-2">Lancez d'abord le calcul T4 sur cette période : T5 part des heures journalières.</p>
            <p v-if="overtimeText" class="text-[13px] mt-3 px-3 py-2 rounded-md bg-success-bg text-success flex items-center gap-1.5"><CircleCheck class="w-4 h-4 shrink-0" /> {{ overtimeText }}</p>
          </div>
        </div>
      </div>

      <!-- Export -->
      <div :class="L.card">
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <div :class="L.cardTitle"><span class="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold inline-flex items-center justify-center shrink-0">4</span> <FileSpreadsheet class="w-4 h-4" /> Export Sage</div>
          <button :class="L.btnPrimary" :disabled="busy" @click="downloadSage"><FileSpreadsheet class="w-4 h-4" /> Export Sage (.xlsx)</button>
        </div>
        <!-- Resultat : les lignes deja calculees sur la periode, ou celles du calcul T5. -->
        <div v-if="report" ref="resultBlock" class="mt-4">
          <div class="text-[13px] font-semibold text-foreground mb-2">Résultat du calcul T5, par code de paie</div>
          <div :class="L.tableCard">
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
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Export paie : calcul T4 (heures journalieres) puis T5 (heures supplementaires,
 * panier, permanence) sur une periode, puis export Sage.
 */
import { ref, computed, nextTick, onMounted, watch } from 'vue'
import { CalendarRange, Clock, TrendingUp, Calculator, FileSpreadsheet, CircleCheck } from 'lucide-vue-next'
import * as cls from '../../lib/formClasses'
import * as L from '../../lib/listClasses'
import { monthOf, todayIso } from '../../lib/date'
import { getApiErrorMessage } from '../../lib/api'
import { useToastStore } from '../../stores/toast'
import { useTimeStore, type OvertimeReport } from '../../stores/time'

defineProps<{ embedded?: boolean }>()

const store = useTimeStore()
const toast = useToastStore()

// La page s'ouvre toujours sur le mois courant entier, jamais sur la derniere periode choisie.
const month = monthOf(todayIso())
const from = ref(month.from)
const to = ref(month.to)
// Mode par code : vide = tous les codes. Les codes calcules automatiquement par T5.
const onlyCode = ref('')
const CALCULATED_CODES = [
  { code: 'HS01', label: 'HS01 : heures sup. à 130 %' },
  { code: 'HS02', label: 'HS02 : heures sup. à 150 %' },
  { code: 'HS03', label: 'HS03 : HS01 non imposables' },
  { code: 'HS04', label: 'HS04 : HS02 non imposables' },
  { code: 'HS09', label: 'HS09 : heures de nuit' },
  { code: 'HS10', label: 'HS10 : dimanche et jours fériés' },
  { code: '30900', label: '30900 : panier' },
  { code: '2210', label: '2210 : permanence' },
]

onMounted(() => {
  store.fetchSettings().catch(() => {})
  showReport()
  loadStatus()
})
const busy = ref(false)
const dailyText = ref('')
const overtimeText = ref('')
// T5 part des heures journalieres de T4 : il faut qu'il y en ait sur la periode.
const dailyReady = ref(false)
const report = ref<OvertimeReport | null>(null)
const resultBlock = ref<HTMLElement | null>(null)

const reportCodes = computed(() => {
  const codes = new Set<string>()
  for (const e of report.value?.employees ?? []) for (const c of Object.keys(e.totalsByCode)) codes.add(c)
  return [...codes].sort()
})

async function run<T>(label: string, action: () => Promise<T>, fallback: string): Promise<T | undefined> {
  if (!from.value || !to.value || from.value > to.value) { toast.error('Choisissez une période valide.'); return undefined }
  busy.value = true
  toast.loading(label)
  try {
    const result = await action()
    toast.success('Effectué avec succès')
    return result
  } catch (e) {
    toast.error(getApiErrorMessage(e, fallback))
    return undefined
  } finally {
    busy.value = false
  }
}

async function runDaily() {
  const r = await run('Calcul T4 en cours...', () => store.calculateDaily(from.value, to.value), 'Calcul impossible')
  if (r) {
    dailyText.value = `${r.calculated} jour(s) calculé(s), ${r.skipped} ignoré(s).`
    await loadStatus()
  }
}
async function runOvertime() {
  const r = await run('Calcul T5 en cours...', () => store.calculateOvertime(from.value, to.value, undefined, onlyCode.value), 'Calcul impossible')
  if (r) {
    overtimeText.value = `${r.calculated} ligne(s) de paie${r.code ? ` ${r.code}` : ''} (calcul hebdomadaire), ${r.excludedCadres} cadre(s) exclu(s).${r.unvalidatedWeeks ? ` ${r.unvalidatedWeeks} semaine(s) non validée(s) écartée(s).` : ''}`
    await showReport(true)
  }
}
// A l'ouverture et au changement de dates, le tableau n'apparait que s'il y a deja
// des lignes ; apres un calcul il apparait toujours et la page defile jusqu'a lui.
// Seule la derniere demande est gardee.
let reportSeq = 0
async function showReport(afterCalculation = false) {
  const seq = ++reportSeq
  if (!from.value || !to.value || from.value > to.value) return
  try {
    const data = await store.fetchReport(from.value, to.value)
    if (seq !== reportSeq) return
    report.value = afterCalculation || data.employees.length > 0 ? data : null
    if (!afterCalculation) return
    await nextTick()
    resultBlock.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  } catch (e) {
    toast.error(getApiErrorMessage(e, 'Chargement du résultat impossible'))
  }
}
// Seule la derniere reponse est gardee si l'utilisateur change vite de dates.
let statusSeq = 0
async function loadStatus() {
  if (!from.value || !to.value || from.value > to.value) return
  const seq = ++statusSeq
  try {
    const s = await store.fetchCalculationStatus(from.value, to.value)
    if (seq === statusSeq) dailyReady.value = s.dailyRows > 0
  } catch {
    if (seq === statusSeq) dailyReady.value = true // en cas de doute, le serveur refuse lui-meme T5 sans T4
  }
}

watch([from, to], () => {
  dailyText.value = ''
  overtimeText.value = ''
  report.value = null
  showReport()
  loadStatus()
})

async function downloadSage() {
  await run('Génération de l\'export...', () => store.downloadSageXlsx(from.value, to.value), 'Export impossible')
}
</script>
