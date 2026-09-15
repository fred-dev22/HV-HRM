<template>
  <ListPageLayout
    title="Entités organisationnelles"
    subtitle="Structure hiérarchique de HV"
    :columns="columns"
    :items="pageItems"
    :total="totalCount"
    :total-text="`${totalCount} entité(s)`"
    :loading="store.loading"
    row-key="id"
    search-placeholder="Rechercher une entité…"
    scope-label="Entités :"
    :scope-options="scopeOptions"
    :view-modes="viewModes"
    v-model:view-mode="viewMode"
    v-model:scope="activeScope"
    v-model:search-query="searchQuery"
    v-model:sort-key="sortKey"
    v-model:sort-dir="sortDir"
    v-model:page="page"
    v-model:page-size="pageSize"
    @reset-filters="resetFilters"
    @open-card="(e) => openCard(e.id)"
  >
    <!-- Bouton "Nouvelle entité" -->
    <template #header-actions>
      <div v-if="auth.hasPermission('ENTITE_CREER')" class="flex items-center gap-2">
        <button :class="L.btnOutline" @click="showImport = true">
          <Upload class="w-4 h-4" /> Importer
        </button>
        <button :class="L.btnPrimary" @click="showCreate = true">
          <Plus class="w-4 h-4" /> Nouvelle entité
        </button>
      </div>
    </template>

    <!-- KPIs -->
    <template #above-table>
      <div class="grid grid-cols-4 gap-2.5 mb-4 max-md:grid-cols-2">
        <div :class="kpiItem"><div :class="kpiIcon" class="bg-success-bg"><Building class="w-[18px] h-[18px] text-success" /></div><div><div :class="kpiVal">{{ store.entities.length }}</div><div :class="kpiLbl">Total entités</div></div></div>
        <div :class="kpiItem"><div :class="kpiIcon" class="bg-success-bg"><Users class="w-[18px] h-[18px] text-success" /></div><div><div :class="kpiVal">{{ store.totalHeadcount }}</div><div :class="kpiLbl">Effectif total</div></div></div>
        <div :class="kpiItem"><div :class="kpiIcon" class="bg-primary/10"><Check class="w-[18px] h-[18px] text-primary" /></div><div><div :class="kpiVal">{{ store.approvedEntities.length }}</div><div :class="kpiLbl">Approuvées</div></div></div>
        <div :class="kpiItem"><div :class="[kpiIcon, store.pendingEntities.length > 0 ? 'bg-warning-bg' : 'bg-background']"><Clock class="w-[18px] h-[18px]" :class="store.pendingEntities.length > 0 ? 'text-warning' : 'text-muted-foreground'" /></div><div><div :class="kpiVal">{{ store.pendingEntities.length }}</div><div :class="kpiLbl">En attente</div></div></div>
      </div>
    </template>

    <!-- Actions contextuelles -->
    <template #row-actions="{ item }">
      <button :class="quickBtn" @click="openCard(item.id)">Ouvrir la fiche</button>
      <EntityWorkflowActions :entity="item" />
    </template>

    <!-- Filtres -->
    <template #filters>
      <div :class="L.fpField">
        <label :class="L.fpFieldLabel">Type</label>
        <select v-model="filterType" :class="L.fpSelect">
          <option value="">Tous les types</option>
          <option value="Direction">Direction</option>
          <option value="Department">Département</option>
          <option value="Service">Service</option>
        </select>
      </div>
      <button class="mt-auto py-[7px] bg-transparent border-0 text-xs text-muted-foreground cursor-pointer text-left hover:text-primary" @click="resetFilters">
        Réinitialiser les filtres
      </button>
    </template>

    <!-- Cellules -->
    <template #cell-code="{ item }">
      <span class="text-[11px] font-bold px-[7px] py-0.5 rounded bg-primary/10 text-primary tracking-[0.04em]">{{ item.code }}</span>
    </template>
    <template #cell-name="{ item }"><span class="font-medium">{{ item.name }}</span></template>
    <template #cell-type="{ item }">
      <span class="text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap" :class="typeBadge(item.type)">{{ typeLabel(item.type) }}</span>
    </template>
    <template #cell-parent="{ item }"><span class="text-muted-foreground text-xs">{{ parentName(item.id, item.parentId) }}</span></template>
    <template #cell-responsible="{ item }"><span class="text-muted-foreground text-xs">{{ item.responsibleName || '-' }}</span></template>
    <template #cell-headcount="{ item }">
      <span class="text-[11px] text-muted-foreground inline-flex items-center gap-[3px]"><Users class="w-3 h-3" /> {{ item.headcount }}</span>
    </template>
    <template #cell-status="{ item }"><StatusPill :status="item.status" /></template>

    <!-- Aperçu rapide -->
    <template #details-panel="{ item }">
      <div class="flex flex-col gap-3.5">
        <div>
          <span class="text-[11px] font-bold px-[7px] py-0.5 rounded bg-primary/10 text-primary tracking-[0.04em]">{{ item.code }}</span>
          <div class="text-sm font-semibold text-foreground mt-1.5">{{ item.name }}</div>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-[11px] font-medium px-2 py-0.5 rounded-full" :class="typeBadge(item.type)">{{ typeLabel(item.type) }}</span>
          <StatusPill :status="item.status" />
        </div>
        <div class="grid grid-cols-2 gap-2 text-[12px]">
          <div><div class="text-muted-foreground text-[11px]">Entité parente</div>{{ parentName(item.id, item.parentId) }}</div>
          <div><div class="text-muted-foreground text-[11px]">Effectif</div>{{ item.headcount }}</div>
          <div class="col-span-2"><div class="text-muted-foreground text-[11px]">Responsable</div>{{ item.responsibleName || '-' }}</div>
        </div>
        <button :class="L.btnPrimary" class="w-full justify-center" @click="openCard(item.id)">Ouvrir la fiche</button>
        <EntityWorkflowActions :entity="item" />
      </div>
    </template>

    <!-- État vide -->
    <template #empty>
      <Building class="w-8 h-8" />
      <p class="text-[13px]">Aucune entité trouvée</p>
    </template>

    <!-- Affichage hiérarchique / organigramme -->
    <template #custom-view>
      <div v-if="viewMode === 'tree'" class="p-3.5">
        <div class="flex items-center gap-2 mb-3">
          <button :class="[L.btnOutline, '!px-3 !py-1.5 !text-xs']" @click="expandAll"><Maximize2 class="w-3.5 h-3.5" /> Tout déplier</button>
          <button :class="[L.btnOutline, '!px-3 !py-1.5 !text-xs']" @click="collapseAll"><Minimize2 class="w-3.5 h-3.5" /> Tout replier</button>
          <span class="text-[11px] text-muted-foreground flex items-center gap-1 ml-auto"><Info class="w-3.5 h-3.5" /> Cliquez sur un nœud pour ouvrir la fiche</span>
        </div>
        <div class="overflow-x-auto px-1 pt-1 pb-4 min-w-0">
          <OrgNode v-for="root in store.buildTree" :key="root.id" :entity="root" />
        </div>
      </div>
      <div v-else-if="viewMode === 'orgchart'" class="p-3.5">
        <OrgChartView />
      </div>
    </template>

    <!-- Fiche (modal) + création -->
    <EntityCard v-if="openCardId !== null" :entities="store.entities" :entity-id="openCardId" @close="openCardId = null" />
    <EntityCreate v-if="showCreate" @close="showCreate = false" />
    <ImportWizardModal v-if="showImport" :open="showImport" :config="entityImportConfig" @close="showImport = false" @imported="store.fetchAll()" />
  </ListPageLayout>
