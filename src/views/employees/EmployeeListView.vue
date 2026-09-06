<template>
  <ListPageLayout
    :title="t('employee.title')"
    :subtitle="t('employee.sub_title', { count: store.employees.length })"
    :loading="store.loading"
    :columns="columns"
    :items="pageItems"
    :total="totalCount"
    :total-text="`${totalCount} employé(s)`"
    :search-placeholder="t('topbar.search_placeholder')"
    :page-size-options="[15, 25, 50]"
    scope-label="Employés :"
    :scope-options="scopeOptions"
    v-model:scope="activeScope"
    v-model:search-query="searchQuery"
    v-model:sort-key="sortKey"
    v-model:sort-dir="sortDir"
    v-model:page="page"
    v-model:page-size="pageSize"
    @reset-filters="resetFilters"
    @open-card="openCard"
  >
    <template #header-actions>
      <div v-if="auth.hasPermission('EMPLOYE_CREER')" class="flex items-center gap-2">
        <button :class="L.btnOutline" @click="showImport = true">
          <Upload class="w-4 h-4" /> Importer
        </button>
        <button :class="L.btnPrimary" @click="showCreate = true">
          <UserPlus class="w-4 h-4" /> {{ t('employee.new') }}
        </button>
      </div>
    </template>

    <!-- KPIs -->
    <template #above-table>
      <div class="grid grid-cols-4 gap-2.5 mb-3.5 max-md:grid-cols-2">
        <div :class="kpiItem"><div :class="kpiIcon" class="bg-success-bg"><Users class="w-[18px] h-[18px] text-success" /></div><div><div :class="kpiVal">{{ store.employees.length }}</div><div :class="kpiLbl">{{ t('employee.kpi_total') }}</div></div></div>
        <div :class="kpiItem"><div :class="kpiIcon" class="bg-success-bg"><UserCheck class="w-[18px] h-[18px] text-success" /></div><div><div :class="kpiVal">{{ store.activeEmployees.length }}</div><div :class="kpiLbl">{{ t('employee.kpi_active') }}</div></div></div>
        <div :class="kpiItem"><div :class="kpiIcon" class="bg-primary/10"><Clock class="w-[18px] h-[18px] text-primary" /></div><div><div :class="kpiVal">{{ store.trialEmployees.length }}</div><div :class="kpiLbl">{{ t('employee.kpi_trial') }}</div></div></div>
        <div :class="kpiItem"><div :class="kpiIcon" class="bg-warning-bg"><ShieldCheck class="w-[18px] h-[18px] text-warning" /></div><div><div :class="kpiVal">{{ store.validatorEmployees.length }}</div><div :class="kpiLbl">{{ t('employee.kpi_managers') }}</div></div></div>
      </div>
    </template>

    <!-- Actions contextuelles (ligne sélectionnée) -->
    <template #row-actions="{ item }">
      <button :class="quickBtn" @click="openCard(item)">Ouvrir la fiche</button>
    </template>

    <!-- Filtres -->
    <template #filters>
      <div :class="L.fpField">
        <label :class="L.fpFieldLabel">{{ t('employee.filter_entity') }}</label>
        <select v-model="fEntity" :class="L.fpSelect">
          <option value="">{{ t('employee.filter_entity') }}</option>
          <option v-for="e in entityStore.approvedEntities" :key="e.id" :value="e.id">{{ e.code }} · {{ e.name }}</option>
        </select>
      </div>
      <div :class="L.fpField">
        <label :class="L.fpFieldLabel">Catégorie</label>
        <select v-model="fCategory" :class="L.fpSelect">
          <option value="">Catégorie</option>
          <option v-for="c in categoryStore.categories" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </div>
      <div :class="L.fpField">
        <label :class="L.fpFieldLabel">{{ t('employee.filter_contract') }}</label>
        <select v-model="fContract" :class="L.fpSelect">
          <option value="">{{ t('employee.filter_contract') }}</option>
          <option value="CDI">CDI</option><option value="CDD">CDD</option><option value="Stage">Stage</option><option value="Freelance">Freelance</option><option value="Apprenti">Apprenti</option><option value="Alternant">Alternant</option>
        </select>
      </div>
      <button class="mt-auto py-[7px] bg-transparent border-0 text-xs text-muted-foreground cursor-pointer text-left hover:text-primary" @click="resetFilters">{{ t('employee.filter_reset') }}</button>
    </template>

    <!-- Cellules -->
    <template #cell-employee="{ item }">
      <div class="flex items-center gap-2.5">
        <div class="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0" :style="{ background: item.avatarBg, color: item.avatarText }">{{ item.initials }}</div>
        <div class="min-w-0">
          <div class="font-medium text-[13px] truncate">{{ item.name }}</div>
          <div class="text-[11px] text-muted-foreground truncate">{{ item.jobTitle }}</div>
        </div>
      </div>
    </template>
    <template #cell-code="{ item }"><span class="font-mono text-xs font-semibold text-primary">{{ item.code }}</span></template>
    <template #cell-jobTitle="{ item }"><span class="text-foreground text-xs truncate">{{ item.jobTitle || '—' }}</span></template>
    <template #cell-entityName="{ item }"><span class="text-muted-foreground text-xs truncate">{{ item.entityName || '—' }}</span></template>
    <template #cell-category="{ item }"><span class="text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap bg-primary/10 text-primary">{{ categoryName(item.employeeCategoryId) }}</span></template>
    <template #cell-contractType="{ item }"><span class="text-muted-foreground text-xs">{{ item.contractType }}</span></template>
    <template #cell-hireDate="{ item }"><span class="text-muted-foreground text-xs">{{ formatDate(item.hireDate) }}</span></template>
    <template #cell-status="{ item }"><StatusPill :status="item.status" /></template>

    <!-- Aperçu rapide -->
    <template #details-panel="{ item }">
      <div class="flex flex-col gap-3.5">
        <div class="flex items-center gap-2.5">
          <div class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0" :style="{ background: item.avatarBg, color: item.avatarText }">{{ item.initials }}</div>
          <div class="min-w-0">
            <div class="text-sm font-semibold text-foreground truncate">{{ item.name }}</div>
            <div class="text-[11px] text-muted-foreground">{{ item.jobTitle }}</div>
          </div>
        </div>
        <div><StatusPill :status="item.status" /></div>
        <div class="grid grid-cols-2 gap-2 text-[12px]">
          <div><div class="text-muted-foreground text-[11px]">Matricule</div>{{ item.code }}</div>
          <div><div class="text-muted-foreground text-[11px]">Catégorie</div>{{ categoryName(item.employeeCategoryId) }}</div>
          <div><div class="text-muted-foreground text-[11px]">Entité</div>{{ item.entityName || '—' }}</div>
          <div><div class="text-muted-foreground text-[11px]">Contrat</div>{{ item.contractType }}</div>
          <div><div class="text-muted-foreground text-[11px]">Embauche</div>{{ formatDate(item.hireDate) }}</div>
        </div>
        <div v-if="item.email" class="text-[12px]"><div class="text-muted-foreground text-[11px]">Email</div>{{ item.email }}</div>
        <button :class="L.btnPrimary" class="w-full justify-center" @click="openCard(item)">Ouvrir la fiche</button>
      </div>
    </template>

    <template #empty>
      <Users class="w-8 h-8" />
      <p class="text-[13px]">{{ t('employee.empty') }}</p>
    </template>

    <EmployeeCard v-if="openCardId !== null" :employees="filtered" :employee-id="openCardId" @close="openCardId = null" />
    <EmployeeCreate v-if="showCreate" @close="showCreate = false" />
    <ImportWizardModal v-if="showImport" :open="showImport" :config="employeeImportConfig" @close="showImport = false" @imported="store.fetchAll()" />
  </ListPageLayout>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { UserPlus, Upload, Users, UserCheck, Clock, ShieldCheck } from 'lucide-vue-next'
