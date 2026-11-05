<template>
  <div :class="embedded ? '' : 'px-7 py-6 max-w-[1100px] mx-auto w-full'">
    <div v-if="!embedded" :class="L.pageHeader">
      <div>
        <div :class="L.pageTitle">Configuration du temps de travail</div>
        <div :class="L.pageSub">Import de la pointeuse, types et codes de présence, réglages du calcul.</div>
      </div>
    </div>
    <div v-else :class="L.pageSub" class="mb-3">Import de la pointeuse, types et codes de présence, réglages du calcul et tarifs.</div>

    <div class="flex gap-1.5 flex-wrap mb-4">
      <button
        v-for="t in TABS" :key="t.key"
        class="px-3 py-1.5 text-[12.5px] font-medium rounded-md border transition-colors"
        :class="tab === t.key ? 'bg-tint text-primary border-primary' : 'bg-background text-muted-foreground border-border hover:text-foreground'"
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
            <button type="button" :class="cls.fieldInput" class="flex items-center gap-2 text-left cursor-pointer hover:border-primary" @click="showPicker = true">
              <Folder class="w-4 h-4 text-primary shrink-0" />
              <span class="truncate" :class="cfg.folderPath ? 'text-foreground' : 'text-muted-foreground'">{{ cfg.folderPath || 'Cliquer pour choisir le dossier' }}</span>
            </button>
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

      <!-- Personnes de la pointeuse sans employé du HRM -->
      <div :class="L.card">
        <div :class="L.cardHeader"><div :class="L.cardTitle"><UserX class="w-4 h-4" /> Pointages sans employé</div></div>
        <p class="text-[13px] text-muted-foreground mb-3">
          Ces personnes figurent dans les fichiers de la pointeuse, mais aucun employé du HRM ne leur correspond (matricule absent, générique ou inconnu). Leurs heures n'entrent dans aucun calcul tant qu'elles ne sont pas rattachées. Le rattachement est mémorisé pour les imports suivants.
        </p>
        <p v-if="unmatched.length === 0" class="text-[13px] px-3 py-2 rounded-md bg-success-bg text-success flex items-center gap-1.5"><CircleCheck class="w-4 h-4 shrink-0" /> Tous les pointages sont rattachés à un employé.</p>
        <template v-else>
        <div class="flex items-center gap-2 mb-3">
          <input v-model="unmatchedSearch" type="search" placeholder="Rechercher un nom ou un matricule" :class="cls.fieldInput" class="max-w-[320px]" />
          <span class="text-[12px] text-muted-foreground">{{ unmatched.length }} personne(s) à rattacher</span>
        </div>
        <div :class="L.tableCard">
          <table :class="L.table">
            <thead>
              <tr><th :class="L.th">Personne</th><th :class="L.th">Matricule du fichier</th><th :class="L.th">Pointages</th><th :class="L.th">Période</th><th :class="L.th"></th></tr>
            </thead>
            <tbody>
              <tr v-if="unmatchedFiltered.length === 0"><td :class="L.td" colspan="5" class="text-center text-muted-foreground">Aucune personne ne correspond à la recherche.</td></tr>
              <tr v-for="p in unmatchedPage" :key="p.biometricUuid" :class="L.rowHover">
                <td :class="L.td" class="font-medium">{{ p.lastName }} {{ p.firstName }}<div class="text-[11px] text-muted-foreground font-normal" :title="p.biometricUuid">ID {{ p.biometricUuid.slice(0, 8) }}</div></td>
                <td :class="L.td">{{ p.employeeNumber && p.employeeNumber !== 'None' ? p.employeeNumber : '-' }}</td>
                <td :class="L.td">{{ p.records }}</td>
                <td :class="L.td" class="whitespace-nowrap">{{ formatDate(p.from) }} au {{ formatDate(p.to) }}</td>
                <td :class="L.td" class="text-right"><button :class="L.btnPrimary" @click="openLink(p)"><Link2 class="w-4 h-4" /> Rattacher</button></td>
              </tr>
            </tbody>
          </table>
          <TimePager v-model:page="unmatchedPageNo" v-model:page-size="unmatchedPageSize" :total="unmatchedFiltered.length" />
        </div>
        </template>
      </div>

      <ModalShell :open="!!linking" :title="linking ? `Rattacher ${linking.person.lastName} ${linking.person.firstName}` : ''" max-width="max-w-[520px]" @close="linking = null">
        <template v-if="linking">
          <p class="text-[13px] text-muted-foreground">Choisissez l'employé du HRM qui correspond à cette personne de la pointeuse. Ses {{ linking.person.records }} pointage(s) seront rattachés et ses heures recalculées.</p>
          <div :class="cls.field">
            <label :class="cls.fieldLabel">Employé</label>
            <EmployeePicker v-model="linking.employeeId" :employees="employeeItems" />
          </div>
        </template>
        <template #footer>
          <button :class="L.btnOutline" @click="linking = null">Annuler</button>
          <button :class="L.btnPrimary" :disabled="busy || !linking?.employeeId" @click="saveLink">Rattacher</button>
        </template>
      </ModalShell>

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

    <!-- ─────────── Types et codes de présence ─────────── -->
    <section v-if="tab === 'types'" class="flex flex-col gap-3">
      <p class="text-[13px] text-muted-foreground">Gestion des types de présence et de leurs codes de paie. Les codes marqués d'un cadenas servent au calcul : on peut modifier leur description mais pas leur nom.</p>
      <div v-for="t in types" :key="t.id" :class="L.card">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div :class="L.cardTitle"><Tag class="w-4 h-4" /> {{ t.name }} <span class="font-normal text-muted-foreground">({{ t.codes.length }} code{{ t.codes.length > 1 ? 's' : '' }})</span></div>
            <p v-if="t.description" class="text-[12px] text-muted-foreground mt-1">{{ t.description }}</p>
            <p class="text-[11px] text-muted-foreground mt-0.5">Code Sage du type : {{ t.sageTypeCode ?? '-' }}</p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <button :class="L.btnOutline" @click="openType(t)"><Pencil class="w-4 h-4" /> Modifier</button>
          </div>
        </div>
        <div class="mt-3 border-t border-border">
          <div v-for="c in t.codes" :key="c.id" class="flex items-center justify-between gap-3 py-2 border-b border-border last:border-b-0">
            <div class="min-w-0">
              <span class="font-medium text-[13px]">{{ c.code }}</span>
              <Lock v-if="c.locked" class="w-3 h-3 inline-block ml-1.5 text-muted-foreground" title="Utilisé par le calcul" />
              <span v-if="c.description" class="text-[12px] text-muted-foreground ml-2">{{ c.description }}</span>
            </div>
            <button :class="L.actView" @click="openCode(t, c)"><Pencil class="w-3.5 h-3.5" /> Modifier</button>
          </div>
          <div v-if="t.codes.length === 0" class="py-2 text-[12px] text-muted-foreground">Aucun code.</div>
        </div>
      </div>
    </section>

    <!-- ─────────── Reglages ─────────── -->
    <section v-if="tab === 'settings'" class="flex flex-col gap-4">
      <div v-if="methodSetting" :class="L.card">
        <div :class="L.cardHeader"><div :class="L.cardTitle"><Calculator class="w-4 h-4" /> Méthode de calcul des heures supplémentaires</div></div>
        <p class="text-[12px] text-muted-foreground mb-3">Chaque client utilise sa méthode. Le choix est enregistré dès que vous cliquez et s'applique au prochain calcul (Export paie).</p>
        <div class="grid grid-cols-3 gap-3 max-lg:grid-cols-1">
          <button
            v-for="m in METHOD_OPTIONS" :key="m.value" type="button" :disabled="busy"
            class="text-left rounded-lg border p-3.5 transition-colors cursor-pointer"
            :class="methodSetting.value === m.value ? 'border-primary bg-tint' : 'border-border bg-background hover:border-primary'"
            @click="chooseMethod(m.value)"
          >
            <div class="flex items-center gap-2 text-[13px] font-semibold" :class="methodSetting.value === m.value ? 'text-primary' : 'text-foreground'">
              <span class="w-3.5 h-3.5 rounded-full border-2 inline-flex items-center justify-center shrink-0" :class="methodSetting.value === m.value ? 'border-primary' : 'border-border'">
                <span v-if="methodSetting.value === m.value" class="w-1.5 h-1.5 rounded-full bg-primary"></span>
              </span>
              {{ m.label }}
            </div>
            <p class="text-[12px] text-muted-foreground mt-1.5">{{ m.hint }}</p>
          </button>
        </div>
      </div>

      <div :class="L.card">
        <div :class="L.cardHeader"><div :class="L.cardTitle"><SlidersHorizontal class="w-4 h-4" /> Corrections du temps travaillé</div></div>
        <p class="text-[12px] text-muted-foreground mb-3">Options appliquées au prochain calcul des heures. Le changement est enregistré dès que vous cliquez.</p>
        <div class="flex flex-col">
          <div v-for="s in toggleSettings" :key="s.key" class="flex items-center justify-between gap-4 py-2.5 border-b border-border last:border-b-0">
            <div class="min-w-0">
              <div class="text-[13px] font-medium text-foreground">{{ s.label }}</div>
              <div v-if="TOGGLE_HINTS[s.key]" class="text-[11px] text-muted-foreground mt-0.5">{{ TOGGLE_HINTS[s.key] }}</div>
            </div>
            <ToggleSwitch :model-value="s.value === 1" :disabled="busy" @update:model-value="toggleSetting(s, $event)" />
          </div>
        </div>
      </div>

      <div :class="L.card">
        <div :class="L.cardHeader"><div :class="L.cardTitle"><Settings class="w-4 h-4" /> Seuils et fenêtre de nuit</div></div>
        <p class="text-[12px] text-muted-foreground mb-3">Toute modification s'applique au prochain calcul, sans recalcul rétroactif automatique.</p>
        <div class="flex flex-col gap-2">
          <div v-for="s in numberSettings" :key="s.key" class="flex items-center gap-3">
            <label class="text-[13px] flex-1 min-w-0">{{ s.label }}</label>
            <input v-model.number="s.value" type="number" min="0" step="0.5" :class="cls.fieldInput" class="!w-24 shrink-0" />
            <button :class="L.btnOutline" @click="saveSetting(s)">Enregistrer</button>
          </div>
        </div>
      </div>
      <div :class="L.card">
        <div :class="L.cardHeader"><div :class="L.cardTitle"><Coins class="w-4 h-4" /> Taux de permanence (astreinte)</div></div>
        <p class="text-[12px] text-muted-foreground mb-3">Montants de l'indemnité de permanence (code 2210) utilisés par le calcul de paie, en Ariary.</p>
        <div class="flex flex-col gap-2">
          <div v-for="r in editableRates" :key="r.dayType" class="flex items-center gap-3">
            <label class="text-[13px] flex-1 min-w-0">{{ RATE_LABELS[r.dayType] ?? r.dayType }}</label>
            <input v-model.number="r.amount" type="number" min="0" step="100" :class="cls.fieldInput" class="!w-32 shrink-0" />
            <span class="text-[12px] text-muted-foreground w-6">Ar</span>
            <button :class="L.btnOutline" @click="saveRate(r)">Enregistrer</button>
          </div>
        </div>
      </div>
    </section>

    <FolderPickerModal :open="showPicker" :start-path="cfg?.folderPath" @close="showPicker = false" @select="pickFolder" />

    <!-- Fenetre : type -->
    <ModalShell :open="!!typeForm" title="Modifier le type de présence" max-width="max-w-[520px]" @close="typeForm = null">
      <template v-if="typeForm">
        <div :class="cls.field"><label :class="cls.fieldLabel">Nom</label><input v-model="typeForm.name" :class="cls.fieldInput" maxlength="100" /></div>
        <div :class="cls.field"><label :class="cls.fieldLabel">Description</label><textarea v-model="typeForm.description" :class="cls.fieldTextarea" rows="2" maxlength="300"></textarea></div>
        <div :class="cls.field"><label :class="cls.fieldLabel">Code Sage du type</label><input v-model.number="typeForm.sageTypeCode" type="number" min="0" :class="cls.fieldInput" /></div>
        <p v-if="formError" class="text-[12px] text-danger">{{ formError }}</p>
      </template>
      <template #footer>
        <button :class="L.btnOutline" @click="typeForm = null">Annuler</button>
        <button :class="L.btnPrimary" :disabled="busy" @click="saveType">Enregistrer</button>
      </template>
    </ModalShell>

    <!-- Fenetre : code -->
    <ModalShell :open="!!codeForm" title="Modifier le code" max-width="max-w-[520px]" @close="codeForm = null">
      <template v-if="codeForm">
        <div :class="cls.field">
          <label :class="cls.fieldLabel">Code</label>
          <input v-model="codeForm.code" :class="cls.fieldInput" maxlength="20" :disabled="codeForm.locked" placeholder="ex : PS02" />
          <p v-if="codeForm.locked" class="text-[11px] text-muted-foreground flex items-center gap-1"><Lock class="w-3 h-3" /> Ce code est utilisé par le calcul : son nom ne peut pas changer.</p>
        </div>
        <div :class="cls.field"><label :class="cls.fieldLabel">Description</label><textarea v-model="codeForm.description" :class="cls.fieldTextarea" rows="2" maxlength="300"></textarea></div>
        <p v-if="formError" class="text-[12px] text-danger">{{ formError }}</p>
      </template>
      <template #footer>
        <button v-if="codeForm?.id && !codeForm.locked" :class="L.actReject" class="mr-auto" :disabled="busy" @click="removeCode"><Trash2 class="w-3.5 h-3.5" /> Supprimer</button>
        <button :class="L.btnOutline" @click="codeForm = null">Annuler</button>
        <button :class="L.btnPrimary" :disabled="busy" @click="saveCode">Enregistrer</button>
      </template>
    </ModalShell>
  </div>
