<template>
  <ListPageLayout
    title="Expressions de besoin"
    :subtitle="`${hiringRequestStore.items.length} demande(s)`"
    :columns="columns"
    :items="pageItems"
    :loading="hiringRequestStore.loading"
    :total="totalCount"
    :total-text="`${totalCount} demande(s)`"
    search-placeholder="Rechercher un poste, une entité, un demandeur…"
    :page-size-options="[15, 25, 50]"
    scope-label="Demandes :"
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
      <button v-if="canExpress" :class="L.btnPrimary" @click="showCreate = true">
        <Plus class="w-4 h-4" /> Nouvelle demande
      </button>
    </template>

    <!-- KPIs -->
    <template #above-table>
      <div class="grid grid-cols-3 gap-2.5 mb-3.5 max-md:grid-cols-1">
        <div :class="kpiItem">
          <div :class="kpiIcon" class="bg-primary/10"><Briefcase class="w-[18px] h-[18px] text-primary" /></div>
          <div><div :class="kpiVal">{{ hiringRequestStore.items.length }}</div><div :class="kpiLbl">Total</div></div>
        </div>
        <div :class="kpiItem">
          <div :class="kpiIcon" class="bg-warning-bg"><Clock class="w-[18px] h-[18px] text-warning" /></div>
          <div><div :class="kpiVal">{{ pendingCount }}</div><div :class="kpiLbl">Brouillons</div></div>
        </div>
        <div :class="kpiItem">
          <div :class="kpiIcon" class="bg-success-bg"><CheckCircle2 class="w-[18px] h-[18px] text-success" /></div>
          <div><div :class="kpiVal">{{ approvedCount }}</div><div :class="kpiLbl">Exprimées</div></div>
        </div>
      </div>
    </template>

    <!-- Actions contextuelles (ligne sélectionnée) -->
    <template #row-actions="{ item }">
      <HiringRequestWorkflowActions :item="item" />
    </template>

    <!-- Filtres -->
    <template #filters>
      <div :class="L.fpField">
        <label :class="L.fpFieldLabel">Entité</label>
        <select v-model="fEntity" :class="L.fpSelect">
          <option value="">Entité</option>
          <option v-for="e in entityStore.approvedEntities" :key="e.id" :value="e.name">{{ e.code }} · {{ e.name }}</option>
        </select>
      </div>
      <button class="mt-auto py-[7px] bg-transparent border-0 text-xs text-muted-foreground cursor-pointer text-left hover:text-primary" @click="resetFilters">Réinitialiser les filtres</button>
    </template>

    <!-- Cellules -->
    <template #cell-positionTitle="{ item }"><span class="font-medium text-foreground text-xs truncate">{{ item.positionTitle }}</span></template>
    <template #cell-entityName="{ item }"><span class="text-muted-foreground text-xs truncate">{{ item.entityName }}</span></template>
    <template #cell-headcount="{ item }">
      <span class="text-xs font-semibold inline-flex items-center gap-1" :class="item.capacityWarning ? 'text-danger' : ''" :title="item.capacityWarning ? warningTextOf(item) : undefined">
        {{ item.headcount }}
        <TriangleAlert v-if="item.capacityWarning" class="w-3.5 h-3.5" />
      </span>
    </template>
    <template #cell-requestedByName="{ item }"><span class="text-muted-foreground text-xs truncate">{{ item.requestedByName }}</span></template>
    <template #cell-requestedAt="{ item }"><span class="text-muted-foreground text-xs">{{ formatDate(item.requestedAt) }}</span></template>
    <template #cell-status="{ item }"><StatusPill :status="item.status" /></template>

    <!-- Aperçu rapide -->
    <template #details-panel="{ item }">
      <div class="flex flex-col gap-3.5">
        <div>
          <div class="text-sm font-semibold text-foreground truncate">{{ item.positionTitle }}</div>
          <div class="text-[11px] text-muted-foreground truncate">{{ item.entityName }}</div>
        </div>
        <div><StatusPill :status="item.status" /></div>
        <div class="grid grid-cols-2 gap-2 text-[12px]">
          <div><div class="text-muted-foreground text-[11px]">Effectif</div>{{ item.headcount }}</div>
          <div><div class="text-muted-foreground text-[11px]">Date</div>{{ formatDate(item.requestedAt) }}</div>
        </div>
        <div v-if="item.capacityWarning" :class="cls.fieldErrorBlock"><TriangleAlert class="w-3.5 h-3.5 shrink-0" /> {{ warningTextOf(item) }}</div>
        <button :class="L.btnPrimary" class="w-full justify-center" @click="openCard(item)">Ouvrir la fiche</button>
        <HiringRequestWorkflowActions :item="item" />
      </div>
    </template>

    <template #empty>
      <Briefcase class="w-8 h-8" />
      <p class="text-[13px]">Aucune expression de besoin</p>
    </template>

    <!-- Création -->
    <CreateModalShell
      v-if="showCreate"
      title="Nouvelle expression de besoin"
      banner-label="Nouvelle demande de recrutement"
      create-label="Soumettre"
      draft-label="Enregistrer le brouillon"
      :is-saving="submitting"
      :save-error="error"
      @close="showCreate = false"
      @create="create"
      @save-draft="saveDraft"
    >
      <template #form>
        <div class="flex-1 overflow-auto px-6 py-5">
          <div class="max-w-3xl mx-auto">

            <FormSection title="Poste">
              <div class="grid grid-cols-2 gap-x-6 gap-y-4 max-sm:grid-cols-1">
                <div :class="cls.field">
                  <label :class="cls.fieldLabel">Intitulé du poste <span class="text-danger">*</span></label>
                  <input v-model="form.positionTitle" :class="cls.fieldInput" placeholder="ex : Comptable, Chauffeur poids lourd…" />
                </div>
                <div :class="cls.field">
                  <label :class="cls.fieldLabel">Poste existant <span :class="cls.fieldOptional">(optionnel)</span></label>
                  <select v-model="pickedPositionId" :class="cls.fieldSelect" @change="onPositionPicked">
                    <option value="">Sélectionner dans le référentiel des postes…</option>
                    <option v-for="p in positionStore.positions" :key="p.id" :value="p.id">{{ p.code }} · {{ p.title }}</option>
                  </select>
                  <p class="text-[11px] text-muted-foreground mt-1">Pré-remplit l'intitulé ci-dessus et l'entité ci-dessous, modifiables ensuite.</p>
                </div>
                <div :class="cls.field">
                  <label :class="cls.fieldLabel">Entité <span class="text-danger">*</span></label>
                  <select v-model="form.entityId" :class="cls.fieldSelect">
                    <option value="">Sélectionnez une entité</option>
                    <option v-for="e in entityStore.approvedEntities" :key="e.id" :value="e.id">{{ e.code }} · {{ e.name }}</option>
                  </select>
                </div>
                <div :class="cls.field">
                  <label :class="cls.fieldLabel">Effectif <span class="text-danger">*</span></label>
                  <input type="number" min="1" v-model.number="form.headcount" :class="[cls.fieldInput, headcountExceeds && cls.inputError]" placeholder="1" />
                  <!-- Non bloquant : la demande reste possible, l'alerte est
                       reaffichee sur la liste, l'apercu et la fiche. -->
                  <p v-if="headcountExceeds && pickedPosition" :class="cls.fieldError">
                    <TriangleAlert class="w-3 h-3 shrink-0" /> {{ capacityWarningText(Number(form.headcount), pickedAvailable ?? 0, pickedPosition.capacity) }}
                  </p>
                  <p v-else-if="pickedPosition" class="text-[11px] text-muted-foreground">{{ availableSlotsHint(pickedAvailable ?? 0, pickedPosition.capacity) }}</p>
                </div>
              </div>
            </FormSection>

            <FormSection title="Profil recherché">
              <div :class="cls.field">
                <label :class="cls.fieldLabel">Profil recherché <span class="text-danger">*</span></label>
                <textarea v-model="form.profile" :class="cls.fieldTextarea" rows="4" placeholder="Diplôme, expérience, compétences attendues…"></textarea>
              </div>
            </FormSection>

            <FormSection title="Demandeur">
              <div :class="cls.field">
                <label :class="cls.fieldLabel">Demandé par</label>
                <input :value="form.requestedByName" :class="cls.fieldInput" disabled />
              </div>
            </FormSection>

          </div>
        </div>
      </template>
    </CreateModalShell>

    <!-- Fiche (double-clic ou "Ouvrir la fiche") -->
    <HiringRequestCard v-if="openCardId !== null" :requests="filtered" :request-id="openCardId" @close="openCardId = null" />
  </ListPageLayout>