import { StatusPill, ListPageLayout } from '../../components'
import type { ListColumn } from '../../components/shared/ListPageLayout.vue'
import EmployeeCard from '../../components/employees/EmployeeCard.vue'
import EmployeeCreate from '../../components/employees/EmployeeCreate.vue'
import ImportWizardModal from '../../components/shared/import/ImportWizardModal.vue'
import { buildEmployeeImportConfig } from '../../components/shared/import/configs/employeeImportConfig'
import * as L from '../../lib/listClasses'
import { formatDate } from '../../lib/date'
import { useEmployeeStore } from '../../stores/employees'
import { useEntityStore } from '../../stores/entities'
import { useAuthStore } from '../../stores/auth'
import { useEmployeeCategoryStore } from '../../stores/employeeCategories'
import { usePositionStore } from '../../stores/positions'
import type { Employee, EmployeeStatus } from '../../types'

const { t } = useI18n()
const store = useEmployeeStore()
const entityStore = useEntityStore()
const auth = useAuthStore()
const categoryStore = useEmployeeCategoryStore()
if (categoryStore.categories.length === 0) categoryStore.fetchAll()
// Chargé ici (pas seulement depuis Classification > Poste) — sinon le menu
// "Poste" de l'assistant d'import reste vide tant que l'utilisateur n'a pas
// déjà visité cet écran dans la session.
const positionStore = usePositionStore()
if (positionStore.positions.length === 0) positionStore.fetchAll()
// Séquencé (pas en parallèle) : mapEmployee lit entityStore de façon
// synchrone pour entityName — sans cet ordre, une première visite avec les
// deux stores vides peut résoudre le nom d'entité en blanc. Le fetch employés
// n'est PAS gardé par "déjà peuplé" : entityStore.fetchAll() peut avoir
// peuplé employees comme effet de bord (pour le headcount des entités) sans
// résoudre entityName — on doit re-mapper une fois les entités disponibles.
;(async () => {
  if (entityStore.entities.length === 0) await entityStore.fetchAll()
  await store.fetchAll()
})()

