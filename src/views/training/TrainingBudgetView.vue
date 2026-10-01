<template>
  <ListPageLayout
    title="Suivi budgétaire"
    :subtitle="`${budgetStore.items.length} ligne(s) budgétaire(s)`"
    :columns="columns"
    :items="pageItems"
    :total="totalCount"
    :total-text="`${totalCount} ligne(s)`"
    search-placeholder="Rechercher une entité, une formation…"
    :page-size-options="[15, 25, 50]"
    scope-label="Lignes :"
    :scope-options="scopeOptions"
    v-model:scope="activeScope"
    v-model:search-query="searchQuery"
    v-model:sort-key="sortKey"
    v-model:sort-dir="sortDir"
    v-model:page="page"
    v-model:page-size="pageSize"
    @reset-filters="resetFilters"
  >
    <template #header-actions>
      <button :class="L.btnPrimary" @click="showCreate = true">
        <Plus class="w-4 h-4" /> Nouvelle demande de budget
      </button>
    </template>

    <template #above-table>
      <div class="grid grid-cols-3 gap-2.5 mb-3.5 max-md:grid-cols-1">
        <div :class="kpiItem">
          <div :class="kpiIcon" class="bg-primary/10"><Coins class="w-[18px] h-[18px] text-primary" /></div>
          <div><div :class="kpiVal">{{ formatMga(budgetStore.totalAllocated) }}</div><div :class="kpiLbl">Budget alloué (approuvé)</div></div>
        </div>
        <div :class="kpiItem">
          <div :class="kpiIcon" class="bg-warning-bg"><TrendingDown class="w-[18px] h-[18px] text-warning" /></div>
          <div><div :class="kpiVal">{{ formatMga(budgetStore.totalUsed) }}</div><div :class="kpiLbl">Budget utilisé</div></div>
        </div>
        <div :class="kpiItem">
          <div :class="kpiIcon" class="bg-info-bg"><Hourglass class="w-[18px] h-[18px] text-info" /></div>
          <div><div :class="kpiVal">{{ pendingCount }}</div><div :class="kpiLbl">Demande(s) en attente</div></div>
        </div>
      </div>
    </template>

    <template #cell-entityName="{ item }"><span class="font-medium text-foreground text-xs truncate">{{ item.entityName }}</span></template>
    <template #cell-courseTitle="{ item }"><span class="text-muted-foreground text-xs truncate">{{ item.courseTitle ?? '-' }}</span></template>
    <template #cell-year="{ item }"><span class="text-xs text-foreground">{{ item.year }}</span></template>
    <template #cell-allocated="{ item }"><span class="text-xs text-foreground whitespace-nowrap">{{ formatMga(item.allocated) }}</span></template>
    <template #cell-used="{ item }"><span class="text-xs text-foreground whitespace-nowrap">{{ formatMga(item.used) }}</span></template>
    <template #cell-requestStatus="{ item }"><StatusPill v-if="item.requestStatus" :status="item.requestStatus" /></template>

    <template #row-actions="{ item }">
      <button v-if="item.requestStatus === 'Pending'" type="button" :class="L.actApprove" @click.stop="budgetStore.approve(item.id)">Approuver</button>
      <button v-if="item.requestStatus === 'Pending'" type="button" :class="L.actReject" @click.stop="budgetStore.reject(item.id)">Refuser</button>
    </template>

    <template #details-panel="{ item }">
      <div class="flex flex-col gap-3.5">
        <div>
          <div class="text-sm font-semibold text-foreground truncate">{{ item.entityName }}</div>
          <div class="text-[11px] text-muted-foreground truncate">{{ item.courseTitle ?? 'Budget global' }} · {{ item.year }}</div>
        </div>
        <div v-if="item.requestStatus"><StatusPill :status="item.requestStatus" /></div>
        <div class="grid grid-cols-2 gap-2 text-[12px]">
          <div><div class="text-muted-foreground text-[11px]">Alloué</div>{{ formatMga(item.allocated) }}</div>
          <div><div class="text-muted-foreground text-[11px]">Utilisé</div>{{ formatMga(item.used) }}</div>
        </div>
        <p v-if="item.comment" class="text-[12px] text-muted-foreground">{{ item.comment }}</p>
        <div class="flex gap-2" v-if="item.requestStatus === 'Pending'">
          <button :class="L.btnPrimary" class="flex-1 justify-center" @click="budgetStore.approve(item.id)">Approuver</button>
          <button :class="L.btnOutline" class="flex-1 justify-center" @click="budgetStore.reject(item.id)">Refuser</button>
        </div>
      </div>
    </template>

    <template #empty>
      <Coins class="w-8 h-8" />
      <p class="text-[13px]">Aucune ligne budgétaire</p>
    </template>

    <CreateModalShell
      v-if="showCreate"
      title="Nouvelle demande de budget"
      banner-label="Nouvelle demande"
      create-label="Soumettre"
      :is-saving="submitting"
      :save-error="error"
      @close="showCreate = false"
      @create="create"
    >
      <template #form>
        <div class="flex-1 overflow-auto px-6 py-5">
          <div class="max-w-3xl mx-auto">
            <FormSection title="Demande">
              <div class="grid grid-cols-2 gap-x-6 gap-y-4 max-sm:grid-cols-1">
                <div :class="cls.field">
                  <label :class="cls.fieldLabel">Année <span class="text-danger">*</span></label>
                  <input type="number" v-model.number="form.year" :class="cls.fieldInput" />
                </div>
                <div :class="cls.field">
                  <label :class="cls.fieldLabel">Entité <span class="text-danger">*</span></label>
                  <input v-model="form.entityName" :class="cls.fieldInput" placeholder="ex : Direction Generale" />
                </div>
                <div :class="cls.field" class="col-span-2">
                  <label :class="cls.fieldLabel">Formation liée <span :class="cls.fieldOptional">(optionnel)</span></label>
                  <select v-model="form.courseId" :class="cls.fieldSelect">
                    <option value="">Budget global (non lié à une formation précise)</option>
                    <option v-for="c in courseStore.items" :key="c.id" :value="c.id">{{ c.title }}</option>
                  </select>
                </div>
                <div :class="cls.field">
                  <label :class="cls.fieldLabel">Montant demandé (MGA) <span class="text-danger">*</span></label>
                  <input type="number" min="0" v-model.number="form.allocated" :class="cls.fieldInput" />
                </div>
              </div>
              <div :class="cls.field" class="mt-4">
                <label :class="cls.fieldLabel">Justification <span :class="cls.fieldOptional">(optionnel)</span></label>
                <textarea v-model="form.comment" :class="cls.fieldTextarea" rows="3" placeholder="Contexte de la demande…"></textarea>
              </div>
            </FormSection>
          </div>
        </div>
      </template>
    </CreateModalShell>
  </ListPageLayout>
