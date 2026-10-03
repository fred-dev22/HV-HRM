<template>
  <ListPageLayout
    title="Catalogue de formations"
    :subtitle="`${courseStore.items.length} formation(s)`"
    :columns="columns"
    :items="pageItems"
    :total="totalCount"
    :total-text="`${totalCount} formation(s)`"
    search-placeholder="Rechercher une formation, une catégorie…"
    :page-size-options="[15, 25, 50]"
    scope-label="Formations :"
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
      <button :class="L.btnPrimary" @click="showCreate = true">
        <Plus class="w-4 h-4" /> Nouvelle formation
      </button>
    </template>

    <!-- KPIs -->
    <template #above-table>
      <div class="grid grid-cols-3 gap-2.5 mb-3.5 max-md:grid-cols-1">
        <div :class="kpiItem">
          <div :class="kpiIcon" class="bg-warning-bg"><Clock class="w-[18px] h-[18px] text-warning" /></div>
          <div><div :class="kpiVal">{{ courseStore.inPreparationCount }}</div><div :class="kpiLbl">En préparation</div></div>
        </div>
        <div :class="kpiItem">
          <div :class="kpiIcon" class="bg-info-bg"><GraduationCap class="w-[18px] h-[18px] text-info" /></div>
          <div><div :class="kpiVal">{{ courseStore.inProgressCount }}</div><div :class="kpiLbl">En cours</div></div>
        </div>
        <div :class="kpiItem">
          <div :class="kpiIcon" class="bg-neutral-bg"><Archive class="w-[18px] h-[18px] text-neutral" /></div>
          <div><div :class="kpiVal">{{ archivedCount }}</div><div :class="kpiLbl">Archivées</div></div>
        </div>
      </div>
    </template>

    <!-- Filtres -->
    <template #filters>
      <div :class="L.fpField">
        <label :class="L.fpFieldLabel">Catégorie</label>
        <select v-model="fCategory" :class="L.fpSelect">
          <option value="">Toutes</option>
          <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
        </select>
      </div>
      <button class="mt-auto py-[7px] bg-transparent border-0 text-xs text-muted-foreground cursor-pointer text-left hover:text-primary" @click="resetFilters">Réinitialiser les filtres</button>
    </template>

    <!-- Cellules -->
    <template #cell-title="{ item }">
      <span class="font-medium text-foreground text-xs truncate">{{ item.title }}</span>
    </template>
    <template #cell-category="{ item }"><span class="text-muted-foreground text-xs truncate">{{ item.category }}</span></template>
    <template #cell-providerName="{ item }"><span class="text-muted-foreground text-xs truncate">{{ item.providerName ?? '-' }}</span></template>
    <template #cell-durationHours="{ item }"><span class="text-xs text-foreground">{{ item.durationHours }} h</span></template>
    <template #cell-sessionsCount="{ item }"><span class="text-xs text-foreground">{{ item.sessionsCount }}</span></template>
    <template #cell-status="{ item }"><StatusPill :status="item.status" /></template>

    <!-- Aperçu rapide -->
    <template #details-panel="{ item }">
      <div class="flex flex-col gap-3.5">
        <div>
          <div class="text-sm font-semibold text-foreground truncate">{{ item.title }}</div>
          <div class="text-[11px] text-muted-foreground truncate">{{ item.category }} · {{ item.durationHours }} h</div>
        </div>
        <div><StatusPill :status="item.status" /></div>
        <div class="grid grid-cols-2 gap-2 text-[12px]">
          <div><div class="text-muted-foreground text-[11px]">Prestataire</div>{{ item.providerName ?? 'Non défini' }}</div>
          <div><div class="text-muted-foreground text-[11px]">Sessions</div>{{ item.sessionsCount }}</div>
          <div class="col-span-2"><div class="text-muted-foreground text-[11px]">Budget</div>{{ formatMga(item.budgetUsed) }} / {{ formatMga(item.budgetAllocated) }}</div>
        </div>
        <button :class="L.btnPrimary" class="w-full justify-center" @click="openCard(item)">Ouvrir la fiche</button>
      </div>
    </template>

    <template #empty>
      <GraduationCap class="w-8 h-8" />
      <p class="text-[13px]">Aucune formation</p>
    </template>

    <!-- Création -->
    <CreateModalShell
      v-if="showCreate"
      title="Nouvelle formation"
      banner-label="Nouvelle formation"
      create-label="Créer"
      :is-saving="submitting"
      :save-error="error"
      @close="showCreate = false"
      @create="create"
    >
      <template #form>
        <div class="flex-1 overflow-auto px-6 py-5">
          <div class="max-w-3xl mx-auto">

            <FormSection title="Formation">
              <div class="grid grid-cols-2 gap-x-6 gap-y-4 max-sm:grid-cols-1">
                <div :class="cls.field" class="col-span-2">
                  <label :class="cls.fieldLabel">Intitulé <span class="text-danger">*</span></label>
                  <input v-model="form.title" :class="cls.fieldInput" placeholder="ex : Excel avancé, Management d'équipe…" />
                </div>
                <div :class="cls.field">
                  <label :class="cls.fieldLabel">Catégorie <span class="text-danger">*</span></label>
                  <input v-model="form.category" :class="cls.fieldInput" placeholder="ex : Bureautique, Leadership, HSE…" />
                </div>
                <div :class="cls.field">
                  <label :class="cls.fieldLabel">Durée (heures) <span class="text-danger">*</span></label>
                  <input type="number" min="1" v-model.number="form.durationHours" :class="cls.fieldInput" />
                </div>
                <div :class="cls.field">
                  <label :class="cls.fieldLabel">Effectif maximum <span class="text-danger">*</span></label>
                  <input type="number" min="1" v-model.number="form.maxParticipants" :class="cls.fieldInput" />
                </div>
                <div :class="cls.field">
                  <label :class="cls.fieldLabel">Prestataire <span :class="cls.fieldOptional">(optionnel)</span></label>
                  <select v-model="form.providerId" :class="cls.fieldSelect">
                    <option value="">Aucun</option>
                    <option v-for="p in providerStore.items" :key="p.id" :value="p.id">{{ p.name }}</option>
                  </select>
                </div>
              </div>
            </FormSection>

            <FormSection title="Description">
              <div :class="cls.field">
                <label :class="cls.fieldLabel">Description <span class="text-danger">*</span></label>
                <textarea v-model="form.description" :class="cls.fieldTextarea" rows="4" placeholder="Objectifs, programme, public visé…"></textarea>
              </div>
            </FormSection>

            <FormSection title="Budget">
              <div :class="cls.field" class="max-w-[240px]">
                <label :class="cls.fieldLabel">Budget alloué (MGA) <span class="text-danger">*</span></label>
                <input type="number" min="0" v-model.number="form.budgetAllocated" :class="cls.fieldInput" />
              </div>
            </FormSection>

          </div>
        </div>
      </template>
    </CreateModalShell>

    <!-- Fiche complète -->
    <CourseCard v-if="openCardId !== null" :items="filtered" :item-id="openCardId" @close="openCardId = null" />
  </ListPageLayout>
