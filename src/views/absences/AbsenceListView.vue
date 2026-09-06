<template>
  <ListPageLayout
    :title="t('absence.title')"
    :subtitle="`${t('absence.total', { count: totalCount })} · ${pendingCount} ${t('dashboard.pending').toLowerCase()}`"
    :columns="columns"
    :items="pageItems"
    :total="totalCount"
    :total-text="t('absence.total', { count: totalCount })"
    :search-placeholder="t('topbar.search_placeholder')"
    :scope-label="t('absence.scope_label')"
    :scope-options="filterPresets"
    :loading="store.loading"
    v-model:scope="activePreset"
    v-model:search-query="searchQuery"
    v-model:sort-key="sortKey"
    v-model:sort-dir="sortDir"
    v-model:page="page"
    v-model:page-size="pageSize"
    @reset-filters="resetFilters"
    @open-card="openCard"
  >
    <!-- Bouton "Nouvelle demande" -->
    <template #header-actions>
      <button :class="L.btnPrimary" @click="showCreate = true">
        <Plus class="w-4 h-4" /> {{ t('dashboard.new_request') }}
      </button>
    </template>

    <!-- Actions contextuelles (ligne sélectionnée) -->
    <template #row-actions="{ item }">
      <AbsenceWorkflowActions v-if="isActionable(item)" :leave="item" />
      <button v-else :class="quickBtn" @click="openCard(item)">Ouvrir la fiche</button>
    </template>

    <!-- Panneau de filtres -->
    <template #filters>
      <div class="flex flex-col gap-px">
        <div
          v-for="p in filterPresets" :key="p.value"
          class="text-[13px] text-foreground px-2 py-1.5 rounded-md cursor-pointer hover:bg-background"
          :class="{ '!text-primary font-medium bg-primary/10': activePreset === p.value }"
          @click="activePreset = p.value"
        >{{ p.label }}</div>
      </div>
      <div class="text-[11px] text-muted-foreground font-medium mt-1">{{ t('absence.filters.filter_by') }}</div>
      <div :class="L.fpField">
        <label :class="L.fpFieldLabel">{{ t('absence.fields.type') }}</label>
        <select v-model="filterType" :class="L.fpSelect">
          <option value="">{{ t('absence.filters.all_types') }}</option>
          <option v-for="lt in leaveTypesStore.leaveTypes" :key="lt.id" :value="lt.id">{{ lt.name }}</option>
        </select>
      </div>
      <div :class="L.fpField">
        <label :class="L.fpFieldLabel">{{ t('absence.filters.from') }}</label>
        <input type="date" v-model="filterFrom" :class="L.fpSelect" />
      </div>
      <div :class="L.fpField">
        <label :class="L.fpFieldLabel">{{ t('absence.filters.to') }}</label>
        <input type="date" v-model="filterTo" :class="L.fpSelect" :min="filterFrom" />
      </div>
      <button class="mt-auto py-[7px] bg-transparent border-0 text-xs text-muted-foreground cursor-pointer text-left hover:text-primary" @click="resetFilters">
        {{ t('absence.actions.reset_filters') }}
      </button>
    </template>

    <!-- Cellules -->
    <template #cell-employee="{ item: r }">
      <div class="flex items-center gap-2">
        <UserAvatar :name="r.employeeName" size="sm" />
        <div class="min-w-0">
          <div class="font-medium whitespace-nowrap">{{ r.employeeName }}</div>
          <div v-if="r.createdByName && r.createdByName !== r.employeeName" class="text-[10px] text-muted-foreground truncate">
            Créé par {{ r.createdByName }}
          </div>
        </div>
      </div>
    </template>
    <template #cell-type="{ item: r }">
      <span class="text-muted-foreground whitespace-nowrap">{{ r.leaveTypeName }}</span>
    </template>
    <template #cell-dates="{ item: r }">
      <span class="whitespace-nowrap text-[11px]">{{ formatDate(r.startDate) }} → {{ formatDate(r.endDate) }}</span>
    </template>
    <template #cell-days="{ item: r }">
      <span class="font-medium whitespace-nowrap">{{ r.daysCount }}j</span>
    </template>
    <template #cell-submitted="{ item: r }">
      <span class="text-muted-foreground whitespace-nowrap text-[11px]">{{ formatDate(r.createdAt) }}</span>
    </template>
    <template #cell-status="{ item: r }">
      <StatusPill :status="r.status" />
    </template>

    <!-- Aperçu rapide -->
    <template #details-panel="{ item: r }">
      <div class="flex flex-col gap-3.5">
        <div class="flex items-center gap-2.5">
          <UserAvatar :name="r.employeeName" size="md" />
          <div class="min-w-0">
            <div class="text-sm font-semibold text-foreground truncate">{{ r.employeeName }}</div>
            <div class="text-[11px] text-muted-foreground">{{ r.leaveTypeName }}</div>
          </div>
        </div>
        <div><StatusPill :status="r.status" /></div>
        <div v-if="r.createdByName && r.createdByName !== r.employeeName" class="text-[12px]">
          <div class="text-muted-foreground text-[11px]">Créé par</div>{{ r.createdByName }}
        </div>
        <div class="grid grid-cols-2 gap-2 text-[12px]">
          <div><div class="text-muted-foreground text-[11px]">Début</div>{{ formatDate(r.startDate) }}</div>
          <div><div class="text-muted-foreground text-[11px]">Fin</div>{{ formatDate(r.endDate) }}</div>
          <div><div class="text-muted-foreground text-[11px]">Jours ouvrés</div>{{ r.daysCount }}j</div>
          <div><div class="text-muted-foreground text-[11px]">Soumis le</div>{{ formatDate(r.createdAt) }}</div>
        </div>
        <div v-if="r.reason" class="text-[12px]">
          <div class="text-muted-foreground text-[11px]">Motif</div>{{ r.reason }}
        </div>
        <div v-if="r.rejectionReason" class="text-[12px] text-danger">
          <div class="text-[11px] font-medium">Motif du refus</div>{{ r.rejectionReason }}
        </div>
        <button :class="L.btnPrimary" class="w-full justify-center" @click="openCard(r)">Ouvrir la fiche</button>
        <AbsenceWorkflowActions v-if="isActionable(r)" :leave="r" />
      </div>
    </template>

    <!-- État vide -->
    <template #empty>
      <CalendarOff class="w-8 h-8" />
      <p class="text-[13px]">{{ t('absence.empty') }}</p>
    </template>

    <!-- Fiche (double-clic) + création -->
    <AbsenceCard v-if="openCardId !== null" :leaves="filtered" :request-id="openCardId" @close="openCardId = null" />
    <AbsenceCreate v-if="showCreate" @close="showCreate = false" @created="reload" />
  </ListPageLayout>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, CalendarOff } from 'lucide-vue-next'
