<template>
  <ListPageLayout
    title="CVthèque / Potentiels"
    :subtitle="`${talentPoolStore.items.length} profil(s)`"
    :columns="columns"
    :items="pageItems"
    :total="totalCount"
    :total-text="`${totalCount} profil(s)`"
    search-placeholder="Rechercher un candidat, un tag…"
    :page-size-options="[15, 25, 50]"
    scope-label="Profils :"
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
        <UserPlus class="w-4 h-4" /> Ajouter un profil
      </button>
    </template>

    <!-- KPIs -->
    <template #above-table>
      <div class="grid grid-cols-2 gap-2.5 mb-3.5 max-sm:grid-cols-1">
        <div :class="kpiItem">
          <div :class="kpiIcon" class="bg-primary/10"><Users class="w-[18px] h-[18px] text-primary" /></div>
          <div><div :class="kpiVal">{{ talentPoolStore.items.length }}</div><div :class="kpiLbl">Profils dans le vivier</div></div>
        </div>
        <div :class="kpiItem">
          <div :class="kpiIcon" class="bg-info-bg"><Tag class="w-[18px] h-[18px] text-info" /></div>
          <div><div :class="kpiVal">{{ distinctTagsCount }}</div><div :class="kpiLbl">Tags distincts</div></div>
        </div>
      </div>
    </template>

    <!-- Actions contextuelles (ligne sélectionnée) -->
    <template #row-actions="{ item }">
      <TalentPoolWorkflowActions :item="item" />
    </template>

    <!-- Cellules -->
    <template #cell-candidateName="{ item }"><span class="font-medium text-foreground text-xs truncate">{{ item.candidateName }}</span></template>
    <template #cell-candidateEmail="{ item }"><span class="text-muted-foreground text-xs truncate">{{ item.candidateEmail }}</span></template>
    <template #cell-candidatePhone="{ item }"><span class="text-muted-foreground text-xs truncate">{{ item.candidatePhone }}</span></template>
    <template #cell-tags="{ item }">
      <div class="flex flex-wrap gap-1">
        <span v-for="tag in item.tags" :key="tag" class="text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap bg-primary/10 text-primary">{{ tag }}</span>
        <span v-if="item.tags.length === 0" class="text-xs text-muted-foreground">Aucun tag</span>
      </div>
    </template>
    <template #cell-notes="{ item }"><span class="text-muted-foreground text-xs truncate" :title="item.notes">{{ item.notes || 'Aucune note' }}</span></template>
    <template #cell-addedAt="{ item }"><span class="text-muted-foreground text-xs">{{ formatDate(item.addedAt) }}</span></template>
    <template #cell-status="{ item }">
      <span
        class="text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
        :class="item.status === 'Open' ? 'bg-success-bg text-success' : 'bg-neutral-bg text-neutral'"
      >{{ item.status === 'Open' ? 'Ouvert' : 'Fermé' }}</span>
    </template>

    <!-- Aperçu rapide -->
    <template #details-panel="{ item }">
      <div class="flex flex-col gap-3.5">
        <div>
          <div class="text-sm font-semibold text-foreground truncate">{{ item.candidateName }}</div>
          <div class="text-[11px] text-muted-foreground truncate">Ajouté le {{ formatDate(item.addedAt) }}</div>
        </div>
        <div>
          <span
            class="text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
            :class="item.status === 'Open' ? 'bg-success-bg text-success' : 'bg-neutral-bg text-neutral'"
          >{{ item.status === 'Open' ? 'Ouvert' : 'Fermé' }}</span>
        </div>
        <div class="grid grid-cols-1 gap-2 text-[12px]">
          <div><div class="text-muted-foreground text-[11px]">Email</div>{{ item.candidateEmail }}</div>
          <div><div class="text-muted-foreground text-[11px]">Téléphone</div>{{ item.candidatePhone }}</div>
        </div>
        <div v-if="item.tags.length > 0">
          <div class="text-muted-foreground text-[11px] mb-1">Tags</div>
          <div class="flex flex-wrap gap-1">
            <span v-for="tag in item.tags" :key="tag" class="text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap bg-primary/10 text-primary">{{ tag }}</span>
          </div>
        </div>
        <button :class="L.btnPrimary" class="w-full justify-center" @click="openCard(item)">Ouvrir la fiche</button>
        <TalentPoolWorkflowActions :item="item" />
      </div>
    </template>

    <template #empty>
      <Users class="w-8 h-8" />
      <p class="text-[13px]">Aucun profil dans le vivier</p>
    </template>

    <!-- Création -->
    <CreateModalShell
      v-if="showCreate"
      title="Ajouter un profil"
      banner-label="Nouveau profil au vivier de talents"
      create-label="Ajouter"
      :save-error="error"
      @close="showCreate = false"
      @create="create"
    >
      <template #form>
        <div class="flex-1 overflow-auto px-6 py-5">
          <div class="max-w-3xl mx-auto">

            <FormSection title="Candidat">
              <div class="grid grid-cols-2 gap-x-6 gap-y-4 max-sm:grid-cols-1">
                <div :class="cls.field" class="col-span-2">
                  <label :class="cls.fieldLabel">Candidat <span class="text-danger">*</span></label>
                  <input v-model="form.candidateName" :class="cls.fieldInput" placeholder="Nom complet du candidat" />
                </div>
                <div :class="cls.field">
                  <label :class="cls.fieldLabel">Email <span class="text-danger">*</span></label>
                  <input type="email" v-model="form.candidateEmail" :class="cls.fieldInput" placeholder="exemple@mail.com" />
                </div>
                <div :class="cls.field">
                  <label :class="cls.fieldLabel">Téléphone <span :class="cls.fieldOptional">(optionnel)</span></label>
                  <input v-model="form.candidatePhone" :class="cls.fieldInput" placeholder="034 12 345 67" />
                </div>
              </div>
            </FormSection>

            <FormSection title="Profil">
              <div :class="cls.field" class="mb-4">
                <label :class="cls.fieldLabel">Tags <span :class="cls.fieldOptional">(optionnel, séparés par des virgules)</span></label>
                <input v-model="tagsInput" :class="cls.fieldInput" placeholder="ex : Comptable, Bilingue FR/EN" />
              </div>
              <div :class="cls.field">
                <label :class="cls.fieldLabel">Notes <span :class="cls.fieldOptional">(optionnel)</span></label>
                <textarea v-model="form.notes" :class="cls.fieldTextarea" rows="4" placeholder="Contexte, disponibilité, remarques…"></textarea>
              </div>
            </FormSection>

          </div>
        </div>
      </template>
    </CreateModalShell>

    <!-- Fiche (double-clic) -->
    <TalentPoolCard v-if="openCardId !== null" :entries="filtered" :entry-id="openCardId" @close="openCardId = null" />
  </ListPageLayout>