</template>

<script setup lang="ts">
/**
 * Suivi budgétaire (BudgetLine), module Formation (design uniquement,
 * données fictives, voir src/stores/training).
 */
import { ref, reactive, computed, watch } from 'vue'
import { Plus, Coins, TrendingDown, Hourglass } from 'lucide-vue-next'
import { ListPageLayout, StatusPill, CreateModalShell } from '../../components'
import type { ListColumn } from '../../components/shared/ListPageLayout.vue'
import FormSection from '../../components/ui/form-field/FormSection.vue'
import * as cls from '../../lib/formClasses'
import * as L from '../../lib/listClasses'
import { getApiErrorMessage } from '../../lib/api'
import { withToast } from '../../lib/withToast'
import { useSubmitGuard } from '../../lib/submitGuard'
import { useBudgetStore, useCourseStore } from '../../stores/training'
import type { BudgetLine } from '../../stores/training'

const budgetStore = useBudgetStore()
const courseStore = useCourseStore()

const kpiItem = 'bg-card border border-border rounded-lg px-3.5 py-3 flex items-center gap-3'
const kpiIcon = 'w-9 h-9 rounded-lg flex items-center justify-center shrink-0'
const kpiVal = 'text-[22px] font-bold leading-none'
const kpiLbl = 'text-xs text-muted-foreground mt-0.5'

function formatMga(n: number): string { return `${n.toLocaleString('fr-FR')} MGA` }

const pendingCount = computed(() => budgetStore.items.filter(b => b.requestStatus === 'Pending').length)

const columns: ListColumn[] = [
  { key: 'entityName', label: 'Entité', sortable: true, hideable: false, width: 170 },
  { key: 'courseTitle', label: 'Formation', width: 200 },
  { key: 'year', label: 'Année', align: 'center', width: 90 },
  { key: 'allocated', label: 'Alloué', width: 140 },
  { key: 'used', label: 'Utilisé', width: 140 },
  { key: 'requestStatus', label: 'Statut', width: 130 },
]

const scopeOptions = [
  { value: '', label: 'Toutes' },
  { value: 'Pending', label: 'En attente' },
  { value: 'Approved', label: 'Approuvées' },
  { value: 'Rejected', label: 'Refusées' },
]
const activeScope = ref('')
const searchQuery = ref('')
const sortKey = ref('year')
const sortDir = ref<'asc' | 'desc'>('desc')
const page = ref(1)
const pageSize = ref(15)

watch([activeScope, searchQuery, pageSize], () => { page.value = 1 })
function resetFilters() { searchQuery.value = ''; activeScope.value = ''; page.value = 1 }

const filtered = computed(() => {
  let rows = budgetStore.items.filter(b => {
    if (activeScope.value && b.requestStatus !== activeScope.value) return false
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      if (!b.entityName.toLowerCase().includes(q) && !(b.courseTitle ?? '').toLowerCase().includes(q)) return false
    }
    return true
  })
  const f = sortKey.value as keyof BudgetLine
  rows = [...rows].sort((a, b) => {
    const va = a[f], vb = b[f]
    const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va ?? '').localeCompare(String(vb ?? ''))
    return sortDir.value === 'asc' ? cmp : -cmp
  })
  return rows
})

const totalCount = computed(() => filtered.value.length)
const pageItems = computed(() => filtered.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value))

const showCreate = ref(false)
const error = ref<string | null>(null)
const form = reactive({ year: new Date().getFullYear(), entityName: '', courseId: '', allocated: 0, comment: '' })

function resetForm() {
  Object.assign(form, { year: new Date().getFullYear(), entityName: '', courseId: '', allocated: 0, comment: '' })
  error.value = null
}

function validate(): boolean {
  if (!form.year) { error.value = "L'année est requise"; return false }
  if (!form.entityName.trim()) { error.value = "L'entité est requise"; return false }
  if (!form.allocated || form.allocated <= 0) { error.value = 'Le montant demandé doit être supérieur à 0'; return false }
  error.value = null
  return true
}

const { submitting, guard } = useSubmitGuard()
async function create() {
  if (!validate()) return
  try {
    await guard(() => withToast('Soumission…', async () => {
      const course = courseStore.items.find(c => c.id === form.courseId)
      budgetStore.requestBudget({
        year: form.year,
        entityName: form.entityName.trim(),
        courseTitle: course?.title,
        allocated: form.allocated,
        comment: form.comment.trim() || undefined,
      })
    }, () => 'Soumission impossible'))
    showCreate.value = false
    resetForm()
  } catch (e) {
    error.value = getApiErrorMessage(e, 'Soumission impossible')
  }
}
</script>
