<template>
  <!-- ── Barre d'onglets ── -->
  <div class="flex border border-border bg-card rounded-t-lg px-1 mb-4">
    <div
      v-for="tab in TABS" :key="tab.key"
      :class="[tabClass, navStore.activeEntityTab === tab.key && tabActive]"
      @click="changeTab(tab.key)"
    >
      <component :is="tab.icon" class="w-4 h-4" /> {{ tab.label }}
      <span v-if="tab.key === 'pending' && store.pendingEntities.length > 0" class="bg-danger text-white text-[9px] font-bold px-[5px] py-px rounded-full">
        {{ store.pendingEntities.length }}
      </span>
    </div>
  </div>

  <!-- ════════════ ONGLET : VUE HIÉRARCHIQUE ════════════ -->
  <template v-if="navStore.activeEntityTab === 'tree'">
    <div class="flex items-center gap-2 mb-3">
      <button :class="[L.btnOutline, '!px-3 !py-1.5 !text-xs']" @click="expandAll">
        <Maximize2 class="w-3.5 h-3.5" /> Tout déplier
      </button>
      <button :class="[L.btnOutline, '!px-3 !py-1.5 !text-xs']" @click="collapseAll">
        <Minimize2 class="w-3.5 h-3.5" /> Tout replier
      </button>
      <span :class="hint">
        <Info class="w-3.5 h-3.5" />
        Cliquez sur ▾/▸ pour replier/déplier un nœud
      </span>
      <div class="flex gap-1 ml-2">
        <button :class="[switcherBtn, switcherActive]" title="Vue hiérarchique">
          <ListTree class="w-4 h-4" />
        </button>
        <button :class="switcherBtn" title="Organigramme" @click="changeTab('orgchart')">
          <Network class="w-4 h-4" />
        </button>
      </div>
    </div>
    <div class="overflow-x-auto px-1 pt-1 pb-4 min-w-0">
      <OrgNode
        v-for="root in store.buildTree"
        :key="root.id"
        :entity="root"
      />
    </div>
  </template>

  <!-- ════════════ ONGLET : ORGANIGRAMME ════════════ -->
  <template v-else-if="navStore.activeEntityTab === 'orgchart'">
    <div class="flex items-center gap-2 mb-3">
      <span :class="hint">
        <Info class="w-3.5 h-3.5" />
        Faites glisser · Clic sur un nœud pour le détail
      </span>
      <div class="flex gap-1 ml-2">
        <button :class="switcherBtn" title="Vue hiérarchique" @click="changeTab('tree')">
          <ListTree class="w-4 h-4" />
        </button>
        <button :class="[switcherBtn, switcherActive]" title="Organigramme">
          <Network class="w-4 h-4" />
        </button>
      </div>
    </div>
    <OrgChartView />
  </template>

  <!-- ════════════ ONGLET : LISTE ════════════ -->
  <template v-if="navStore.activeEntityTab === 'list'">
    <div :class="L.tableCard">
      <div class="flex gap-2 items-center px-3.5 py-2.5 border-b border-border flex-wrap">
        <select v-model="fType" :class="filterSel">
          <option value="">Tous les types</option>
          <option value="direction">Direction</option>
          <option value="department">Département</option>
          <option value="service">Service</option>
        </select>
        <select v-model="fStatus" :class="filterSel">
          <option value="">Tous les statuts</option>
          <option value="draft">Brouillon</option>
          <option value="pending_approval">En attente</option>
          <option value="approved">Approuvé</option>
          <option value="inactive">Inactif</option>
        </select>
        <div :class="L.searchBox">
          <Search class="w-3.5 h-3.5 text-muted-foreground" />
          <input v-model="fSearch" placeholder="Rechercher…" :class="L.searchInput" />
        </div>
        <button v-if="fType || fStatus || fSearch" :class="[L.btnOutline, '!px-3 !py-1.5 !text-xs']" @click="resetFilters">
          <RefreshCw class="w-3.5 h-3.5" /> Réinitialiser
        </button>
      </div>

      <div class="overflow-x-auto">
        <table :class="L.table">
          <thead>
            <tr>
              <th :class="thUpper">Code</th>
              <th :class="thUpper">Nom</th>
              <th :class="thUpper">Type</th>
              <th :class="thUpper">Entité parente</th>
              <th :class="thUpper">Responsable</th>
              <th :class="thUpper">Effectif</th>
              <th :class="thUpper">Statut</th>
              <th :class="thUpper">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="e in listPageItems" :key="e.id" :class="L.rowHover">
              <td :class="L.td"><span class="text-[11px] font-bold px-[7px] py-0.5 rounded bg-primary/10 text-primary tracking-[0.04em]">{{ e.code }}</span></td>
              <td :class="[L.td, 'font-medium']">{{ e.name }}</td>
              <td :class="L.td">
                <span class="text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap" :class="typeBadge(e.type)">{{ typeLabel(e.type) }}</span>
              </td>
              <td :class="[L.td, 'text-muted-foreground text-xs']">{{ parentName(e.parentId) }}</td>
              <td :class="[L.td, 'text-muted-foreground text-xs']">{{ e.responsibleName || '—' }}</td>
              <td :class="[L.td, 'text-center']">
                <span class="text-[11px] text-muted-foreground inline-flex items-center gap-[3px]"><Users class="w-3 h-3" /> {{ e.headcount }}</span>
              </td>
              <td :class="L.td"><StatusPill :status="e.status" /></td>
              <td :class="L.td">
                <div class="flex gap-1 flex-wrap">
                  <button :class="L.actView" @click="openCard(e.id)">Voir →</button>
                  <button v-if="e.status === 'Draft'"           :class="actWarning" @click="store.submitEntity(e.id)">Soumettre</button>
                  <button v-if="e.status === 'PendingApproval'" :class="L.actApprove" @click="store.approveEntity(e.id)">Approuver</button>
                  <button v-if="e.status === 'PendingApproval'" :class="L.actReject"  @click="store.rejectEntity(e.id)">Rejeter</button>
                </div>
              </td>
            </tr>
            <tr v-if="listPageItems.length === 0">
              <td colspan="8" class="text-center text-muted-foreground p-8 text-[13px]">Aucune entité trouvée</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div :class="L.pagination" v-if="listTotalPages > 1">
        <span class="flex-1">{{ filteredList.length }} entité(s)</span>
        <div class="flex gap-[3px]">
          <button :class="L.pagBtn" :disabled="listPage === 1" @click="listPage--"><ChevronLeft class="w-3.5 h-3.5" /></button>
          <button v-for="p in listTotalPages" :key="p" :class="[L.pagBtn, p === listPage && L.pagBtnActive]" @click="listPage = p">{{ p }}</button>
          <button :class="L.pagBtn" :disabled="listPage === listTotalPages" @click="listPage++"><ChevronRight class="w-3.5 h-3.5" /></button>
        </div>
      </div>
    </div>
  </template>

  <!-- ════════════ ONGLET : EN ATTENTE ════════════ -->
  <template v-if="navStore.activeEntityTab === 'pending'">
    <div v-if="store.pendingEntities.length === 0" class="flex flex-col items-center p-[60px] gap-2.5 text-muted-foreground bg-card border border-border rounded-lg">
      <CircleCheck class="w-10 h-10 text-success" />
      <p class="text-sm">Aucune entité en attente d'approbation</p>
    </div>
    <div v-else :class="L.tableCard">
      <div class="overflow-x-auto">
        <table :class="L.table">
          <thead>
            <tr>
              <th :class="thUpper">Code</th>
              <th :class="thUpper">Nom</th>
              <th :class="thUpper">Type</th>
              <th :class="thUpper">Responsable</th>
              <th :class="thUpper">Soumis le</th>
              <th :class="thUpper">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="e in store.pendingEntities" :key="e.id" :class="L.rowHover">
              <td :class="L.td"><span class="text-[11px] font-bold px-[7px] py-0.5 rounded bg-primary/10 text-primary tracking-[0.04em]">{{ e.code }}</span></td>
              <td :class="[L.td, 'font-medium']">{{ e.name }}</td>
              <td :class="L.td">
                <span class="text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap" :class="typeBadge(e.type)">{{ typeLabel(e.type) }}</span>
              </td>
              <td :class="[L.td, 'text-muted-foreground text-xs']">{{ e.responsibleName || '—' }}</td>
              <td :class="[L.td, 'text-muted-foreground text-xs']">{{ e.createdAt || '—' }}</td>
              <td :class="L.td">
                <div class="flex gap-1 flex-wrap">
                  <button :class="L.actView" @click="openCard(e.id)">Voir →</button>
                  <button :class="L.actApprove" @click="store.approveEntity(e.id)">
                    <Check class="w-3.5 h-3.5" /> Approuver
                  </button>
                  <button :class="L.actReject" @click="store.rejectEntity(e.id)">
                    <X class="w-3.5 h-3.5" /> Rejeter
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </template>

  <!-- Fiche entité — voir commentaire sur openCardId plus bas -->
  <EntityCard v-if="openCardId !== null" :entities="store.entities" :entity-id="openCardId" @close="openCardId = null" />