</template>

<script setup lang="ts">
/**
 * Configuration du temps de travail (TEMPS_ACCES) : import de la pointeuse
 * Morpho, types et codes de presence (modifiables), reglages du calcul et tarifs
 * de permanence.
 */
import { ref, computed, watch, onMounted } from 'vue'
import { FolderOpen, Folder, Upload, Settings, SlidersHorizontal, Tag, Pencil, Lock, Trash2, Coins, Calculator, UserX, Link2, CircleCheck } from 'lucide-vue-next'
import * as cls from '../../lib/formClasses'
import * as L from '../../lib/listClasses'
import { formatDate } from '../../lib/date'
import { getApiErrorMessage } from '../../lib/api'
import { confirmDialog } from '../../lib/confirm'
import { useToastStore } from '../../stores/toast'
import { useEmployeeStore } from '../../stores/employees'
import { useTimeStore, type MorphoConfig, type MorphoImportSummary, type TimeSetting, type TimeType, type PermanenceRate, type UnmatchedPerson } from '../../stores/time'
import EmployeePicker from '../../components/ui/EmployeePicker.vue'
import TimePager from '../../components/time/TimePager.vue'
import ModalShell from '../../components/ui/ModalShell.vue'
import ToggleSwitch from '../../components/ui/ToggleSwitch.vue'
import FolderPickerModal from '../../components/time/FolderPickerModal.vue'