</template>

<script setup lang="ts">
/**
 * Liste des expressions de besoin (HiringRequest), module Recrutement,
 * design uniquement (données fictives, voir src/stores/recruitment).
 * Calquée sur EmployeeListView.vue / MissionListView.vue : ListPageLayout +
 * fiche plein écran (HiringRequestCard) + actions de workflow réutilisables
 * (HiringRequestWorkflowActions), même pattern que le module Missions.
 */
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { Plus, Briefcase, Clock, CheckCircle2, TriangleAlert } from 'lucide-vue-next'
import { ListPageLayout, StatusPill, CreateModalShell } from '../../components'
import type { ListColumn } from '../../components/shared/ListPageLayout.vue'
import FormSection from '../../components/ui/form-field/FormSection.vue'
import HiringRequestCard from '../../components/recruitment/HiringRequestCard.vue'
import HiringRequestWorkflowActions from '../../components/recruitment/HiringRequestWorkflowActions.vue'
import * as cls from '../../lib/formClasses'
import * as L from '../../lib/listClasses'
import { formatDate } from '../../lib/date'
import { availableSlotsHint, capacityWarningText } from '../../lib/hiringCapacity'
import { getApiErrorMessage } from '../../lib/api'
import { withToast } from '../../lib/withToast'
import { useSubmitGuard } from '../../lib/submitGuard'
import { useHiringRequestStore } from '../../stores/recruitment'
import type { HiringRequest } from '../../stores/recruitment'
import { useEntityStore } from '../../stores/entities'
import { usePositionStore } from '../../stores/positions'
import { useAuthStore } from '../../stores/auth'