</template>

<script setup lang="ts">
import { ref, computed, provide, onMounted, watch, type Component } from 'vue'
import { useRoute } from 'vue-router'
import {
  ListTree, Network, List, Clock, Maximize2, Minimize2, Info, Search,
  RefreshCw, Users, Check, X, CircleCheck, ChevronLeft, ChevronRight,
} from 'lucide-vue-next'
import { useEntityStore }     from '../../stores/entities'
import { useNavigationStore } from '../../stores/navigation'
import OrgNode      from '../../views/entities/OrgNode.vue'
import OrgChartView from '../OrgChartView.vue'
import StatusPill   from '../ui/StatusPill.vue'
import EntityCard   from './EntityCard.vue'
import * as L from '../../lib/listClasses'
import type { EntityType } from '../../types'

const route    = useRoute()
const store    = useEntityStore()
const navStore = useNavigationStore()

// ── Classes du design system ─────────────────────────────────
const tabClass = 'px-[18px] py-2.5 text-[13px] text-muted-foreground cursor-pointer border-b-2 border-transparent flex items-center gap-1.5 transition-colors hover:text-foreground'
const tabActive = '!text-primary !border-primary font-medium'
const hint = 'text-[11px] text-muted-foreground flex items-center gap-1 ml-auto'
const switcherBtn = 'px-2 py-1.5 rounded-md border-0 cursor-pointer flex items-center justify-center bg-transparent text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary'
const switcherActive = '!bg-primary/10 !text-primary'
const filterSel = 'h-[30px] px-2 border border-border rounded-md text-xs text-foreground bg-card outline-none focus:border-primary'
const thUpper = 'px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground bg-background uppercase tracking-[0.04em] border-b border-border whitespace-nowrap'
const actWarning = L.actBtn + ' bg-warning-bg text-warning'