defineProps<{ embedded?: boolean }>()

const store = useTimeStore()
const toast = useToastStore()
const employeeStore = useEmployeeStore()

const TABS = [
  { key: 'import', label: 'Import pointeuse' },
  { key: 'types', label: 'Types de présence' },
  { key: 'settings', label: 'Réglages' },
] as const
type TabKey = (typeof TABS)[number]['key']
const tab = ref<TabKey>('import')

const IMPORT_STATUS: Record<string, string> = { Pending: 'En attente', Processing: 'En cours', Completed: 'Terminé', Failed: 'Échoué' }
const RATE_LABELS: Record<string, string> = { OUVRABLE: 'Jour ouvrable', SAMEDI: 'Samedi', DIMANCHE_FERIE: 'Dimanche ou férié' }

const busy = ref(false)
const cfg = ref<MorphoConfig | null>(null)
const summaryText = ref('')
const summaryTone = ref('text-muted-foreground')
const types = ref<TimeType[]>([])
const editableSettings = ref<TimeSetting[]>([])
const editableRates = ref<PermanenceRate[]>([])
const formError = ref('')
const showPicker = ref(false)

// Reglages 0/1 : affiches en interrupteurs (le libelle d'origine disait "1 = oui").
const TOGGLE_KEYS = ['deduct_break', 'include_non_working_days']
const TOGGLE_HINTS: Record<string, string> = {
  deduct_break: "Soustrait la durée de la pause de l'horaire du temps travaillé.",
  include_non_working_days: 'Un jour sans horaire prévu mais pointé (le dimanche par exemple) est compté.',
}
const toggleSettings = computed(() => editableSettings.value
  .filter(s => TOGGLE_KEYS.includes(s.key))
  .map(s => ({ ...s, label: s.label.replace(/\s*\(1 = oui\)/i, '') })))
