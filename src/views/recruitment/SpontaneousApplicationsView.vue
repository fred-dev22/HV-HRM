<template>
  <ListPageLayout
    title="Candidatures spontanées"
    :subtitle="`${filtered.length} candidature(s) spontanée(s)`"
    :columns="columns"
    :items="pageItems"
    :total="totalCount"
    :total-text="`${totalCount} candidature(s)`"
    search-placeholder="Rechercher un candidat, un email…"
    :page-size-options="[15, 25, 50]"
    scope-label="Candidatures :"
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
        <Plus class="w-4 h-4" /> Nouvelle candidature
      </button>
    </template>

    <!-- Actions contextuelles (ligne sélectionnée) -->
    <template #row-actions="{ item }">
      <ApplicationWorkflowActions :item="item" />
    </template>

    <!-- KPIs -->
    <template #above-table>
      <div class="grid grid-cols-3 gap-2.5 mb-3.5 max-md:grid-cols-1">
        <div :class="kpiItem">
          <div :class="kpiIcon" class="bg-primary/10"><Users class="w-[18px] h-[18px] text-primary" /></div>
          <div><div :class="kpiVal">{{ applicationStore.spontaneous.length }}</div><div :class="kpiLbl">Total</div></div>
        </div>
        <div :class="kpiItem">
          <div :class="kpiIcon" class="bg-info-bg"><UserPlus class="w-[18px] h-[18px] text-info" /></div>
          <div><div :class="kpiVal">{{ newCount }}</div><div :class="kpiLbl">Nouvelles</div></div>
        </div>
        <div :class="kpiItem">
          <div :class="kpiIcon" class="bg-warning-bg"><Clock class="w-[18px] h-[18px] text-warning" /></div>
          <div><div :class="kpiVal">{{ inReviewCount }}</div><div :class="kpiLbl">En cours</div></div>
        </div>
      </div>
    </template>

    <!-- Cellules -->
    <template #cell-candidate="{ item }"><span class="font-medium text-foreground text-[13px] truncate">{{ item.candidateName }}</span></template>
    <template #cell-candidateEmail="{ item }"><span class="text-muted-foreground text-xs truncate">{{ item.candidateEmail }}</span></template>
    <template #cell-candidatePhone="{ item }"><span class="text-muted-foreground text-xs whitespace-nowrap">{{ item.candidatePhone }}</span></template>
    <template #cell-cvFileName="{ item }">
      <span class="inline-flex items-center gap-1 text-xs text-muted-foreground min-w-0">
        <FileText class="w-3.5 h-3.5 shrink-0" /> <span class="truncate">{{ item.cvFileName }}</span>
      </span>
    </template>
    <template #cell-status="{ item }"><StatusPill :status="item.status" /></template>
    <template #cell-appliedAt="{ item }"><span class="text-muted-foreground text-xs">{{ formatDate(item.appliedAt) }}</span></template>

    <!-- Aperçu rapide -->
    <template #details-panel="{ item }">
      <div class="flex flex-col gap-3.5">
        <div>
          <div class="text-sm font-semibold text-foreground truncate">{{ item.candidateName }}</div>
          <div class="text-[11px] text-muted-foreground truncate">{{ item.candidateEmail }}</div>
        </div>
        <div><StatusPill :status="item.status" /></div>

        <div class="grid grid-cols-1 gap-2 text-[12px]">
          <div><div class="text-muted-foreground text-[11px]">Offre liée</div>Candidature spontanée</div>
          <div><div class="text-muted-foreground text-[11px]">Candidature reçue le</div>{{ formatDate(item.appliedAt) }}</div>
        </div>

        <ApplicationWorkflowActions :item="item" />

        <button :class="L.btnPrimary" class="w-full justify-center" @click="openCard(item)">Ouvrir la fiche</button>
      </div>
    </template>

    <template #empty>
      <Users class="w-8 h-8" />
      <p class="text-[13px]">Aucune candidature spontanée pour le moment.</p>
    </template>

    <!-- Création : un RH enregistre un CV reçu par un autre canal (mail,
         dépôt en personne…) — voir "Réception et enregistrement des
         candidatures spontanées" dans les specs client. -->
    <CreateModalShell
      v-if="showCreate"
      title="Nouvelle candidature spontanée"
      banner-label="Candidature spontanée"
      create-label="Enregistrer"
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
                  <label :class="cls.fieldLabel">Nom complet <span class="text-danger">*</span></label>
                  <input v-model="form.candidateName" :class="cls.fieldInput" placeholder="Prénom et nom" />
                </div>
                <div :class="cls.field">
                  <label :class="cls.fieldLabel">Email <span class="text-danger">*</span></label>
                  <input v-model="form.candidateEmail" type="email" :class="cls.fieldInput" placeholder="candidat@exemple.com" />
                </div>
                <div :class="cls.field">
                  <label :class="cls.fieldLabel">Téléphone <span class="text-danger">*</span></label>
                  <input v-model="form.candidatePhone" :class="cls.fieldInput" placeholder="034 00 000 00" />
                </div>
              </div>
            </FormSection>

            <FormSection title="CV">
              <label
                class="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed rounded-lg py-8 px-4 text-center transition-colors cursor-pointer"
                :class="dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'"
                @dragover.prevent="dragOver = true"
                @dragleave.prevent="dragOver = false"
                @drop.prevent="onDrop"
              >
                <div class="w-9 h-9 rounded-full flex items-center justify-center" :class="form.cvFileName ? 'bg-success-bg' : 'bg-primary/10'">
                  <FileCheck2 v-if="form.cvFileName" class="w-4.5 h-4.5 text-success" />
                  <UploadCloud v-else class="w-4.5 h-4.5 text-primary" />
                </div>
                <span v-if="form.cvFileName" class="text-[13px] font-medium text-foreground">{{ form.cvFileName }}</span>
                <span v-else class="text-[13px] font-medium text-foreground">Glissez le CV ici, ou cliquez pour parcourir</span>
                <span class="text-[11px] text-muted-foreground">{{ form.cvFileName ? 'Cliquez pour remplacer le fichier' : 'PDF ou Word' }}</span>
                <input type="file" accept=".pdf,.doc,.docx" class="hidden" @change="onFileInput" />
              </label>
            </FormSection>
          </div>
        </div>
      </template>
    </CreateModalShell>

    <!-- Fiche (double-clic ou "Ouvrir la fiche") -->
    <ApplicationCard v-if="openCardId !== null" :items="filtered" :item-id="openCardId" @close="openCardId = null" />
  </ListPageLayout>
