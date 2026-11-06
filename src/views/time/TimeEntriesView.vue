<template>
  <ListPageLayout
    :embedded="embedded"
    title="Saisies manuelles"
    :subtitle="subtitle"
    :columns="columns"
    :items="rows"
    :total="total"
    :total-text="`${total} saisie(s)`"
    :loading="loading"
    row-key="id"
    search-placeholder="Rechercher un employé, un matricule..."
    scope-label="Saisies :"
    :scope-options="statusScopes"
    :storage-key="`time-entries-${auth.user?.id ?? ''}`"
    v-model:scope="status"
    v-model:search-query="search"
    v-model:page="page"
    v-model:page-size="pageSize"
    @reset-filters="resetFilters"
    @open-card="openCard"
  >
    <template #header-actions>
      <div class="flex items-center gap-2">
        <button :class="L.btnOutline" :disabled="exporting" @click="exportReport"><FileDown class="w-4 h-4" /> Rapport</button>
        <button v-if="isHr" :class="L.btnOutline" @click="showImport = true"><Upload class="w-4 h-4" /> Importer</button>
        <button :class="L.btnPrimary" @click="showCreate = true"><Plus class="w-4 h-4" /> Nouvelle saisie</button>
      </div>
    </template>

    <!-- Résumé -->
    <template #above-table>
      <div class="grid grid-cols-4 gap-2.5 mb-3.5 max-md:grid-cols-2">
        <div v-for="k in kpis" :key="k.label" :class="kpiItem">
          <div :class="kpiIcon" :style="{ background: k.bg }"><component :is="k.icon" class="w-[18px] h-[18px]" :style="{ color: k.color }" /></div>
          <div><div :class="kpiVal">{{ k.value }}</div><div :class="kpiLbl">{{ k.label }}</div></div>
        </div>
      </div>
    </template>

    <!-- Actions sur la ligne sélectionnée -->
    <template #row-actions="{ item }">
      <button :class="quickBtn" @click="openCard(item)">Ouvrir la fiche</button>
      <button v-if="canEdit(item)" :class="quickBtn" @click="openCard(item, true)">Modifier</button>
      <button v-if="canCancel(item)" :class="L.actReject" @click="cancel(item)">Annuler</button>
    </template>

    <!-- Filtres -->
    <template #filters>
      <div :class="L.fpField">
        <label :class="L.fpFieldLabel">Type de saisie</label>
        <select v-model="entryType" :class="L.fpSelect">
          <option value="">Tous les types</option>
          <option v-for="(label, key) in ENTRY_TYPE_LABELS" :key="key" :value="key">{{ label }}</option>
        </select>
      </div>
      <div :class="L.fpField">
        <label :class="L.fpFieldLabel">Du</label>
        <input v-model="from" type="date" :class="L.fpSelect" />
      </div>
      <div :class="L.fpField">
        <label :class="L.fpFieldLabel">Au</label>
        <input v-model="to" type="date" :class="L.fpSelect" :min="from" />
      </div>
      <button class="mt-auto py-[7px] bg-transparent border-0 text-xs text-muted-foreground cursor-pointer text-left hover:text-primary" @click="resetFilters">Réinitialiser les filtres</button>
    </template>

    <!-- Cellules -->
    <template #cell-employee="{ item }">
      <div class="flex items-center gap-2">
        <UserAvatar :name="item.employeeName" size="sm" />
        <div class="min-w-0">
          <div class="font-medium whitespace-nowrap">{{ item.employeeName }}</div>
          <div class="text-[10px] text-muted-foreground">{{ item.employeeNumber }}</div>
        </div>
      </div>
    </template>
    <template #cell-date="{ item }"><span class="whitespace-nowrap">{{ formatDate(item.date) }}</span></template>
    <template #cell-type="{ item }"><span class="text-muted-foreground whitespace-nowrap">{{ item.entryType ? ENTRY_TYPE_LABELS[item.entryType as TimeEntryType] : '-' }}</span></template>
    <template #cell-in="{ item }">{{ clock(item.clockIn) }}</template>
    <template #cell-out="{ item }">{{ clock(item.clockOut) }}</template>
    <template #cell-hours="{ item }"><span class="font-medium whitespace-nowrap">{{ formatHours(item.hours) }}</span></template>
    <template #cell-status="{ item }"><StatusPill :status="item.status" /></template>
    <template #cell-created="{ item }"><span class="text-muted-foreground whitespace-nowrap text-[11px]">{{ formatDate(item.createdAt) }}</span></template>

    <!-- Aperçu rapide -->
    <template #details-panel="{ item }">
      <div class="flex flex-col gap-3.5">
        <div class="flex items-center gap-2.5">
          <UserAvatar :name="item.employeeName" size="md" />
          <div class="min-w-0">
            <div class="text-sm font-semibold text-foreground truncate">{{ item.employeeName }}</div>
            <div class="text-[11px] text-muted-foreground">{{ item.employeeNumber }}</div>
          </div>
        </div>
        <div><StatusPill :status="item.status" /></div>
        <div class="grid grid-cols-2 gap-2 text-[12px]">
          <div><div class="text-muted-foreground text-[11px]">Date</div>{{ formatDate(item.date) }}</div>
          <div><div class="text-muted-foreground text-[11px]">Type</div>{{ item.entryType ? ENTRY_TYPE_LABELS[item.entryType as TimeEntryType] : '-' }}</div>
          <div><div class="text-muted-foreground text-[11px]">Entrée</div>{{ clock(item.clockIn) }}</div>
          <div><div class="text-muted-foreground text-[11px]">Sortie</div>{{ clock(item.clockOut) }}</div>
          <div><div class="text-muted-foreground text-[11px]">Durée</div>{{ formatHours(item.hours) }}</div>
          <div><div class="text-muted-foreground text-[11px]">Saisie le</div>{{ formatDate(item.createdAt) }}</div>
        </div>
        <div v-if="item.comments" class="text-[12px]"><div class="text-muted-foreground text-[11px]">Commentaire</div>{{ item.comments }}</div>
        <div v-if="item.status === 'Rejected' && item.rejectionReason" class="text-[12px] text-danger"><div class="text-[11px] font-medium">Motif du refus</div>{{ item.rejectionReason }}</div>
        <button :class="L.btnPrimary" class="w-full justify-center" @click="openCard(item)">Ouvrir la fiche</button>
      </div>
    </template>

    <template #empty>
      <Clock class="w-8 h-8" />
      <p class="text-[13px]">Aucune saisie de temps.</p>
    </template>

    <TimeEntryCreate v-if="showCreate" @close="showCreate = false" @saved="load" />
    <ImportWizardModal v-if="showImport" :open="showImport" :config="importConfig" @close="showImport = false" @imported="load" />
    <TimeEntryCard v-if="openId" :entries="rows" :entry-id="openId" :is-hr="isHr" :start-in-edit="startInEdit" @close="openId = null" @changed="load" />
  </ListPageLayout>