const numberSettings = computed(() => editableSettings.value.filter(s => !TOGGLE_KEYS.includes(s.key) && s.key !== METHOD_KEY))

// Methode de calcul des heures supplementaires : 0 journalier, 1 hebdomadaire, 2 les deux.
const METHOD_KEY = 'overtime_method'
const METHOD_OPTIONS = [
  { value: 0, label: 'Journalière', hint: "Chaque jour est comparé à son horaire prévu : l'excédent du jour est une heure supplémentaire, datée du jour travaillé." },
  { value: 1, label: 'Hebdomadaire', hint: "Seul compte le cumul de la semaine au-delà de 40 h (hors dimanche, férié et nuit). Ligne datée du dimanche de fin de semaine." },
  { value: 2, label: 'Les deux', hint: 'Les deux méthodes sont proposées : la méthode se choisit à chaque calcul dans Export paie.' },
]
const methodSetting = computed(() => {
  const s = editableSettings.value.find(x => x.key === METHOD_KEY)
  return s ? s : null
})
async function chooseMethod(value: number) {
  const r = await run('Enregistrement...', () => store.saveSetting(METHOD_KEY, value), 'Enregistrement impossible')
  if (r.ok) {
    const target = editableSettings.value.find(x => x.key === METHOD_KEY)
    if (target) target.value = value
  }
}