</template>

<script setup lang="ts">
/**
 * Liste des candidatures spontanées (Application, source "Spontaneous"),
 * module Recrutement, design uniquement (données fictives, voir
 * src/stores/recruitment). Calquée sur ApplicationsView.vue, sans colonne
 * "offre liée" (toujours vide par définition pour cette source).
 */
import { ref, reactive, watch, computed } from 'vue'
import { Users, UserPlus, Clock, FileText, Plus, UploadCloud, FileCheck2 } from 'lucide-vue-next'
import { ListPageLayout, StatusPill, CreateModalShell } from '../../components'
import type { ListColumn } from '../../components/shared/ListPageLayout.vue'
import FormSection from '../../components/ui/form-field/FormSection.vue'
import ApplicationCard from '../../components/recruitment/ApplicationCard.vue'
import ApplicationWorkflowActions from '../../components/recruitment/ApplicationWorkflowActions.vue'
import * as cls from '../../lib/formClasses'
import * as L from '../../lib/listClasses'
import { formatDate } from '../../lib/date'
import { useApplicationStore } from '../../stores/recruitment'
import type { Application } from '../../stores/recruitment'

const applicationStore = useApplicationStore()

/* ── Fiche plein écran ──────────────────────────────────────── */
const openCardId = ref<string | null>(null)
function openCard(item: Application) { openCardId.value = item.id }

