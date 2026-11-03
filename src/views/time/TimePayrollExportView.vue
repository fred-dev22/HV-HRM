<template>
  <div :class="embedded ? '' : 'px-7 py-6 max-w-[1100px] mx-auto w-full'">
    <div v-if="!embedded" :class="L.pageHeader">
      <div>
        <div :class="L.pageTitle">Export paie</div>
        <div :class="L.pageSub">Calcul des heures puis export vers Sage.</div>
      </div>
    </div>
    <div v-else :class="L.pageSub" class="mb-4">Calculez les heures de la période, vérifiez le rapport par code de paie, puis exportez vers Sage.</div>

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
        <div :class="L.card">
          <div :class="L.cardHeader"><div :class="L.cardTitle"><span class="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold inline-flex items-center justify-center shrink-0">2</span> <Clock class="w-4 h-4" /> Calcul T4 : heures journalières</div></div>
          <p class="text-[13px] text-muted-foreground mb-3">Calcule, pour chaque employé et chaque jour, les heures travaillées (entrée et sortie de la pointeuse) et les heures prévues par son horaire.</p>
          <button :class="L.btnPrimary" :disabled="busy" @click="runDaily"><Calculator class="w-4 h-4" /> Lancer le calcul T4</button>
          <p v-if="dailyText" class="text-[13px] mt-3 px-3 py-2 rounded-md bg-success-bg text-success flex items-center gap-1.5"><CircleCheck class="w-4 h-4 shrink-0" /> {{ dailyText }}</p>
        </div>

        <!-- T5 -->
        <div :class="L.card">
          <div :class="L.cardHeader"><div :class="L.cardTitle"><span class="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold inline-flex items-center justify-center shrink-0">3</span> <TrendingUp class="w-4 h-4" /> Calcul T5 : heures supplémentaires</div></div>
          <p class="text-[13px] text-muted-foreground mb-3">Répartit les heures supplémentaires par code (HS01 à HS10), ajoute le panier et la permanence. Les cadres sont exclus.</p>
          <div class="flex items-end gap-3 flex-wrap">
            <div :class="cls.field" class="flex-1 min-w-[220px]">
              <label :class="cls.fieldLabel">Méthode</label>
              <select v-model="method" :class="cls.fieldSelect">
                <option value="daily">Dépassement de l'horaire du jour</option>
                <option value="weekly">Cumul hebdomadaire au-delà de 40 h</option>
              </select>
            </div>
            <button :class="L.btnPrimary" :disabled="busy" @click="runOvertime"><Calculator class="w-4 h-4" /> Lancer le calcul T5</button>
          </div>
          <p v-if="overtimeText" class="text-[13px] mt-3 px-3 py-2 rounded-md bg-success-bg text-success flex items-center gap-1.5"><CircleCheck class="w-4 h-4 shrink-0" /> {{ overtimeText }}</p>
        </div>
      </div>

      <!-- Rapport et export -->
      <div :class="L.card">
        <div :class="L.cardHeader">
          <div :class="L.cardTitle"><span class="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold inline-flex items-center justify-center shrink-0">4</span> <FileSpreadsheet class="w-4 h-4" /> Rapport et export Sage</div>
          <div class="flex items-center gap-2">
            <button :class="L.btnOutline" :disabled="busy" @click="loadReport"><Search class="w-4 h-4" /> Afficher le rapport</button>
            <button :class="L.btnPrimary" :disabled="busy" @click="downloadSage"><FileSpreadsheet class="w-4 h-4" /> Export Sage (.xlsx)</button>
          </div>
        </div>
        <div v-if="!report" class="text-[13px] text-muted-foreground">Affichez le rapport pour contrôler les heures par code avant l'export.</div>
        <div v-else :class="L.tableCard">
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
</template>

<script setup lang="ts">
/**
 * Export paie : calcul T4 (heures journalieres) puis T5 (heures supplementaires,
 * panier, permanence) sur une periode, rapport par code de paie et export Sage.
 */
import { ref, computed } from 'vue'
import { CalendarRange, Clock, TrendingUp, Calculator, Search, FileSpreadsheet, CircleCheck } from 'lucide-vue-next'
import * as cls from '../../lib/formClasses'
import * as L from '../../lib/listClasses'
import { todayIso } from '../../lib/date'
import { getApiErrorMessage } from '../../lib/api'
import { useToastStore } from '../../stores/toast'
import { useTimeStore, type OvertimeReport } from '../../stores/time'

defineProps<{ embedded?: boolean }>()

const store = useTimeStore()
const toast = useToastStore()

const today = todayIso()
const from = ref(`${today.slice(0, 8)}01`)
const to = ref(today)
const method = ref<'daily' | 'weekly'>('daily')
const busy = ref(false)
const dailyText = ref('')
const overtimeText = ref('')
const report = ref<OvertimeReport | null>(null)

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
  if (r) dailyText.value = `${r.calculated} jour(s) calculé(s), ${r.skipped} ignoré(s).`
}
async function runOvertime() {
  const r = await run('Calcul T5 en cours...', () => store.calculateOvertime(from.value, to.value, method.value), 'Calcul impossible')
  if (r) {
    overtimeText.value = `${r.calculated} ligne(s) de paie, ${r.excludedCadres} cadre(s) exclu(s).`
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
</script>
