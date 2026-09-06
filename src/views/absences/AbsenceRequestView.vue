<template>
  <ListPageLayout
    :title="t('absence.my_title')"
    :subtitle="auth.user?.name ?? ''"
    :columns="columns"
    :items="pageItems"
    :total="totalCount"
    :total-text="t('absence.total', { count: totalCount })"
    :search-placeholder="t('topbar.search_placeholder')"
    scope-label="Demandes :"
    :scope-options="scopeOptions"
    :loading="store.loading"
    v-model:scope="activeScope"
    v-model:search-query="searchQuery"
    v-model:sort-key="sortKey"
    v-model:sort-dir="sortDir"
    v-model:page="page"
    v-model:page-size="pageSize"
    @open-card="openCard"
  >
    <template #header-actions>
      <button :class="L.btnPrimary" @click="showCreate = true">
        <Plus class="w-4 h-4" /> {{ t('absence.new') }}
      </button>
    </template>

    <!-- Soldes -->
    <template #above-table>
      <div class="grid grid-cols-4 gap-2.5 mb-3.5 max-md:grid-cols-2">
        <div v-for="b in balanceStore.myBalances" :key="b.leaveTypeId" :class="kpiCard" class="border-t-[3px]" :style="{ borderTopColor: b.color }">
          <div :class="kpiLabel">{{ b.leaveTypeName }}</div>
          <div :class="kpiValue" :style="{ color: b.color }">{{ b.balance }}</div>
          <div :class="kpiSub">j disponible{{ b.balance > 1 ? 's' : '' }}</div>
        </div>
        <div v-if="balanceStore.myBalances.length === 0" class="col-span-4 text-[13px] text-muted-foreground italic px-1">
          Aucun type de congé actif configuré.
        </div>
      </div>
    </template>

    <!-- Actions contextuelles -->
    <template #row-actions="{ item }">
      <AbsenceWorkflowActions :leave="item" />
    </template>

    <!-- Cellules -->
    <template #cell-beneficiary="{ item }">
      <div class="flex items-center gap-2">
        <UserAvatar :name="item.employeeName" size="sm" />
        <div class="min-w-0">
          <div class="truncate">{{ item.employeeName }}</div>
          <div v-if="item.createdByName && item.createdByName !== item.employeeName" class="text-[10px] text-muted-foreground truncate">
            Créé par {{ item.createdByName }}
          </div>
        </div>
      </div>
    </template>
    <template #cell-type="{ item }"><span class="whitespace-nowrap">{{ item.leaveTypeName }}</span></template>
    <template #cell-dates="{ item }"><span class="whitespace-nowrap text-[11px]">{{ formatDate(item.startDate) }} → {{ formatDate(item.endDate) }}</span></template>
    <template #cell-days="{ item }"><span class="font-medium whitespace-nowrap">{{ item.daysCount }}j</span></template>
    <template #cell-submitted="{ item }"><span class="text-muted-foreground whitespace-nowrap text-[11px]">{{ formatDate(item.createdAt) }}</span></template>
    <template #cell-status="{ item }"><StatusPill :status="item.status" /></template>

    <!-- Aperçu -->
    <template #details-panel="{ item }">
      <div class="flex flex-col gap-3.5">
        <div class="text-sm font-semibold text-foreground">{{ item.leaveTypeName }}</div>
        <div><StatusPill :status="item.status" /></div>
        <div class="grid grid-cols-2 gap-2 text-[12px]">
          <div><div class="text-muted-foreground text-[11px]">Début</div>{{ formatDate(item.startDate) }}</div>
          <div><div class="text-muted-foreground text-[11px]">Fin</div>{{ formatDate(item.endDate) }}</div>
          <div><div class="text-muted-foreground text-[11px]">Jours ouvrés</div>{{ item.daysCount }}j</div>
          <div><div class="text-muted-foreground text-[11px]">Soumis le</div>{{ formatDate(item.createdAt) }}</div>
        </div>
        <div v-if="item.reason" class="text-[12px]"><div class="text-muted-foreground text-[11px]">Motif</div>{{ item.reason }}</div>
        <div v-if="item.createdByName && item.createdByName !== item.employeeName" class="text-[12px]">
          <div class="text-muted-foreground text-[11px]">Créé par</div>{{ item.createdByName }}
        </div>
        <button :class="L.btnPrimary" class="w-full justify-center" @click="openCard(item)">Ouvrir la fiche</button>
        <AbsenceWorkflowActions :leave="item" />
      </div>
    </template>

    <template #empty>
      <CalendarOff class="w-8 h-8" />
      <p class="text-[13px]">{{ t('absence.my_empty') }}</p>
    </template>

    <AbsenceCard v-if="openCardId !== null" :leaves="filtered" :request-id="openCardId" @close="openCardId = null" />
    <AbsenceCreate v-if="showCreate" @close="showCreate = false" @created="store.fetchMine()" />
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
import { useLeaveTransactionStore } from '../../stores/leaveTransactions'
import { useDeepLinkOpen } from '../../composables/useDeepLinkOpen'
import type { LeaveRequest } from '../../types'