import { StatusPill, UserAvatar, ListPageLayout } from '../../components'
import type { ListColumn } from '../../components/shared/ListPageLayout.vue'
import AbsenceCard from '../../components/absences/AbsenceCard.vue'
import AbsenceCreate from '../../components/absences/AbsenceCreate.vue'
import AbsenceWorkflowActions from '../../components/absences/AbsenceWorkflowActions.vue'
import * as L from '../../lib/listClasses'
import { formatDate } from '../../lib/date'
import { useAuthStore } from '../../stores/auth'
import { useLeaveRequestStore } from '../../stores/leaveRequests'
import { useLeaveTypesStore } from '../../stores/leaveTypes'
import type { LeaveRequest } from '../../types'

const auth            = useAuthStore()
const store           = useLeaveRequestStore()
const leaveTypesStore = useLeaveTypesStore()
const { t }           = useI18n()

// Portee la plus large a laquelle l'utilisateur a droit (CONGE_VOIR_TOUT >
// CONGE_VOIR_EQUIPE > soi-meme), memes 3 endpoints reels que
// MissionListView/ExpenseListView (findAll/findTeam/findMine) — sans ce
// branchement, un manager n'ayant que CONGE_VOIR_EQUIPE se heurtait a un 403
// sur fetchAll() et ne voyait jamais les demandes de son equipe (Lot H #8).
const canSeeAll  = computed(() => auth.hasPermission('CONGE_VOIR_TOUT'))
const canSeeTeam = computed(() => auth.hasPermission('CONGE_VOIR_EQUIPE'))
const sourceList = computed<LeaveRequest[]>(() => canSeeAll.value ? store.all : canSeeTeam.value ? store.team : store.mine)

async function reload() {
  if (canSeeAll.value) await store.fetchAll()
  else if (canSeeTeam.value) await store.fetchTeam()
  else await store.fetchMine()
}

