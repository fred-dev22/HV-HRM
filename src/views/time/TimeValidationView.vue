<template>
  <ListPageLayout
    :embedded="embedded"
    title="Validation des saisies de temps"
    subtitle="Les saisies en attente de votre décision, et celles que vous avez déjà traitées."
    :columns="columns"
    :items="rows"
    :total="counts[tab]"
    :total-text="`${counts[tab]} saisie(s)`"
    :loading="loading"
    row-key="id"
    search-placeholder="Rechercher un employé, un matricule..."
    scope-label="Saisies :"
    :scope-options="tabScopes"
    :storage-key="`time-validation-${auth.user?.id ?? ''}`"
    v-model:scope="tab"
    v-model:search-query="search"
    v-model:page="page"
    v-model:page-size="pageSize"
    @reset-filters="resetFilters"
    @open-card="(item) => openCard(item)"
  >
    <!-- Résumé -->
    <template #above-table>
      <div class="grid grid-cols-3 gap-2.5 mb-3.5 max-md:grid-cols-1">
        <div v-for="k in kpis" :key="k.label" :class="kpiItem">
          <div :class="kpiIcon" :style="{ background: k.bg }"><component :is="k.icon" class="w-[18px] h-[18px]" :style="{ color: k.color }" /></div>
          <div><div :class="kpiVal">{{ k.value }}</div><div :class="kpiLbl">{{ k.label }}</div></div>
        </div>
      </div>
    </template>

    <!-- Actions sur la ligne sélectionnée -->
    <template #row-actions="{ item }">
      <template v-if="tab === 'pending'">
        <button :class="L.actApprove" :disabled="busy" @click="approve(item)"><Check class="w-3.5 h-3.5" /> Approuver</button>
        <button :class="L.actReject" :disabled="busy" @click="rejecting = item"><X class="w-3.5 h-3.5" /> Rejeter</button>
      </template>
      <button :class="quickBtn" @click="openCard(item)">Détails</button>
      <button v-if="isHr && (item.status === 'Pending' || item.status === 'Rejected')" :class="quickBtn" @click="openCard(item, true)">Modifier</button>
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
    <template #cell-hours="{ item }"><span class="font-medium whitespace-nowrap">{{ formatHours(item.hours) }}</span></template>
    <template #cell-clocks="{ item }">
      <div class="whitespace-nowrap text-[12px]">
        <div>Entrée : {{ clock(item.clockIn) }}</div>
        <div class="text-muted-foreground">Sortie : {{ clock(item.clockOut) }}</div>
      </div>
    </template>
    <template #cell-comment="{ item }">
      <span class="text-muted-foreground block max-w-[220px] truncate" :title="item.rejectionReason || item.comments || ''">{{ item.status === 'Rejected' && item.rejectionReason ? `Refusée : ${item.rejectionReason}` : item.comments || '-' }}</span>
    </template>
    <template #cell-status="{ item }"><StatusPill :status="item.status" /></template>

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
          <div><div class="text-muted-foreground text-[11px]">Saisie par</div>{{ item.submittedByName || '-' }}</div>
        </div>
        <div v-if="item.comments" class="text-[12px]"><div class="text-muted-foreground text-[11px]">Commentaire</div>{{ item.comments }}</div>
        <div v-if="item.status === 'Rejected' && item.rejectionReason" class="text-[12px] text-danger"><div class="text-[11px] font-medium">Motif du refus</div>{{ item.rejectionReason }}</div>
        <button :class="L.btnPrimary" class="w-full justify-center" @click="openCard(item)">Ouvrir la fiche</button>
        <template v-if="tab === 'pending'">
          <button :class="L.actApprove" class="w-full justify-center" :disabled="busy" @click="approve(item)"><Check class="w-3.5 h-3.5" /> Approuver</button>
          <button :class="L.actReject" class="w-full justify-center" :disabled="busy" @click="rejecting = item"><X class="w-3.5 h-3.5" /> Rejeter</button>
        </template>
      </div>
    </template>

    <template #empty>
      <ClipboardCheck class="w-8 h-8" />
      <p class="text-[13px]">{{ tab === 'pending' ? 'Aucune saisie en attente.' : 'Aucune saisie traitée.' }}</p>
    </template>

    <TimeRejectModal :open="!!rejecting" @close="rejecting = null" @confirm="confirmReject" />
    <TimeEntryCard v-if="openId" :entries="rows" :entry-id="openId" :is-hr="isHr" allow-decision :start-in-edit="startInEdit" @close="openId = null" @changed="load" />
  </ListPageLayout>
</template>

<script setup lang="ts">
/**
 * Validation des saisies de temps, sur la liste standard du HRM : scope En
 * attente / Traitees, approbation ou refus (motif obligatoire) sur la ligne
 * selectionnee, fiche (avec decision possible) et modification par le RH.
 */
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { Check, X, ClipboardCheck, Hourglass, Clock, CircleCheck } from 'lucide-vue-next'
import { StatusPill, UserAvatar, ListPageLayout } from '../../components'
import type { ListColumn } from '../../components/shared/ListPageLayout.vue'
import TimeEntryCard from '../../components/time/TimeEntryCard.vue'
import TimeRejectModal from '../../components/time/TimeRejectModal.vue'
import * as L from '../../lib/listClasses'
import { formatDate } from '../../lib/date'
import { getApiErrorMessage } from '../../lib/api'
import { useAuthStore } from '../../stores/auth'
import { useToastStore } from '../../stores/toast'
import { useTimeStore, ENTRY_TYPE_LABELS, type TimeEntry, type TimeEntryType } from '../../stores/time'
import { clock, formatHours } from '../../components/time/timeFormat'