</template>

<script setup lang="ts">
/**
 * Catalogue de formations (Course), module Formation (backend /training,
 * voir src/stores/training). Calquée sur JobOffersView.vue :
 * ListPageLayout + fiche plein écran (CourseCard.vue).
 */
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { Plus, Clock, GraduationCap, Archive } from 'lucide-vue-next'
import { ListPageLayout, StatusPill, CreateModalShell } from '../../components'
import type { ListColumn } from '../../components/shared/ListPageLayout.vue'
import FormSection from '../../components/ui/form-field/FormSection.vue'
import CourseCard from '../../components/training/CourseCard.vue'
import * as cls from '../../lib/formClasses'
import * as L from '../../lib/listClasses'
import { getApiErrorMessage } from '../../lib/api'
import { withToast } from '../../lib/withToast'
import { loadAll } from '../../lib/runAction'
import { useSubmitGuard } from '../../lib/submitGuard'
import { useCourseStore, useProviderStore } from '../../stores/training'
import type { Course } from '../../stores/training'

const courseStore = useCourseStore()
const providerStore = useProviderStore()

onMounted(() => loadAll(() => courseStore.fetchAll(), () => providerStore.fetchAll()))

const kpiItem = 'bg-card border border-border rounded-lg px-3.5 py-3 flex items-center gap-3'
const kpiIcon = 'w-9 h-9 rounded-lg flex items-center justify-center shrink-0'
const kpiVal = 'text-[22px] font-bold leading-none'
const kpiLbl = 'text-xs text-muted-foreground mt-0.5'