</template>

<script setup lang="ts">
import { ref, computed, watch, provide, type Component } from 'vue'
import {
  Plus, Upload, List, ListTree, Network, Building, Users, Check, Clock, Maximize2, Minimize2, Info,
} from 'lucide-vue-next'
import { StatusPill, ListPageLayout } from '../../components'
import type { ListColumn } from '../../components/shared/ListPageLayout.vue'
import EntityCard from '../../components/entities/EntityCard.vue'
import EntityCreate from '../../components/entities/EntityCreate.vue'
import EntityWorkflowActions from '../../components/entities/EntityWorkflowActions.vue'
import OrgNode from './OrgNode.vue'
import OrgChartView from '../../components/OrgChartView.vue'
import ImportWizardModal from '../../components/shared/import/ImportWizardModal.vue'
import { buildEntityImportConfig } from '../../components/shared/import/configs/entityImportConfig'
import * as L from '../../lib/listClasses'
import { useEntityStore } from '../../stores/entities'
import { useAuthStore } from '../../stores/auth'
import type { Entity, EntityType } from '../../types'

const store = useEntityStore()
const auth = useAuthStore()
if (store.entities.length === 0) store.fetchAll()

const quickBtn = 'px-2.5 py-[5px] rounded text-xs font-medium cursor-pointer bg-background text-muted-foreground hover:text-foreground'

const kpiItem = 'bg-card border border-border rounded-lg px-3.5 py-3 flex items-center gap-3'
const kpiIcon = 'w-9 h-9 rounded-lg flex items-center justify-center shrink-0'
const kpiVal = 'text-[22px] font-bold leading-none'
const kpiLbl = 'text-xs text-muted-foreground mt-0.5'