const { t } = useI18n()
const auth = useAuthStore()
const store = useLeaveRequestStore()
const balanceStore = useLeaveTransactionStore()

const kpiCard = 'bg-card border border-border rounded-lg px-3.5 py-3'
const kpiLabel = 'text-[13px] text-muted-foreground mb-1'
const kpiValue = 'text-[28px] font-semibold leading-none'
const kpiSub = 'text-xs text-muted-foreground mt-[3px]'

const showCreate = ref(false)
const openCardId = ref<string | null>(null)
function openCard(item: LeaveRequest) { openCardId.value = item.id }

const { applyDeepLink } = useDeepLinkOpen(openCardId)
onMounted(async () => {
  await store.fetchMine()
  if (balanceStore.myBalances.length === 0) balanceStore.fetchMyBalances()
  applyDeepLink()
})

const columns = computed<ListColumn[]>(() => [
  { key: 'beneficiary', label: 'Bénéficiaire', sortable: true, width: 200 },
  { key: 'type', label: t('absence.fields.type'), sortable: true, hideable: false, width: 200 },
  { key: 'dates', label: t('absence.fields.dates'), width: 210 },
  { key: 'days', label: t('absence.fields.days'), align: 'center', width: 90 },
  { key: 'submitted', label: t('absence.fields.submitted'), sortable: true, width: 130 },
  { key: 'status', label: t('absence.fields.status'), width: 130 },
])

const PENDING_STATUSES = new Set(['Pending', 'InApprovalN1', 'InApprovalN2', 'InApprovalN3', 'InApprovalN4'])

const scopeOptions = computed(() => [
  { value: '', label: t('absence.all') },
  { value: 'pending', label: t('absence.status.pending') },
  { value: 'Approved', label: t('absence.status.approved') },
  { value: 'Rejected', label: t('absence.status.rejected') },
  { value: 'Draft', label: t('absence.status.draft') },
])
const activeScope = ref('')

const searchQuery = ref('')
const sortKey = ref('')
const sortDir = ref<'asc' | 'desc'>('asc')
const page = ref(1)
const pageSize = ref(10)
watch([activeScope, searchQuery, pageSize], () => { page.value = 1 })

const sortFieldMap: Record<string, keyof LeaveRequest> = { beneficiary: 'employeeName', type: 'leaveTypeName', submitted: 'createdAt' }

const filtered = computed(() => {
  let rows = store.mine.filter(l => {
    if (activeScope.value === 'pending' ? !PENDING_STATUSES.has(l.status) : (activeScope.value && l.status !== activeScope.value)) return false
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      if (!l.leaveTypeName.toLowerCase().includes(q) && !l.employeeName.toLowerCase().includes(q)) return false
    }
    return true
  })
  if (sortKey.value && sortFieldMap[sortKey.value]) {
    const f = sortFieldMap[sortKey.value]!
    rows = [...rows].sort((a, b) => {
      const cmp = String(a[f] ?? '').localeCompare(String(b[f] ?? ''))
      return sortDir.value === 'asc' ? cmp : -cmp
    })
  }
  return rows
})

const totalCount = computed(() => filtered.value.length)
const pageItems = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filtered.value.slice(start, start + pageSize.value)
})
</script>