function formatMga(n: number): string { return `${n.toLocaleString('fr-FR')} MGA` }

/* ── Fiche plein écran ──────────────────────────────────────── */
const openCardId = ref<string | null>(null)
function openCard(item: Course) { openCardId.value = item.id }

/* ── Colonnes ───────────────────────────────────────────────── */
const columns: ListColumn[] = [
  { key: 'title', label: 'Intitulé', sortable: true, hideable: false, width: 240 },
  { key: 'category', label: 'Catégorie', sortable: true, width: 150 },
  { key: 'providerName', label: 'Prestataire', width: 170 },
  { key: 'durationHours', label: 'Durée', align: 'center', width: 90 },
  { key: 'sessionsCount', label: 'Sessions', align: 'center', width: 100 },
  { key: 'status', label: 'Statut', width: 140 },
]

/* ── KPIs ───────────────────────────────────────────────────── */
const archivedCount = computed(() => courseStore.items.filter(c => c.status === 'Archived').length)

/* ── Scope / recherche / tri / pagination ──────────────────────── */
const scopeOptions = [
  { value: '', label: 'Toutes' },
  { value: 'InPreparation', label: 'En préparation' },
  { value: 'InProgress', label: 'En cours' },
  { value: 'Archived', label: 'Archivée' },
]
const activeScope = ref('')
const fCategory = ref('')
const searchQuery = ref('')
const sortKey = ref('')
const sortDir = ref<'asc' | 'desc'>('asc')
const page = ref(1)
const pageSize = ref(15)

watch([activeScope, fCategory, searchQuery, pageSize], () => { page.value = 1 })

function resetFilters() {
  fCategory.value = ''; searchQuery.value = ''; activeScope.value = ''; page.value = 1
}

const categories = computed(() => [...new Set(courseStore.items.map(c => c.category))].sort())

const sortFieldMap: Record<string, keyof Course> = {
  title: 'title', category: 'category', durationHours: 'durationHours', sessionsCount: 'sessionsCount',
}

const filtered = computed(() => {
  let rows = courseStore.items.filter(c => {
    if (activeScope.value && c.status !== activeScope.value) return false
    if (fCategory.value && c.category !== fCategory.value) return false
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      if (!c.title.toLowerCase().includes(q) && !c.category.toLowerCase().includes(q)) return false
    }
    return true
  })
  if (sortKey.value && sortFieldMap[sortKey.value]) {
    const f = sortFieldMap[sortKey.value]!
    rows = [...rows].sort((a, b) => {
      const va = a[f], vb = b[f]
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

/* ── Création ───────────────────────────────────────────────── */
const showCreate = ref(false)
const error = ref<string | null>(null)
const form = reactive({
  title: '', category: '', description: '', durationHours: 7, maxParticipants: 10,
  providerId: '', budgetAllocated: 0,
})

function resetForm() {
  Object.assign(form, { title: '', category: '', description: '', durationHours: 7, maxParticipants: 10, providerId: '', budgetAllocated: 0 })
  error.value = null
}

function validate(): boolean {
  if (!form.title.trim()) { error.value = "L'intitulé est requis"; return false }
  if (!form.category.trim()) { error.value = 'La catégorie est requise'; return false }
  if (!form.durationHours || form.durationHours < 1) { error.value = "La durée doit être d'au moins 1 heure"; return false }
  if (!form.maxParticipants || form.maxParticipants < 1) { error.value = "L'effectif maximum doit être d'au moins 1"; return false }
  if (!form.description.trim()) { error.value = 'La description est requise'; return false }
  error.value = null
  return true
}

const { submitting, guard } = useSubmitGuard()
async function create() {
  if (!validate()) return
  try {
    await guard(() => withToast('Création…', () => courseStore.create({
      title: form.title.trim(),
      category: form.category.trim(),
      description: form.description.trim(),
      durationHours: form.durationHours,
      maxParticipants: form.maxParticipants,
      providerId: form.providerId || undefined,
      budgetAllocated: form.budgetAllocated,
    }), () => 'Création impossible'))
    showCreate.value = false
    resetForm()
  } catch (e) {
    error.value = getApiErrorMessage(e, 'Création impossible')
  }
}
</script>