</template>

<script setup lang="ts">
/**
 * Saisies manuelles de temps, sur la liste standard du HRM (barre d'outils,
 * filtres, colonnes, apercu, pagination faite par le serveur) : toutes les
 * saisies pour le RH, les siennes sinon. Creation, fiche, modification,
 * annulation et rapport CSV.
 */
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { Plus, FileDown, Upload, Clock, ListChecks, Hourglass, CircleCheck } from 'lucide-vue-next'
import { StatusPill, UserAvatar, ListPageLayout } from '../../components'
import type { ListColumn } from '../../components/shared/ListPageLayout.vue'
import TimeEntryCreate from '../../components/time/TimeEntryCreate.vue'
import TimeEntryCard from '../../components/time/TimeEntryCard.vue'
import ImportWizardModal from '../../components/shared/import/ImportWizardModal.vue'
import { buildTimeEntryImportConfig } from '../../components/shared/import/configs/timeEntryImportConfig'
import * as L from '../../lib/listClasses'
import { formatDate } from '../../lib/date'
import { getApiErrorMessage } from '../../lib/api'
import { confirmDialog } from '../../lib/confirm'
import { useAuthStore } from '../../stores/auth'
import { useToastStore } from '../../stores/toast'
import { useTimeStore, ENTRY_TYPE_LABELS, ENTRY_STATUS_LABELS, type TimeEntry, type TimeEntryType, type TimeEntryQuery, type TimeEntriesSummary } from '../../stores/time'
import { clock, formatHours, downloadCsv } from '../../components/time/timeFormat'

defineProps<{ embedded?: boolean }>()

const auth = useAuthStore()
const store = useTimeStore()
const toast = useToastStore()

const isHr = computed(() => auth.hasPermission('TEMPS_ACCES'))
const kind = computed<'all' | 'mine'>(() => (isHr.value ? 'all' : 'mine'))
const subtitle = computed(() => (isHr.value
  ? 'Toutes les saisies de temps. Vous pouvez saisir pour un autre employé.'
  : 'Vos saisies de temps, validées par votre validateur. Saisie possible jusqu\'à la fin du mois concerné.'))

const quickBtn = 'px-2.5 py-[5px] rounded text-xs font-medium cursor-pointer bg-background text-muted-foreground hover:text-foreground'
const kpiItem = 'bg-card border border-border rounded-lg px-3.5 py-3 flex items-center gap-3'
const kpiIcon = 'w-9 h-9 rounded-lg flex items-center justify-center shrink-0'
const kpiVal = 'text-[22px] font-bold leading-none'
const kpiLbl = 'text-xs text-muted-foreground mt-0.5'

const columns: ListColumn[] = [
  { key: 'employee', label: 'Employé', hideable: false, width: 220 },
  { key: 'date', label: 'Date', width: 120 },
  { key: 'type', label: 'Type', width: 160 },
  { key: 'in', label: 'Entrée', width: 90 },
  { key: 'out', label: 'Sortie', width: 90 },
  { key: 'hours', label: 'Durée', width: 100 },
  { key: 'status', label: 'Statut', width: 130 },
  { key: 'created', label: 'Saisie le', width: 120, defaultHidden: true },
]
const statusScopes = [{ value: '', label: 'Toutes' }, ...Object.entries(ENTRY_STATUS_LABELS).map(([value, label]) => ({ value, label }))]