</template>

<script setup lang="ts">
/**
 * CVthèque / Potentiels (TalentPoolEntry), module Recrutement, design
 * uniquement (données fictives, voir src/stores/recruitment). Calquée sur
 * EmployeeListView.vue / HiringRequestsView.vue : ListPageLayout, mais sans
 * workflow (TalentPoolEntry n'a pas de statut) : seules les actions
 * "Ajouter un profil" et "Retirer du vivier" existent côté store.
 */
import { ref, reactive, computed, watch } from 'vue'
import { UserPlus, Users, Tag } from 'lucide-vue-next'
import { ListPageLayout, CreateModalShell } from '../../components'
import type { ListColumn } from '../../components/shared/ListPageLayout.vue'
import FormSection from '../../components/ui/form-field/FormSection.vue'
import TalentPoolCard from '../../components/recruitment/TalentPoolCard.vue'
import TalentPoolWorkflowActions from '../../components/recruitment/TalentPoolWorkflowActions.vue'
import * as cls from '../../lib/formClasses'
import * as L from '../../lib/listClasses'
import { formatDate } from '../../lib/date'
import { useTalentPoolStore } from '../../stores/recruitment'
import type { TalentPoolEntry } from '../../stores/recruitment'

const talentPoolStore = useTalentPoolStore()