const hiringRequestStore = useHiringRequestStore()
const entityStore = useEntityStore()
const positionStore = usePositionStore()
const auth = useAuthStore()
if (entityStore.entities.length === 0) entityStore.fetchAll()

// Exprimer un besoin : permission dédiée (espace Administration) ou accès module.
const canExpress = computed(() => auth.hasAnyPermission(['RECRUTEMENT_BESOIN_EXPRIMER', 'RECRUTEMENT_ACCES']))

// Postes rafraichis a chaque ouverture de la vue et du formulaire (pas de
// garde sur .length) : les places restantes d'un poste changent a chaque
// creation/suppression d'employe, une liste deja chargee serait perimee et
// l'alerte "effectif > places" ignorerait les titulaires recents.
onMounted(() => {
  hiringRequestStore.fetchAll()
  positionStore.fetchAll()
})

/* ── Styles KPI ─────────────────────────────────────────────── */
const kpiItem = 'bg-card border border-border rounded-lg px-3.5 py-3 flex items-center gap-3'
const kpiIcon = 'w-9 h-9 rounded-lg flex items-center justify-center shrink-0'
const kpiVal = 'text-[22px] font-bold leading-none'
const kpiLbl = 'text-xs text-muted-foreground mt-0.5'

/* ── Fiche plein écran ──────────────────────────────────────── */
const openCardId = ref<string | null>(null)
function openCard(item: HiringRequest) { openCardId.value = item.id }

/* ── Colonnes ───────────────────────────────────────────────── */
const columns: ListColumn[] = [
  { key: 'positionTitle', label: 'Poste', sortable: true, hideable: false, width: 220 },
  { key: 'entityName', label: 'Entité', sortable: true, width: 190 },
  { key: 'headcount', label: 'Effectif', align: 'center', sortable: true, width: 90 },
  { key: 'requestedByName', label: 'Demandé par', sortable: true, width: 180 },
  { key: 'requestedAt', label: 'Date', sortable: true, width: 120 },
  { key: 'status', label: 'Statut', width: 140 },
]

/* ── KPIs ───────────────────────────────────────────────────── */
const pendingCount = computed(() => hiringRequestStore.items.filter(r => r.status === 'Draft').length)
const approvedCount = computed(() => hiringRequestStore.items.filter(r => r.status === 'Open').length)

/* ── Scope / recherche / tri / pagination ──────────────────────
   Même pattern que EmployeeListView.vue : la vue calcule elle-même
   "filtered" puis passe la page déjà filtrée/triée à ListPageLayout. */
const scopeOptions = [
  { value: '', label: 'Toutes' },
  { value: 'Draft', label: 'Brouillon' },
  { value: 'Open', label: 'Exprimée' },
  { value: 'Closed', label: 'Clôturée' },
  { value: 'Cancelled', label: 'Annulée' },
]
const activeScope = ref('')
const fEntity = ref('')
const searchQuery = ref('')
const sortKey = ref('')
const sortDir = ref<'asc' | 'desc'>('asc')
const page = ref(1)
const pageSize = ref(15)