async function run<T>(label: string, action: () => Promise<T>, fallback: string): Promise<{ ok: boolean; result?: T; message?: string }> {
  busy.value = true
  toast.loading(label)
  try {
    const result = await action()
    toast.success('Effectué avec succès')
    return { ok: true, result }
  } catch (e) {
    const message = getApiErrorMessage(e, fallback)
    toast.error(message)
    return { ok: false, message }
  } finally {
    busy.value = false
  }
}

async function selectTab(key: TabKey) {
  tab.value = key
  if (key === 'import') {
    await Promise.all([store.fetchConfig().then(() => (cfg.value = store.config && { ...store.config })), store.fetchImports(), loadUnmatched()])
    if (employeeStore.directory.length === 0) employeeStore.fetchDirectory().catch(() => {})
  }
  if (key === 'types') types.value = await store.fetchTypes()
  if (key === 'settings') {
    await store.fetchSettings()
    editableSettings.value = store.settings.map((s) => ({ ...s }))
    editableRates.value = store.rates.map((r) => ({ ...r }))
  }
}
onMounted(() => selectTab('import'))

// ── Import ──
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
  if (r.ok) { showSummary(r.result as MorphoImportSummary); await loadUnmatched() }
}
async function importFile(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const r = await run('Import du fichier...', () => store.importFile(file), 'Import impossible')
  if (r.ok) { showSummary(r.result as MorphoImportSummary); await loadUnmatched() }
  input.value = ''
}
async function rematch() {
  const r = await run('Rattachement...', () => store.rematch(), 'Rattachement impossible')
  if (r.ok) {
    const res = r.result as { matched: number; stillUnmatched: number }
    summaryText.value = `${res.matched} pointage(s) rattaché(s), ${res.stillUnmatched} toujours sans employé.`
    summaryTone.value = res.stillUnmatched > 0 ? 'text-warning' : 'text-success'
    await loadUnmatched()
  }
}