function typeBadge(type: string): string {
  const m: Record<string, string> = {
    Direction:  'bg-danger-bg text-danger',
    Department: 'bg-success-bg text-success',
    Service:    'bg-primary/10 text-primary',
  }
  return m[type] ?? 'bg-neutral-bg text-neutral'
}

// ── Onglets ────────────────────────────────────────────────────
const VALID_TABS = ['tree', 'orgchart', 'list', 'pending'] as const
type TabKey = typeof VALID_TABS[number]

const TABS: { key: TabKey; label: string; icon: Component }[] = [
  { key: 'tree',     label: 'Vue hiérarchique', icon: ListTree },
  { key: 'orgchart', label: 'Organigramme',     icon: Network },
  { key: 'list',     label: 'Liste',            icon: List },
  { key: 'pending',  label: 'En attente',       icon: Clock },
]

function changeTab(key: TabKey) {
  navStore.setEntityTab(key)
}

// Sync depuis query param au montage
onMounted(() => {
  const q = route.query.tab as string
  if (q && (VALID_TABS as readonly string[]).includes(q)) {
    navStore.setEntityTab(q)
  }
})

// ── Fiche entité (même comportement que EntityListView.vue — un overlay
// "fiche" (EntityCard), pas une navigation de route séparée, pour que
// l'édition/vue d'une entité soit identique quel que soit l'onglet d'où on
// vient : arbre, organigramme, liste ou en attente. Voir décision du 30/07.
const openCardId = ref<string | null>(null)
function openCard(id: string) { openCardId.value = id }

// Fournit l'ouverture de fiche aux OrgNodes / nœuds d'organigramme enfants
provide('navigate-to-detail', (id: string) => openCard(id))

// ── Provide pour OrgNode (collapse) ──────────────────────────
const collapsedIds = ref<string[]>([])
provide('entity-collapsed', collapsedIds)
provide('entity-toggle', (id: string) => {
  if (collapsedIds.value.includes(id)) {
    collapsedIds.value = collapsedIds.value.filter(x => x !== id)
  } else {
    collapsedIds.value = [...collapsedIds.value, id]
  }
})

function expandAll()  { collapsedIds.value = [] }
function collapseAll() {
  collapsedIds.value = store.entities
    .filter(e => store.entities.some(c => c.parentId === e.id))
    .map(e => e.id)
}

// ── Filtres liste ──────────────────────────────────────────────
const fType   = ref('')
const fStatus = ref('')
const fSearch = ref('')
const listPage = ref(1)
const LIST_SIZE = 15

function resetFilters() { fType.value = ''; fStatus.value = ''; fSearch.value = ''; listPage.value = 1 }

const filteredList = computed(() =>
  store.entities.filter(e => {
    if (fType.value   && e.type   !== fType.value)   return false
    if (fStatus.value && e.status !== fStatus.value) return false
    if (fSearch.value) {
      const q = fSearch.value.toLowerCase()
      if (!e.name.toLowerCase().includes(q) && !e.code.toLowerCase().includes(q)) return false
    }
    return true
  })
)

const listTotalPages = computed(() => Math.max(1, Math.ceil(filteredList.value.length / LIST_SIZE)))
const listPageItems  = computed(() => {
  const start = (listPage.value - 1) * LIST_SIZE
  return filteredList.value.slice(start, start + LIST_SIZE)
})

watch(filteredList, () => { listPage.value = 1 })

// ── Helpers ────────────────────────────────────────────────────
function typeLabel(t: EntityType | string): string {
  const map: Record<string, string> = { Direction: 'Direction', Department: 'Département', Service: 'Service' }
  return map[t] ?? t
}

function parentName(parentId: string | null): string {
  if (!parentId) return 'Racine'
  return store.getEntityById(parentId)?.name ?? '—'
}
</script>