onMounted(() => {
  reload()
  if (leaveTypesStore.leaveTypes.length === 0) leaveTypesStore.fetchAll()
  // AbsenceWorkflowActions n'affiche Approuver/Retourner/Refuser que pour
  // les demandes presentes dans pendingForMe (etape courante = moi) — sans
  // ce fetch, un validateur arrivant directement sur cet ecran (sans passer
  // par "à valider") voyait ces boutons masques a tort sur ses propres
  // demandes actionnables.
  if (auth.hasPermission('CONGE_VALIDER')) store.fetchPendingForMe()
})

const showCreate = ref(false)
const openCardId = ref<string | null>(null)
function openCard(item: LeaveRequest) { openCardId.value = item.id }

const quickBtn = 'px-2.5 py-[5px] rounded text-xs font-medium cursor-pointer bg-background text-muted-foreground hover:text-foreground'
const ACTIONABLE = new Set(['Pending', 'InApprovalN1', 'InApprovalN2', 'InApprovalN3', 'InApprovalN4', 'Draft', 'Returned', 'Registered', 'Done'])
function isActionable(r: LeaveRequest) { return ACTIONABLE.has(r.status) }

/* ── Colonnes (sans colonne Actions) ────────────────────────── */
const columns = computed<ListColumn[]>(() => [
  { key: 'employee',  label: t('absence.fields.employee'),  sortable: true, hideable: false, width: 230 },
  { key: 'type',      label: t('absence.fields.type'),      sortable: true, width: 160 },
  { key: 'dates',     label: t('absence.fields.dates'),     width: 210 },
  { key: 'days',      label: t('absence.fields.days'),      sortable: true, width: 90 },
  { key: 'submitted', label: t('absence.fields.submitted'), sortable: true, width: 140 },
  { key: 'status',    label: t('absence.fields.status'),    sortable: true, width: 140 },
])

/* ── Tri ────────────────────────────────────────────────────── */
const searchQuery = ref('')
const sortKey = ref(''); const sortDir = ref<'asc' | 'desc'>('asc')
const sortFieldMap: Record<string, string> = { employee: 'employeeName', days: 'daysCount', submitted: 'createdAt' }

/* ── Filtres ────────────────────────────────────────────────── */
const filterPresets = computed(() => [
  { label: t('absence.all'), value: '' },
  { label: t('absence.status.pending'),  value: 'Pending' },
  { label: t('absence.status.approved'), value: 'Approved' },
  { label: t('absence.status.rejected'), value: 'Rejected' },
  { label: t('absence.status.draft'),    value: 'Draft' },
])
const activePreset = ref('')
const filterStatus = ref(''); const filterType = ref(''); const filterFrom = ref(''); const filterTo = ref('')
const page = ref(1); const pageSize = ref(10)

watch(activePreset, (v) => { filterStatus.value = v; page.value = 1 })

function resetFilters() {
  filterStatus.value = ''; filterType.value = ''; filterFrom.value = ''; filterTo.value = ''
  searchQuery.value = ''; activePreset.value = ''; page.value = 1
}

const PENDING_STATUSES = new Set(['Pending', 'InApprovalN1', 'InApprovalN2', 'InApprovalN3', 'InApprovalN4'])

/* ── Données ────────────────────────────────────────────────── */
const filtered = computed(() => {
  let list = sourceList.value.filter(l => {
    if (filterStatus.value === 'Pending' ? !PENDING_STATUSES.has(l.status) : (filterStatus.value && l.status !== filterStatus.value)) return false
    if (filterType.value   && l.leaveTypeId !== filterType.value) return false
    if (filterFrom.value   && l.startDate < filterFrom.value)  return false
    if (filterTo.value     && l.endDate   > filterTo.value)    return false
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      if (!l.employeeName.toLowerCase().includes(q) && !l.leaveTypeName.toLowerCase().includes(q)) return false
    }
    return true
  })
  if (sortKey.value) {
    const field = sortFieldMap[sortKey.value] ?? sortKey.value
    list = [...list].sort((a, b) => {
      const va = (a as any)[field] ?? ''; const vb = (b as any)[field] ?? ''
      const cmp = String(va).localeCompare(String(vb))
      return sortDir.value === 'asc' ? cmp : -cmp
    })
  }
  return list
})

const totalCount   = computed(() => filtered.value.length)
const pendingCount = computed(() => filtered.value.filter(l => PENDING_STATUSES.has(l.status)).length)
const pageItems    = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filtered.value.slice(start, start + pageSize.value)
})
</script>