// ── Pointages sans employé : rattachement manuel d'une personne de la pointeuse ──
const unmatched = ref<UnmatchedPerson[]>([])
const linking = ref<{ person: UnmatchedPerson; employeeId: string } | null>(null)
const unmatchedSearch = ref('')
const unmatchedPageNo = ref(1)
const unmatchedPageSize = ref(10)
const unmatchedFiltered = computed(() => {
  const q = unmatchedSearch.value.trim().toLowerCase()
  if (!q) return unmatched.value
  return unmatched.value.filter(p => `${p.lastName} ${p.firstName} ${p.employeeNumber}`.toLowerCase().includes(q))
})
const unmatchedPage = computed(() => unmatchedFiltered.value.slice((unmatchedPageNo.value - 1) * unmatchedPageSize.value, unmatchedPageNo.value * unmatchedPageSize.value))
watch([unmatchedSearch, unmatchedPageSize], () => { unmatchedPageNo.value = 1 })
const employeeItems = computed(() =>
  employeeStore.directory.filter(e => e.status !== 'inactive').map(e => ({ id: e.id, label: e.name, sublabel: e.entityName, code: e.code })),
)
async function loadUnmatched() {
  try { unmatched.value = await store.fetchUnmatchedPeople() } catch { unmatched.value = [] }
}
function openLink(person: UnmatchedPerson) {
  linking.value = { person, employeeId: '' }
}
async function saveLink() {
  const l = linking.value
  if (!l?.employeeId) return
  const r = await run('Rattachement...', () => store.linkPerson(l.person.biometricUuid, l.employeeId), 'Rattachement impossible')
  if (r.ok) {
    const res = r.result as { matched: number; stillUnmatched: number }
    summaryText.value = `${res.matched} pointage(s) rattaché(s) à l'employé, ${res.stillUnmatched} toujours sans employé.`
    summaryTone.value = res.stillUnmatched > 0 ? 'text-warning' : 'text-success'
    linking.value = null
    await loadUnmatched()
  }
}

// ── Types et codes ──
const typeForm = ref<{ id: string; name: string; description: string; sageTypeCode: number | null } | null>(null)
const codeForm = ref<{ typeId: string; id: string | null; code: string; description: string; locked: boolean } | null>(null)

function openType(t: TimeType) {
  formError.value = ''
  typeForm.value = { id: t.id, name: t.name, description: t.description ?? '', sageTypeCode: t.sageTypeCode }
}
function openCode(t: TimeType, c: TimeType['codes'][number]) {
  formError.value = ''
  codeForm.value = { typeId: t.id, id: c.id, code: c.code, description: c.description ?? '', locked: c.locked }
}
async function saveType() {
  const f = typeForm.value
  if (!f) return
  if (f.name.trim().length < 2) { formError.value = 'Le nom est obligatoire.'; return }
  const r = await run('Enregistrement...', () => store.updateType(f.id, { Name: f.name.trim(), Description: f.description, SageTypeCode: f.sageTypeCode ?? undefined }), 'Enregistrement impossible')
  if (!r.ok) { formError.value = r.message ?? ''; return }
  typeForm.value = null
  types.value = await store.fetchTypes()
}
async function saveCode() {
  const f = codeForm.value
  if (!f) return
  if (!f.locked && !f.code.trim()) { formError.value = 'Le code est obligatoire.'; return }
  const r = await run(
    'Enregistrement...',
    () => store.updateCode(f.id!, { ...(f.locked ? {} : { Code: f.code.trim() }), Description: f.description }),
    'Enregistrement impossible',
  )
  if (!r.ok) { formError.value = r.message ?? ''; return }
  codeForm.value = null
  types.value = await store.fetchTypes()
}
async function removeCode() {
  const f = codeForm.value
  if (!f?.id) return
  if (!(await confirmDialog(`Supprimer le code ${f.code} ?`))) return
  const r = await run('Suppression...', () => store.deleteCode(f.id!), 'Suppression impossible')
  if (!r.ok) { formError.value = r.message ?? ''; return }
  codeForm.value = null
  types.value = await store.fetchTypes()
}

// ── Reglages ──
async function toggleSetting(s: TimeSetting, on: boolean) {
  const value = on ? 1 : 0
  const r = await run('Enregistrement...', () => store.saveSetting(s.key, value), 'Enregistrement impossible')
  if (r.ok) {
    const target = editableSettings.value.find(x => x.key === s.key)
    if (target) target.value = value
  }
}
function pickFolder(path: string) {
  if (cfg.value) cfg.value.folderPath = path
  showPicker.value = false
}
async function saveSetting(s: TimeSetting) {
  await run('Enregistrement...', () => store.saveSetting(s.key, s.value), 'Enregistrement impossible')
}
async function saveRate(r: PermanenceRate) {
  await run('Enregistrement...', () => store.saveRate(r.dayType, r.amount), 'Enregistrement impossible')
}
</script>