/* ── Styles (KPI, repris à l'identique d'EmployeeListView.vue) ────── */
const kpiItem = 'bg-card border border-border rounded-lg px-3.5 py-3 flex items-center gap-3'
const kpiIcon = 'w-9 h-9 rounded-lg flex items-center justify-center shrink-0'
const kpiVal = 'text-[22px] font-bold leading-none'
const kpiLbl = 'text-xs text-muted-foreground mt-0.5'

/* ── Colonnes ───────────────────────────────────────────────── */
const columns: ListColumn[] = [
  { key: 'candidate', label: 'Candidat', sortable: true, hideable: false, width: 190 },
  { key: 'candidateEmail', label: 'Email', width: 210 },
  { key: 'candidatePhone', label: 'Téléphone', width: 140 },
  { key: 'cvFileName', label: 'CV', width: 190 },
  { key: 'status', label: 'Statut', width: 150 },
  { key: 'appliedAt', label: 'Date de candidature', sortable: true, width: 150 },
]

/* ── KPIs ───────────────────────────────────────────────────── */
const newCount = computed(() => applicationStore.spontaneous.filter(a => a.status === 'New').length)
const inReviewCount = computed(() => applicationStore.spontaneous.filter(a => a.status === 'InReview').length)

/* ── Scope / recherche / tri / pagination ──────────────────────
   Même pattern que EmployeeListView.vue : la vue calcule elle-même
   "filtered" puis passe la page déjà filtrée/triée à ListPageLayout. */
const scopeOptions = [
  { value: '', label: 'Toutes' },
  { value: 'New', label: 'Nouvelle' },
  { value: 'InReview', label: 'En cours' },
  { value: 'InterviewScheduled', label: 'Entretien planifié' },
  { value: 'Retained', label: 'Retenue' },
  { value: 'Rejected', label: 'Refusé' },
]
const activeScope = ref('')
const searchQuery = ref('')
const sortKey = ref('')
const sortDir = ref<'asc' | 'desc'>('asc')
const page = ref(1)
const pageSize = ref(15)

watch([activeScope, searchQuery, pageSize], () => { page.value = 1 })

function resetFilters() {
  searchQuery.value = ''; activeScope.value = ''; page.value = 1
}

const sortFieldMap: Partial<Record<string, keyof Application>> = {
  candidate: 'candidateName', appliedAt: 'appliedAt',
}

const filtered = computed(() => {
  let rows = applicationStore.spontaneous.filter(a => {
    if (activeScope.value && a.status !== activeScope.value) return false
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      if (!a.candidateName.toLowerCase().includes(q) && !a.candidateEmail.toLowerCase().includes(q)) return false
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

/* ── Création (un RH enregistre un CV reçu par un autre canal) ───── */
const showCreate = ref(false)
const error = ref<string | null>(null)
const dragOver = ref(false)
const form = reactive({ candidateName: '', candidateEmail: '', candidatePhone: '', cvFileName: '' })

function resetForm() {
  Object.assign(form, { candidateName: '', candidateEmail: '', candidatePhone: '', cvFileName: '' })
  error.value = null
}

function setFile(file: File | undefined) {
  if (!file) return
  form.cvFileName = file.name
}
function onFileInput(e: Event) { setFile((e.target as HTMLInputElement).files?.[0]) }
function onDrop(e: DragEvent) { dragOver.value = false; setFile(e.dataTransfer?.files?.[0]) }

function validate(): boolean {
  if (!form.candidateName.trim()) { error.value = 'Le nom complet est requis'; return false }
  if (!form.candidateEmail.trim()) { error.value = "L'email est requis"; return false }
  if (!form.candidatePhone.trim()) { error.value = 'Le téléphone est requis'; return false }
  if (!form.cvFileName) { error.value = 'Le CV est requis'; return false }
  error.value = null
  return true
}

function create() {
  if (!validate()) return
  applicationStore.applySpontaneous({
    candidateName: form.candidateName.trim(), candidateEmail: form.candidateEmail.trim(),
    candidatePhone: form.candidatePhone.trim(), cvFileName: form.cvFileName,
  })
  showCreate.value = false
  resetForm()
}
</script>