watch([activeScope, fEntity, searchQuery, pageSize], () => { page.value = 1 })

function resetFilters() {
  fEntity.value = ''; searchQuery.value = ''; activeScope.value = ''; page.value = 1
}

const sortFieldMap: Record<string, keyof HiringRequest> = {
  positionTitle: 'positionTitle', entityName: 'entityName', headcount: 'headcount',
  requestedByName: 'requestedByName', requestedAt: 'requestedAt',
}

const filtered = computed(() => {
  let rows = hiringRequestStore.items.filter(r => {
    if (activeScope.value && r.status !== activeScope.value) return false
    if (fEntity.value && r.entityName !== fEntity.value) return false
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      if (!r.positionTitle.toLowerCase().includes(q) && !r.entityName.toLowerCase().includes(q) && !r.requestedByName.toLowerCase().includes(q)) return false
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
watch(showCreate, (open) => { if (open) positionStore.fetchAll() })
const error = ref<string | null>(null)
const form = reactive({
  positionTitle: '', entityId: '', headcount: 1, profile: '',
  requestedByName: auth.user?.name ?? '',
})

// Selecteur "Poste existant" (referentiel Classification) : ne fait pas
// partie du payload envoye au backend (HiringRequest.positionTitle reste du
// texte libre, voir types.ts) — sert juste a pre-remplir l'intitule et
// l'entite depuis un poste deja defini, modifiable ensuite a la main.
const pickedPositionId = ref('')
// Places restantes du poste choisi (sieges - occupes) : sert a signaler, sans
// jamais bloquer, un effectif superieur (voir capacityWarning cote backend).
const pickedPosition = computed(() => positionStore.positions.find(p => p.id === pickedPositionId.value))
const pickedAvailable = computed(() => pickedPosition.value ? Math.max(0, pickedPosition.value.capacity - pickedPosition.value.occupiedCount) : null)
const headcountExceeds = computed(() => pickedAvailable.value !== null && Number(form.headcount) > pickedAvailable.value)
function warningTextOf(r: HiringRequest): string {
  return capacityWarningText(r.headcount, r.positionAvailable ?? 0, r.positionCapacity ?? 0)
}
function onPositionPicked() {
  const position = positionStore.positions.find(p => p.id === pickedPositionId.value)
  if (!position) return
  form.positionTitle = position.title
  if (position.organizationUnitId) {
    const entity = entityStore.getEntityById(position.organizationUnitId)
    if (entity) form.entityId = entity.id
  }
}

function resetForm() {
  Object.assign(form, { positionTitle: '', entityId: '', headcount: 1, profile: '', requestedByName: auth.user?.name ?? '' })
  pickedPositionId.value = ''
  error.value = null
}

function validate(): boolean {
  if (!form.positionTitle.trim()) { error.value = 'Le poste est requis'; return false }
  if (!form.entityId) { error.value = "L'entité est requise"; return false }
  if (!form.headcount || form.headcount < 1) { error.value = "L'effectif doit être d'au moins 1"; return false }
  if (!form.profile.trim()) { error.value = 'Le profil recherché est requis'; return false }
  error.value = null
  return true
}

function buildPayload() {
  const entity = entityStore.approvedEntities.find(e => e.id === form.entityId)
  return {
    positionTitle: form.positionTitle.trim(),
    entityName: entity?.name ?? '',
    headcount: form.headcount,
    profile: form.profile.trim(),
    positionId: pickedPositionId.value || undefined,
  }
}

const { submitting, guard } = useSubmitGuard()
async function create() {
  if (!validate()) return
  try {
    await guard(() => withToast('Soumission...', async () => {
      const created = await hiringRequestStore.create(buildPayload())
      await hiringRequestStore.submit(created.id)
    }, () => 'Enregistrement impossible'))
    showCreate.value = false
    resetForm()
  } catch (e) {
    error.value = getApiErrorMessage(e, "Enregistrement impossible")
  }
}

async function saveDraft() {
  if (!validate()) return
  try {
    await guard(() => withToast('Enregistrement...', () => hiringRequestStore.create(buildPayload()), () => 'Enregistrement impossible'))
    showCreate.value = false
    resetForm()
  } catch (e) {
    error.value = getApiErrorMessage(e, "Enregistrement impossible")
  }
}
</script>