const rows = ref<TimeEntry[]>([])
const total = ref(0)
const summary = ref<TimeEntriesSummary | null>(null)
const loading = ref(false)
const exporting = ref(false)

const search = ref('')
const debouncedSearch = ref('')
const status = ref('')
const entryType = ref('')
const from = ref('')
const to = ref('')
const page = ref(1)
const pageSize = ref(10)

let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, (v) => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { debouncedSearch.value = v }, 300) })
onBeforeUnmount(() => clearTimeout(searchTimer))
// Tout changement de filtre ramene a la premiere page.
watch([debouncedSearch, status, entryType, from, to, pageSize], () => { page.value = 1 })

function resetFilters() {
  search.value = ''; debouncedSearch.value = ''; status.value = ''; entryType.value = ''; from.value = ''; to.value = ''; page.value = 1
}

const query = computed<TimeEntryQuery>(() => ({
  Search: debouncedSearch.value, Status: status.value, EntryType: entryType.value, From: from.value, To: to.value,
}))

let seq = 0
let lastKey = ''
async function load() {
  const mine = ++seq
  // Derniere lecture gardee pour les memes criteres : affichee tout de suite, sans indicateur
  // de chargement, puis TOUJOURS relue en arriere-plan (donnees exactes).
  const key = 'entries:' + JSON.stringify([kind.value, query.value, page.value, pageSize.value])
  const cached = store.getCached<{ list: { items: TimeEntry[]; total: number }; sum: TimeEntriesSummary }>(key)
  if (cached) {
    rows.value = cached.list.items
    total.value = cached.list.total
    summary.value = cached.sum
  }
  loading.value = !cached && key !== lastKey
  try {
    const [list, sum] = await Promise.all([
      store.fetchEntriesPage(kind.value, { ...query.value, Page: page.value, Limit: pageSize.value }),
      store.fetchEntriesSummary(query.value),
    ])
    if (mine !== seq) return
    rows.value = list.items
    total.value = list.total
    summary.value = sum
    store.setCached(key, { list, sum })
    lastKey = key
  } catch (e) {
    if (mine === seq) toast.error(getApiErrorMessage(e, 'Chargement des saisies impossible'))
  } finally {
    if (mine === seq) loading.value = false
  }
}
watch([query, page, pageSize, kind], load, { immediate: true })

const kpis = computed(() => [
  { label: 'Total entrées', value: summary.value?.total ?? 0, icon: ListChecks, bg: 'var(--color-success-bg)', color: 'var(--color-success)' },
  { label: 'En attente', value: summary.value?.pending ?? 0, icon: Hourglass, bg: 'var(--color-warning-bg)', color: 'var(--color-warning)' },
  { label: 'Approuvées', value: summary.value?.approved ?? 0, icon: CircleCheck, bg: 'var(--color-success-bg)', color: 'var(--color-success)' },
  { label: 'Heures totales', value: formatHours(summary.value?.hours ?? 0), icon: Clock, bg: 'var(--color-info-bg)', color: 'var(--color-info)' },
])

// ── Actions ──
const showCreate = ref(false)
const showImport = ref(false)
const importConfig = computed(() => buildTimeEntryImportConfig())
const openId = ref<string | null>(null)
const startInEdit = ref(false)

function openCard(item: TimeEntry, edit = false) { startInEdit.value = edit; openId.value = item.id }

// Une saisie en attente ou refusee reste modifiable (elle repart dans le circuit).
const canEdit = (e: TimeEntry) => e.status === 'Pending' || e.status === 'Rejected'
const canCancel = (e: TimeEntry) => e.status === 'Pending'

async function cancel(e: TimeEntry) {
  if (!(await confirmDialog(`Annuler la saisie du ${formatDate(e.date)} (${e.employeeName}) ?`))) return
  toast.loading('Annulation...')
  try {
    await store.cancel(e.id)
    toast.success('Effectué avec succès')
    await load()
  } catch (err) {
    toast.error(getApiErrorMessage(err, 'Annulation impossible'))
  }
}

// Rapport : toutes les saisies correspondant aux filtres (pas seulement la page).
async function exportReport() {
  exporting.value = true
  try {
    const out: (string | number)[][] = []
    for (let p = 1; p <= 50; p++) {
      const res = await store.fetchEntriesPage(kind.value, { ...query.value, Page: p, Limit: 200 })
      for (const e of res.items) {
        out.push([e.employeeNumber, e.employeeName, e.date, e.entryType ? ENTRY_TYPE_LABELS[e.entryType] : '', clock(e.clockIn), clock(e.clockOut), e.hours, ENTRY_STATUS_LABELS[e.status], e.comments ?? ''])
      }
      if (out.length >= res.total || res.items.length === 0) break
    }
    downloadCsv('saisies-manuelles.csv', ['Matricule', 'Employé', 'Date', 'Type', 'Entrée', 'Sortie', 'Heures', 'Statut', 'Commentaire'], out)
  } catch (err) {
    toast.error(getApiErrorMessage(err, 'Export impossible'))
  } finally {
    exporting.value = false
  }
}
</script>