defineProps<{ embedded?: boolean }>()

const auth = useAuthStore()
const store = useTimeStore()
const toast = useToastStore()
const isHr = computed(() => auth.hasPermission('TEMPS_ACCES'))

type TabKey = 'pending' | 'processed'
const tab = ref<TabKey>('pending')
const rows = ref<TimeEntry[]>([])
const counts = ref<Record<TabKey, number>>({ pending: 0, processed: 0 })
const pendingHours = ref(0)
const loading = ref(false)
const busy = ref(false)
const page = ref(1)
const pageSize = ref(10)
const search = ref('')
const debouncedSearch = ref('')
const entryType = ref('')
const from = ref('')
const to = ref('')

const quickBtn = 'px-2.5 py-[5px] rounded text-xs font-medium cursor-pointer bg-background text-muted-foreground hover:text-foreground'
const kpiItem = 'bg-card border border-border rounded-lg px-3.5 py-3 flex items-center gap-3'
const kpiIcon = 'w-9 h-9 rounded-lg flex items-center justify-center shrink-0'
const kpiVal = 'text-[22px] font-bold leading-none'
const kpiLbl = 'text-xs text-muted-foreground mt-0.5'

const columns: ListColumn[] = [
  { key: 'employee', label: 'Employé', hideable: false, width: 220 },
  { key: 'date', label: 'Date', width: 120 },
  { key: 'type', label: 'Type', width: 160 },
  { key: 'hours', label: 'Heures', width: 100 },
  { key: 'clocks', label: 'Pointages', width: 150 },
  { key: 'comment', label: 'Commentaire', width: 240 },
  { key: 'status', label: 'Statut', width: 130 },
]
const tabScopes = computed(() => [
  { value: 'pending', label: `En attente (${counts.value.pending})` },
  { value: 'processed', label: `Traitées (${counts.value.processed})` },
])

let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, (v) => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { debouncedSearch.value = v }, 300) })
onBeforeUnmount(() => clearTimeout(searchTimer))
watch([tab, debouncedSearch, entryType, from, to, pageSize], () => { page.value = 1 })

function resetFilters() {
  search.value = ''; debouncedSearch.value = ''; entryType.value = ''; from.value = ''; to.value = ''; page.value = 1
}

let seq = 0
async function load() {
  const mine = ++seq
  loading.value = true
  try {
    const q = { Search: debouncedSearch.value, EntryType: entryType.value, From: from.value, To: to.value }
    // La page affichee + le compte de l'autre scope (un Limit de 1 suffit pour son total).
    const other: TabKey = tab.value === 'pending' ? 'processed' : 'pending'
    const [current, side] = await Promise.all([
      store.fetchEntriesPage(tab.value, { ...q, Page: page.value, Limit: pageSize.value }),
      store.fetchEntriesPage(other, { ...q, Page: 1, Limit: 1 }),
    ])
    if (mine !== seq) return
    rows.value = current.items
    counts.value = { [tab.value]: current.total, [other]: side.total } as Record<TabKey, number>
    pendingHours.value = tab.value === 'pending' ? current.hours : side.hours
  } catch (e) {
    if (mine === seq) toast.error(getApiErrorMessage(e, 'Chargement des saisies impossible'))
  } finally {
    if (mine === seq) loading.value = false
  }
}
watch([tab, debouncedSearch, entryType, from, to, page, pageSize], load, { immediate: true })

const kpis = computed(() => [
  { label: 'En attente', value: counts.value.pending, icon: Hourglass, bg: 'var(--color-warning-bg)', color: 'var(--color-warning)' },
  { label: 'Heures à valider', value: formatHours(pendingHours.value), icon: Clock, bg: 'var(--color-info-bg)', color: 'var(--color-info)' },
  { label: 'Déjà traitées', value: counts.value.processed, icon: CircleCheck, bg: 'var(--color-success-bg)', color: 'var(--color-success)' },
])

// ── Decisions ──
const openId = ref<string | null>(null)
const startInEdit = ref(false)
const rejecting = ref<TimeEntry | null>(null)

function openCard(item: TimeEntry, edit = false) { startInEdit.value = edit; openId.value = item.id }

async function decide(action: () => Promise<unknown>, label: string) {
  busy.value = true
  toast.loading(label)
  try {
    await action()
    toast.success('Effectué avec succès')
    await load()
  } catch (e) {
    toast.error(getApiErrorMessage(e, 'Décision impossible'))
  } finally {
    busy.value = false
  }
}
const approve = (e: TimeEntry) => decide(() => store.approve(e.id), 'Approbation...')
async function confirmReject(reason: string) {
  const e = rejecting.value
  rejecting.value = null
  if (e) await decide(() => store.reject(e.id, reason), 'Refus...')
}
</script>
