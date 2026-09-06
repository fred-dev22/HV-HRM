<template>
  <ListPageLayout
    :title="isRh ? 'Gestion des notes de frais' : 'Mes notes de frais'"
    :subtitle="isRh ? 'Toutes les notes de frais' : 'Vos notes de frais'"
    :columns="columns"
    :items="pageItems"
    :loading="expenseStore.loading"
    :total="totalCount"
    :total-text="`${totalCount} note(s)`"
    search-placeholder="Rechercher une note…"
    scope-label="Notes :"
    :scope-options="scopeOptions"
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
        <Plus class="w-4 h-4" /> Nouvelle note
      </button>
    </template>

    <template #row-actions="{ item }">
      <ExpenseWorkflowActions :report="item" />
    </template>

    <template #cell-referenceCode="{ item }">
      <span class="font-mono text-xs font-semibold text-primary">{{ item.referenceCode }}</span>
    </template>
    <template #cell-employeeName="{ item }">
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
    <template #cell-title="{ item }">
      <span class="truncate">{{ item.title }}</span>
    </template>
    <template #cell-linesCount="{ item }">
      <span class="text-center block">{{ item.lines.length }}</span>
    </template>
    <template #cell-totalAmount="{ item }">
      <span class="font-semibold whitespace-nowrap tabular-nums">{{ fmtNum(item.totalAmount) }} {{ item.currency }}</span>
    </template>
    <template #cell-submittedAt="{ item }">
      <span class="text-muted-foreground whitespace-nowrap text-[11px]">{{ item.submittedAt ? formatDate(item.submittedAt) : '—' }}</span>
    </template>
    <template #cell-status="{ item }">
      <StatusPill :status="item.status" />
    </template>

    <template #details-panel="{ item }">
      <div class="flex flex-col gap-3.5">
        <div class="flex items-center gap-2.5">
          <UserAvatar :name="item.employeeName" size="md" />
          <div class="min-w-0">
            <div class="text-sm font-semibold text-foreground truncate">{{ item.employeeName }}</div>
            <div class="text-[11px] text-muted-foreground font-mono">{{ item.referenceCode }}</div>
          </div>
        </div>
        <div v-if="item.createdByName && item.createdByName !== item.employeeName" class="text-[12px]">
          <div class="text-muted-foreground text-[11px]">Créé par</div>{{ item.createdByName }}
        </div>
        <div><StatusPill :status="item.status" /></div>
        <div class="text-[12px]">
          <div class="text-muted-foreground text-[11px]">Titre</div>{{ item.title }}
        </div>
        <div class="grid grid-cols-2 gap-2 text-[12px]">
          <div><div class="text-muted-foreground text-[11px]">Lignes</div>{{ item.lines.length }}</div>
          <div><div class="text-muted-foreground text-[11px]">Total</div><span class="font-semibold text-primary">{{ fmtNum(item.totalAmount) }} {{ item.currency }}</span></div>
        </div>
        <button :class="L.btnPrimary" class="w-full justify-center" @click="openCard(item)">Ouvrir la fiche</button>
        <ExpenseWorkflowActions :report="item" />
      </div>
    </template>

    <template #empty>
      <ReceiptText class="w-8 h-8" />
      <p class="text-[13px]">Aucune note de frais</p>
    </template>

    <ExpenseCard v-if="openCardId !== null" :reports="filtered" :report-id="openCardId" @close="openCardId = null" />
    <ExpenseCreate v-if="showCreate" :mode="isRh ? 'for-employee' : 'self'" @close="showCreate = false" @created="reload" />
  </ListPageLayout>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { Plus, ReceiptText } from 'lucide-vue-next'