const quickBtn = 'px-2.5 py-[5px] rounded text-xs font-medium cursor-pointer bg-background text-muted-foreground hover:text-foreground'

const kpiItem = 'bg-card border border-border rounded-lg px-3.5 py-3 flex items-center gap-3'
const kpiIcon = 'w-9 h-9 rounded-lg flex items-center justify-center shrink-0'
const kpiVal = 'text-[22px] font-bold leading-none'
const kpiLbl = 'text-xs text-muted-foreground mt-0.5'

const showCreate = ref(false)
const showImport = ref(false)
const employeeImportConfig = computed(() => buildEmployeeImportConfig())
const openCardId = ref<string | null>(null)
function openCard(item: Employee) { openCardId.value = item.id }

function categoryName(id?: string): string {
  if (!id) return '—'
  return categoryStore.categories.find(c => c.id === id)?.name ?? '—'
}

const columns = computed<ListColumn[]>(() => [
  { key: 'code', label: t('employee.col_code'), sortable: true, hideable: false, width: 110 },
  { key: 'employee', label: t('employee.col_employee'), sortable: true, width: 230 },
  { key: 'jobTitle', label: t('employee.col_job_title'), sortable: true, width: 160 },
  { key: 'entityName', label: t('employee.col_entity'), sortable: true, width: 160 },
  { key: 'category', label: 'Catégorie', width: 150 },
  { key: 'contractType', label: t('employee.col_contract'), width: 110 },
  { key: 'hireDate', label: t('employee.col_hire_date'), sortable: true, width: 130 },
  { key: 'status', label: t('employee.col_status'), width: 120 },
])

const scopeOptions = [
  { value: '', label: 'Tous' },
  { value: 'active', label: t('employee.status_active') },
  { value: 'trial', label: t('employee.status_trial') },
  { value: 'onleave', label: t('employee.status_onleave') },
  { value: 'inactive', label: t('employee.status_inactive') },
]
const activeScope = ref('')

const fEntity = ref('')
const fCategory = ref('')
const fContract = ref('')
const searchQuery = ref('')
const sortKey = ref('')
const sortDir = ref<'asc' | 'desc'>('asc')
const page = ref(1)
const pageSize = ref(15)

watch([activeScope, fEntity, fCategory, fContract, searchQuery, pageSize], () => { page.value = 1 })

function resetFilters() {
  fEntity.value = ''; fCategory.value = ''; fContract.value = ''; searchQuery.value = ''; activeScope.value = ''; page.value = 1
}

const sortFieldMap: Record<string, keyof Employee> = { code: 'code', employee: 'name', jobTitle: 'jobTitle', entityName: 'entityName', hireDate: 'hireDate' }

const filtered = computed(() => {
  let rows = store.employees.filter(e => {
    // "Tous" inclut désormais les employés désactivés — sinon impossible de
    // les retrouver pour les réactiver sans déjà savoir filtrer sur
    // "Inactif". La suppression définitive (Lot I, IsDeleted) est le
    // véritable mécanisme qui fait disparaître un employé partout : elle est
    // déjà appliquée côté API (findAll), pas besoin de la dupliquer ici.
    if (activeScope.value && e.status !== (activeScope.value as EmployeeStatus)) return false
    if (fEntity.value && e.entityId !== fEntity.value) return false
    if (fCategory.value && e.employeeCategoryId !== fCategory.value) return false
    if (fContract.value && e.contractType !== fContract.value) return false
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      if (!e.name.toLowerCase().includes(q) && !e.code.toLowerCase().includes(q) && !e.jobTitle.toLowerCase().includes(q)) return false
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