/* ── Modes d'affichage ──────────────────────────────────────── */
const viewModes: { value: string; label: string; icon: Component }[] = [
  { value: 'list', label: 'Liste', icon: List },
  { value: 'tree', label: 'Vue hiérarchique', icon: ListTree },
  { value: 'orgchart', label: 'Organigramme', icon: Network },
]
const viewMode = ref('list')

/* ── Fiche & création ───────────────────────────────────────── */
const showCreate = ref(false)
const showImport = ref(false)
const entityImportConfig = computed(() => buildEntityImportConfig())
const openCardId = ref<string | null>(null)
function openCard(id: string) { openCardId.value = id }

// Le clic sur un nœud (arbre/organigramme) ouvre la fiche modale
provide('navigate-to-detail', (id: string) => openCard(id))

/* ── Arbre (collapse) ───────────────────────────────────────── */
const collapsedIds = ref<string[]>([])
provide('entity-collapsed', collapsedIds)
provide('entity-toggle', (id: string) => {
  collapsedIds.value = collapsedIds.value.includes(id)
    ? collapsedIds.value.filter(x => x !== id)
    : [...collapsedIds.value, id]
})
function expandAll() { collapsedIds.value = [] }
function collapseAll() {
  collapsedIds.value = store.entities.filter(e => store.entities.some(c => c.parentId === e.id)).map(e => e.id)
}

/* ── Colonnes ───────────────────────────────────────────────── */
const columns = computed<ListColumn[]>(() => [
  { key: 'code', label: 'Code', sortable: true, hideable: false, width: 120 },
  { key: 'name', label: 'Nom', sortable: true, width: 210 },
  { key: 'type', label: 'Type', sortable: true, width: 140 },
  { key: 'parent', label: 'Entité parente', width: 180 },
  { key: 'responsible', label: 'Responsable', width: 170 },
  { key: 'headcount', label: 'Effectif', align: 'center', width: 100 },
  { key: 'status', label: 'Statut', sortable: true, width: 140 },
])

/* ── Scope (statut) + filtres ───────────────────────────────── */
const scopeOptions = [
  { value: '', label: 'Toutes' },
  { value: 'Draft', label: 'Brouillon' },
  { value: 'PendingApproval', label: 'En attente' },
  { value: 'Active', label: 'Approuvé' },
  { value: 'Inactive', label: 'Désactivée' },
]
const activeScope = ref('')
const filterType = ref('')
const searchQuery = ref('')
const sortKey = ref('')
const sortDir = ref<'asc' | 'desc'>('asc')
const page = ref(1)
const pageSize = ref(15)

watch([activeScope, filterType, searchQuery, pageSize], () => { page.value = 1 })
function resetFilters() { activeScope.value = ''; filterType.value = ''; searchQuery.value = ''; page.value = 1 }

/* ── Helpers ────────────────────────────────────────────────── */
function typeLabel(t: EntityType | string): string {
  const map: Record<string, string> = { Direction: 'Direction', Department: 'Département', Service: 'Service' }
  return map[t] ?? t
}
function typeBadge(type: string): string {
  const m: Record<string, string> = { Direction: 'bg-danger-bg text-danger', Department: 'bg-success-bg text-success', Service: 'bg-primary/10 text-primary' }
  return m[type] ?? 'bg-neutral-bg text-neutral'
}
// La vraie racine est LA Direction Générale (voir store::directionGenerale),
// jamais une entité orpheline quelconque (bug client du 09/09, voir même
// correction dans EntityTabsContent.vue/EntityCard.vue).
function parentName(entityId: string, parentId: string | null): string {
  if (entityId === store.directionGenerale?.id) return 'Racine'
  if (!parentId) return 'Aucune (à corriger)'
  return store.getEntityById(parentId)?.name ?? '-'
}

/* ── Données ────────────────────────────────────────────────── */
const sortFieldMap: Record<string, keyof Entity> = { code: 'code', name: 'name', type: 'type', status: 'status' }
const filtered = computed(() => {
  let rows = store.entities.filter(e => {
    // "Toutes" inclut désormais les entités désactivées — sinon impossible
    // de les retrouver pour les réactiver sans déjà savoir filtrer sur
    // "Inactif". La suppression définitive (Lot I, IsDeleted) est le
    // véritable mécanisme qui fait disparaître une entité partout : elle
    // est déjà appliquée côté API (findAll), pas besoin de la dupliquer ici.
    if (activeScope.value && e.status !== activeScope.value) return false
    if (filterType.value && e.type !== filterType.value) return false
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      if (!e.name.toLowerCase().includes(q) && !e.code.toLowerCase().includes(q)) return false
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