import { StatusPill, UserAvatar, ListPageLayout } from '../../components'
import type { ListColumn } from '../../components/shared/ListPageLayout.vue'
import ExpenseCard from '../../components/expenses/ExpenseCard.vue'
import ExpenseCreate from '../../components/expenses/ExpenseCreate.vue'
import ExpenseWorkflowActions from '../../components/expenses/ExpenseWorkflowActions.vue'
import * as L from '../../lib/listClasses'
import { formatDate } from '../../lib/date'
import { useAuthStore } from '../../stores/auth'
import { useExpenseStore } from '../../stores/expenses'
import { useDeepLinkOpen } from '../../composables/useDeepLinkOpen'
import type { ExpenseReport } from '../../types'

const auth = useAuthStore()
const expenseStore = useExpenseStore()

const canSeeAll = computed(() => auth.hasPermission('FRAIS_VOIR_TOUT'))
const canSeeTeam = computed(() => auth.hasPermission('FRAIS_VOIR_EQUIPE'))
const isRh = computed(() => canSeeAll.value || canSeeTeam.value)

const sourceList = computed<ExpenseReport[]>(() => canSeeAll.value ? expenseStore.all : canSeeTeam.value ? expenseStore.team : expenseStore.mine)

const showCreate = ref(false)
const openCardId = ref<string | null>(null)
function openCard(item: ExpenseReport) { openCardId.value = item.id }
function fmtNum(n: number) { return n.toLocaleString('fr-FR') }

const { applyDeepLink } = useDeepLinkOpen(openCardId)
async function reload() {
  if (canSeeAll.value) await expenseStore.fetchAll()
  else if (canSeeTeam.value) await expenseStore.fetchTeam()
  else await expenseStore.fetchMine()
}
onMounted(async () => { await reload(); applyDeepLink() })

const columns = computed<ListColumn[]>(() => {
  const base: ListColumn[] = [
    { key: 'referenceCode', label: 'Code', sortable: true, hideable: false, width: 130 },
    { key: 'employeeName', label: isRh.value ? 'Employé' : 'Bénéficiaire', sortable: true, width: 200 },
  ]
  base.push(
    { key: 'title', label: 'Titre', sortable: true, width: 220 },
    { key: 'linesCount', label: 'Lignes', align: 'center', width: 90 },
    { key: 'totalAmount', label: 'Montant total', sortable: true, align: 'right', width: 150 },
    { key: 'submittedAt', label: 'Soumis le', width: 120 },
    { key: 'status', label: 'Statut', width: 130 },
  )
  return base
})

const scopeOptions = [
  { value: '', label: 'Toutes' },
  { value: 'Draft', label: 'Brouillon' },
  { value: 'pending', label: 'En attente' },
  { value: 'Approved', label: 'Approuvée' },
  { value: 'Rejected', label: 'Refusée' },
  { value: 'Returned', label: 'Retournée' },
  { value: 'Cancelled', label: 'Annulée' },
]
const IN_APPROVAL = new Set(['Pending', 'InApprovalN1', 'InApprovalN2', 'InApprovalN3', 'InApprovalN4'])
const activeScope = ref('')

const searchQuery = ref('')
const sortKey = ref('')
const sortDir = ref<'asc' | 'desc'>('asc')
const page = ref(1)
const pageSize = ref(10)
watch([activeScope, searchQuery, pageSize], () => { page.value = 1 })

const sortFieldMap: Record<string, keyof ExpenseReport> = {
  referenceCode: 'referenceCode', employeeName: 'employeeName', title: 'title', totalAmount: 'totalAmount',
}

const filtered = computed(() => {
  let rows = sourceList.value
  if (activeScope.value === 'pending') rows = rows.filter(r => IN_APPROVAL.has(r.status))
  else if (activeScope.value) rows = rows.filter(r => r.status === activeScope.value)
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    rows = rows.filter(r => r.referenceCode.toLowerCase().includes(q) || r.employeeName.toLowerCase().includes(q) || r.title.toLowerCase().includes(q))
  }
  if (sortKey.value && sortFieldMap[sortKey.value]) {
    const f = sortFieldMap[sortKey.value]!
    rows = [...rows].sort((a, b) => {
      const va = a[f] ?? '', vb = b[f] ?? ''
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb))
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