/* ── Styles (KPI, repris à l'identique du langage visuel des autres
   écrans du module) ────────────────────────────────────────────── */
const kpiItem = 'bg-card border border-border rounded-lg px-3.5 py-3 flex items-center gap-3'
const kpiIcon = 'w-9 h-9 rounded-lg flex items-center justify-center shrink-0'
const kpiVal = 'text-[22px] font-bold leading-none'
const kpiLbl = 'text-xs text-muted-foreground mt-0.5'

/* ── Colonnes ───────────────────────────────────────────────── */
const columns: ListColumn[] = [
  { key: 'candidateName', label: 'Candidat', sortable: true, hideable: false, width: 190 },
  { key: 'candidateEmail', label: 'Email', sortable: true, width: 210 },
  { key: 'candidatePhone', label: 'Téléphone', width: 130 },
  { key: 'tags', label: 'Tags', width: 220 },
  { key: 'notes', label: 'Notes', width: 240 },
  { key: 'addedAt', label: 'Ajouté le', sortable: true, width: 110 },
  { key: 'status', label: 'Statut', width: 100 },
]

/* ── KPIs ───────────────────────────────────────────────────── */
const distinctTagsCount = computed(() => {
  const set = new Set<string>()
  talentPoolStore.items.forEach(e => e.tags.forEach(t => set.add(t)))
  return set.size
})

/* ── Recherche / tri / pagination ────────────────────────────────
   Même pattern que EmployeeListView.vue : la vue calcule elle-même
   "filtered" puis passe la page déjà filtrée/triée à ListPageLayout.
   La recherche filtre à la fois sur le nom du candidat et sur les tags. */
const scopeOptions = [
  { value: '', label: 'Tous' },
  { value: 'Open', label: 'Ouvert' },
  { value: 'Closed', label: 'Fermé' },
]
const activeScope = ref('')
const searchQuery = ref('')
const sortKey = ref('')
const sortDir = ref<'asc' | 'desc'>('asc')
const page = ref(1)
const pageSize = ref(15)

watch([activeScope, searchQuery, pageSize], () => { page.value = 1 })

const sortFieldMap: Record<string, keyof TalentPoolEntry> = {
  candidateName: 'candidateName', candidateEmail: 'candidateEmail', addedAt: 'addedAt',
}

const filtered = computed(() => {
  let rows = talentPoolStore.items.filter(e => {
    if (activeScope.value && e.status !== activeScope.value) return false
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      const matchesName = e.candidateName.toLowerCase().includes(q)
      const matchesTag = e.tags.some(t => t.toLowerCase().includes(q))
      if (!matchesName && !matchesTag) return false
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

/* ── Création ───────────────────────────────────────────────── */
const showCreate = ref(false)
const error = ref<string | null>(null)
const tagsInput = ref('')
const form = reactive({ candidateName: '', candidateEmail: '', candidatePhone: '', notes: '' })

function resetForm() {
  Object.assign(form, { candidateName: '', candidateEmail: '', candidatePhone: '', notes: '' })
  tagsInput.value = ''
  error.value = null
}

function validate(): boolean {
  if (!form.candidateName.trim()) { error.value = 'Le nom du candidat est requis'; return false }
  if (!form.candidateEmail.trim()) { error.value = "L'email est requis"; return false }
  error.value = null
  return true
}

function buildPayload() {
  return {
    candidateName: form.candidateName.trim(),
    candidateEmail: form.candidateEmail.trim(),
    candidatePhone: form.candidatePhone.trim(),
    tags: tagsInput.value.split(',').map(t => t.trim()).filter(Boolean),
    notes: form.notes.trim(),
  }
}

function create() {
  if (!validate()) return
  talentPoolStore.add(buildPayload())
  showCreate.value = false
  resetForm()
}

/* ── Fiche complète (double-clic ou "Ouvrir la fiche") ───────── */
const openCardId = ref<string | null>(null)
function openCard(item: TalentPoolEntry) { openCardId.value = item.id }
</script>
