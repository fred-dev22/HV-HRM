<script setup lang="ts">
/**
 * Fiche d'un ordre de mission (lecture / édition) — sur CardModalShell, pattern
 * frontdesk. Navigateur de N° à gauche, barre d'actions métier + impression,
 * mode lecture par défaut ; édition possible pour les brouillons.
 */
import { ref, computed, watch } from 'vue'
import { Plus, Printer, Trash2 } from 'lucide-vue-next'
import CardModalShell from '../shared/CardModalShell.vue'
import StatusPill from '../ui/StatusPill.vue'
import UserAvatar from '../ui/UserAvatar.vue'
import ValidationTimeline from '../ui/ValidationTimeline.vue'
import FormSection from '../ui/form-field/FormSection.vue'
import MissionWorkflowActions from './MissionWorkflowActions.vue'
import * as cls from '../../lib/formClasses'
import { confirmDialog } from '../../lib/confirm'
import { useMissionStore } from '../../stores/missions'
import type { MissionExpenseLinePayload } from '../../stores/missions'
import { useMissionConfigStore } from '../../stores/missionConfig'
import { useEmployeeCategoryStore } from '../../stores/employeeCategories'
import { useAuthStore } from '../../stores/auth'
import type { MissionOrder, TransportMode, MissionCategory } from '../../types'

const props = defineProps<{
  /** Missions de la liste courante (pour la navigation N°) */
  missions: MissionOrder[]
  /** Mission affichée */
  missionId: string
}>()

const emit = defineEmits<{ close: [] }>()

const missionStore = useMissionStore()
const missionConfigStore = useMissionConfigStore()
const categoryStore = useEmployeeCategoryStore()
const auth = useAuthStore()
if (categoryStore.categories.length === 0) categoryStore.fetchAll()
if (missionConfigStore.expenseTypes.length === 0) missionConfigStore.fetchExpenseTypes()

const TRANSPORT_LABELS: Record<TransportMode, string> = {
  PersonalCar: 'Voiture personnelle', CompanyCar: 'Voiture société',
  PublicTransport: 'Transport en commun', Plane: 'Avion', Other: 'Autre',
}
const TRANSPORT_OPTIONS = Object.entries(TRANSPORT_LABELS) as [TransportMode, string][]
const MISSION_CATEGORY_LABELS: Record<MissionCategory, string> = {
  National: 'Nationale', International: 'Internationale',
}

function fmtNum(n: number) { return n.toLocaleString('fr-FR') }
function fmtDate(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

const currentId = ref(props.missionId)
watch(() => props.missionId, (v) => { currentId.value = v; isEditMode.value = false })

const current = computed<MissionOrder | null>(() => props.missions.find(m => m.id === currentId.value) ?? null)
const currentIndex = computed(() => props.missions.findIndex(m => m.id === currentId.value))
const hasPrev = computed(() => currentIndex.value > 0)
const hasNext = computed(() => currentIndex.value >= 0 && currentIndex.value < props.missions.length - 1)

const sidebarItems = computed(() => props.missions.map(m => ({ no: m.referenceCode, label: `${m.employeeName} · ${m.destination}` })))
const currentNo = computed(() => current.value?.referenceCode ?? null)

// La liste passée en prop (mine/team/all/pendingForMe) ne porte ni le detail
// des indemnités ni l'historique de validation — seul le detail
// (GET /mission-orders/:id) les inclut.
const detail = ref<MissionOrder | null>(null)
// Re-fetch aussi quand le statut de l'enregistrement courant change (ex :
// approbation depuis cette même fiche, currentId inchangé) — sinon le
// détail reste figé sur son état d'ouverture jusqu'au rechargement.
watch(() => [currentId.value, current.value?.status] as const, async ([id]) => {
  detail.value = null
  if (!id) return
  try {
    detail.value = await missionStore.fetchOne(id)
  } catch {
    // silencieux : le detail est une amelioration, pas bloquant pour la fiche
  }
}, { immediate: true })

const categoryName = computed(() => {
  const catId = detail.value?.employeeCategoryId
  return catId ? (categoryStore.categories.find(c => c.id === catId)?.name ?? '') : ''
})

function goPrev() { if (hasPrev.value) { currentId.value = props.missions[currentIndex.value - 1]!.id; isEditMode.value = false } }
function goNext() { if (hasNext.value) { currentId.value = props.missions[currentIndex.value + 1]!.id; isEditMode.value = false } }
function selectSidebar(no: string) {
  const m = props.missions.find(x => x.referenceCode === no)
  if (m) { currentId.value = m.id; isEditMode.value = false }
}

/* ── Mode édition (brouillons / retournés) ──────────────────── */
const isEditMode = ref(false)
const canEdit = computed(() => current.value?.status === 'Draft' || current.value?.status === 'Returned')
const form = ref({ destination: '', purpose: '', missionCategory: 'National' as MissionCategory, departureDate: '', returnDate: '', transportModeGo: 'Plane' as TransportMode, transportModeReturn: 'Plane' as TransportMode, advanceRequested: 0 })
const editExpenseLines = ref<MissionExpenseLinePayload[]>([])
const saveError = ref('')

function firstExpenseTypeId() { return missionConfigStore.expenseTypes[0]?.id ?? '' }
function addExpenseLine() { editExpenseLines.value.push({ expenseTypeId: firstExpenseTypeId(), description: '', amount: 0 }) }
function removeExpenseLine(i: number) { editExpenseLines.value.splice(i, 1) }

function enterEdit() {
  if (!current.value) return
  const m = current.value
  form.value = {
    destination: m.destination, purpose: m.purpose, missionCategory: m.missionCategory,
    departureDate: m.departureDate, returnDate: m.returnDate,
    transportModeGo: m.transportModeGo, transportModeReturn: m.transportModeReturn,
    advanceRequested: m.advanceRequested,
  }
  editExpenseLines.value = m.expenseLines.map(l => ({ expenseTypeId: l.expenseTypeId, description: l.description, amount: l.amount }))
  isEditMode.value = true
}
function cancelEdit() { isEditMode.value = false }
async function save() {
  if (!current.value) return
  try {
    await missionStore.update(current.value.id, { ...form.value, expenseLines: editExpenseLines.value.filter(l => l.amount > 0) })
    detail.value = await missionStore.fetchOne(current.value.id)
    isEditMode.value = false
  } catch {
    saveError.value = missionStore.error ?? "La mise à jour a échoué."
  }
}

function printPage() { window.print() }

const pageTitle = computed(() => (current.value ? `${current.value.referenceCode} · ${current.value.employeeName}` : ''))
const readBox = 'text-[13px] text-foreground bg-background border border-border rounded-md px-2.5 h-[38px] flex items-center'
const th = 'text-left px-2.5 py-2 text-[11px] font-bold text-muted-foreground uppercase tracking-[0.05em] bg-background border-b border-border'
const td = 'px-2.5 py-2 border-b border-border'

// Un ordre approuve ne doit plus pouvoir etre supprime — meme regle cote
// backend (mission-order.service.ts softDelete). InApprovalN2+ inclus : y
// arriver implique qu'un validateur a deja approuve une etape (decision du
// 12/08).
const APPROVED_LINEAGE: MissionOrder['status'][] = ['Approved', 'InApprovalN2', 'InApprovalN3', 'InApprovalN4']

// Suppression definitive (Lot I) — jamais mise en avant, toujours en bas de
// la fiche (decision du 11/08, meme pattern que EmployeeCard.vue). Disponible
// quel que soit le statut courant de l'ordre de mission.
const deleting = ref(false)
async function deletePermanently() {
  if (!current.value) return
  if (!(await confirmDialog(
    `Supprimer définitivement cet ordre de mission (${current.value.referenceCode}) ? Il disparaîtra de toute l'application. Cette action est irréversible.`,
    { danger: true },
  ))) return
  deleting.value = true
  try {
    await missionStore.deletePermanently(current.value.id)
    emit('close')
  } catch {
    // missionStore.error porte le message pour l'UI (toast)
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <CardModalShell
    v-if="current"
    :page-title="pageTitle"
    :page-number="current.referenceCode"
    banner-label="Ordre de mission"
    :is-edit-mode="isEditMode"
    :show-edit="canEdit"
    :show-title-new-button="false"
    :sidebar-items="sidebarItems"
    :current-no="currentNo"
    :has-prev="hasPrev"
    :has-next="hasNext"
    :has-unsaved-changes="isEditMode"
    @close="emit('close')"
    @enter-edit="enterEdit"
    @cancel-edit="cancelEdit"
    @save="save"
    @go-prev="goPrev"
    @go-next="goNext"
    @select-sidebar="selectSidebar"
  >
    <template #title-badges>
      <StatusPill :status="current.status" />
    </template>

    <!-- Barre d'actions métier (mode lecture) -->
    <template v-if="!isEditMode" #action-buttons>
      <MissionWorkflowActions :mission="current" @deleted="emit('close')" />
      <button :class="cls.btnOutline" @click="printPage"><Printer class="w-4 h-4" /> Imprimer</button>
    </template>

    <template #form>
      <div class="px-6 py-5 max-w-4xl">
        <!-- Section Employé -->
        <FormSection title="Employé" :recaps="[current.employeeName, categoryName || '—']">
        <div class="grid grid-cols-2 gap-x-6 gap-y-4 max-sm:grid-cols-1">
          <div :class="cls.field">
            <label :class="cls.fieldLabel">Nom</label>
            <div class="flex items-center gap-2 h-[38px]">
              <UserAvatar :name="current.employeeName" size="sm" />
              <span class="text-[13px] font-medium text-foreground">{{ current.employeeName }}</span>
            </div>
          </div>
          <div :class="cls.field">
            <label :class="cls.fieldLabel">Catégorie</label>
            <div :class="readBox">{{ categoryName || '—' }}</div>
          </div>
          <div v-if="current.createdByName && current.createdByName !== current.employeeName" :class="cls.field">
            <label :class="cls.fieldLabel">Créée par</label>
            <div :class="readBox">{{ current.createdByName }}</div>
          </div>
          <div v-if="current.linkedMission" :class="cls.field">
            <label :class="cls.fieldLabel">Mission associée</label>
            <div :class="readBox">{{ current.linkedMission.employeeName }} · {{ current.linkedMission.referenceCode }} <StatusPill :status="current.linkedMission.status" class="ml-1" /></div>
          </div>
        </div>
        </FormSection>

        <!-- Section Mission -->
        <FormSection title="Mission" :recaps="[current.destination, `${current.daysCount}j`]">
        <div class="grid grid-cols-2 gap-x-6 gap-y-4 max-sm:grid-cols-1">
          <div :class="cls.field">
            <label :class="cls.fieldLabel">Destination</label>
            <input v-if="isEditMode" v-model="form.destination" :class="cls.fieldInput" />
            <div v-else :class="readBox">{{ current.destination }}</div>
          </div>
          <div :class="cls.field">
            <label :class="cls.fieldLabel">Portée</label>
            <select v-if="isEditMode" v-model="form.missionCategory" :class="cls.fieldSelect">
              <option v-for="[v, l] in Object.entries(MISSION_CATEGORY_LABELS)" :key="v" :value="v">{{ l }}</option>
            </select>
            <div v-else :class="readBox">{{ MISSION_CATEGORY_LABELS[current.missionCategory] }}</div>
          </div>
          <div :class="cls.field">
            <label :class="cls.fieldLabel">Durée</label>
            <div :class="readBox">{{ current.daysCount }} jour(s)</div>
          </div>
          <div :class="cls.field">
            <label :class="cls.fieldLabel">Objet / Motif</label>
            <textarea v-if="isEditMode" v-model="form.purpose" :class="cls.fieldTextarea" rows="2"></textarea>
            <div v-else :class="[readBox, 'h-auto min-h-[38px] py-2']">{{ current.purpose }}</div>
          </div>
          <div :class="cls.field">
            <label :class="cls.fieldLabel">Départ</label>
            <input v-if="isEditMode" type="date" v-model="form.departureDate" :class="cls.fieldInput" />
            <div v-else :class="readBox">{{ fmtDate(current.departureDate) }}</div>
          </div>
          <div :class="cls.field">
            <label :class="cls.fieldLabel">Retour</label>
            <input v-if="isEditMode" type="date" v-model="form.returnDate" :min="form.departureDate" :class="cls.fieldInput" />
            <div v-else :class="readBox">{{ fmtDate(current.returnDate) }}</div>
          </div>
          <div :class="cls.field">
            <label :class="cls.fieldLabel">Transport aller</label>
            <select v-if="isEditMode" v-model="form.transportModeGo" :class="cls.fieldSelect">
              <option v-for="[v, l] in TRANSPORT_OPTIONS" :key="v" :value="v">{{ l }}</option>
            </select>
            <div v-else :class="readBox">{{ TRANSPORT_LABELS[current.transportModeGo] }}</div>
          </div>
          <div :class="cls.field">
            <label :class="cls.fieldLabel">Transport retour</label>
            <select v-if="isEditMode" v-model="form.transportModeReturn" :class="cls.fieldSelect">
              <option v-for="[v, l] in TRANSPORT_OPTIONS" :key="v" :value="v">{{ l }}</option>
            </select>
            <div v-else :class="readBox">{{ TRANSPORT_LABELS[current.transportModeReturn] }}</div>
          </div>
          <div :class="cls.field">
            <label :class="cls.fieldLabel">Acompte demandé</label>
            <input v-if="isEditMode" type="number" min="0" v-model.number="form.advanceRequested" :class="cls.fieldInput" />
            <div v-else :class="readBox">{{ fmtNum(current.advanceRequested) }} MGA</div>
          </div>
        </div>
        <div v-if="saveError" class="text-xs text-danger bg-danger-bg px-3 py-2 rounded-md mt-3">{{ saveError }}</div>
        </FormSection>

        <!-- Section Indemnités -->
        <FormSection title="Indemnités" :recaps="[`${fmtNum(detail?.allowance?.total ?? current.estimatedTotal ?? 0)} MGA`]">
        <div v-if="!detail" class="text-xs text-muted-foreground italic px-1 py-2">Chargement…</div>
        <table v-else-if="detail.allowance && detail.allowance.lines.length > 0" class="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th :class="th">Nature</th>
              <th :class="[th, 'text-right']">Base</th>
              <th :class="[th, 'text-right']">Jours</th>
              <th :class="[th, 'text-right']">Montant</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="l in detail.allowance.lines" :key="l.expenseTypeId">
              <td :class="td">{{ l.expenseTypeName }}</td>
              <td :class="[td, 'text-right']">{{ fmtNum(l.rate) }} {{ l.currency }}{{ l.unit === 'PerDay' ? '/j' : '' }}</td>
              <td :class="[td, 'text-right']">{{ l.unit === 'PerDay' ? l.days : '—' }}</td>
              <td :class="[td, 'text-right']">{{ fmtNum(l.amount) }} {{ l.currency }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3" class="px-2.5 py-2 bg-background font-bold">TOTAL MISSION</td>
              <td class="px-2.5 py-2 bg-background font-bold text-right text-primary">{{ fmtNum(detail.allowance.total) }} MGA</td>
            </tr>
            <tr v-if="current.advanceRequested > 0">
              <td colspan="3" class="px-2.5 py-2 text-xs text-muted-foreground">Acompte demandé</td>
              <td class="px-2.5 py-2 text-xs text-muted-foreground text-right">{{ fmtNum(current.advanceRequested) }} MGA</td>
            </tr>
          </tfoot>
        </table>
        <div v-else class="text-xs text-muted-foreground italic px-1 py-2">Aucun taux configuré pour cette catégorie d'employé et cette portée de mission.</div>
        </FormSection>

        <!-- Frais complémentaires -->
        <FormSection v-if="isEditMode || (detail?.expenseLines?.length ?? 0) > 0" title="Frais complémentaires">
        <template v-if="isEditMode">
          <div v-if="editExpenseLines.length > 0" class="flex flex-col gap-1.5 mb-3">
            <div class="grid grid-cols-[1fr_1fr_120px_36px] gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.05em] px-0.5">
              <span>Catégorie</span><span>Description</span><span>Montant (MGA)</span><span></span>
            </div>
            <div v-for="(line, i) in editExpenseLines" :key="i" class="grid grid-cols-[1fr_1fr_120px_36px] gap-1.5 items-center">
              <select v-model="line.expenseTypeId" :class="cls.fieldInput" class="!h-8 !text-xs">
                <option v-for="t in missionConfigStore.expenseTypes" :key="t.id" :value="t.id">{{ t.name }}</option>
              </select>
              <input v-model="line.description" :class="cls.fieldInput" class="!h-8 !text-xs" placeholder="Description…" />
              <input v-model.number="line.amount" type="number" min="0" :class="cls.fieldInput" class="!h-8 !text-xs" placeholder="0" />
              <button class="w-8 h-8 rounded-md cursor-pointer flex items-center justify-center bg-danger-bg text-danger shrink-0 transition-opacity hover:opacity-75" @click="removeExpenseLine(i)" title="Supprimer">
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <button
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer border border-dashed border-border bg-transparent text-muted-foreground transition-colors hover:border-primary hover:text-primary hover:bg-primary/10"
            @click="addExpenseLine"
          >
            <Plus class="w-3.5 h-3.5" /> Ajouter un frais
          </button>
        </template>
        <table v-else-if="detail?.expenseLines?.length" class="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th :class="th">Catégorie</th>
              <th :class="th">Description</th>
              <th :class="[th, 'text-right']">Montant</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="l in detail.expenseLines" :key="l.id">
              <td :class="td">{{ l.expenseTypeName }}</td>
              <td :class="td">{{ l.description || '—' }}</td>
              <td :class="[td, 'text-right']">{{ fmtNum(l.amount) }} MGA</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colspan="2" class="px-2.5 py-2 bg-background font-bold">TOTAL</td>
              <td class="px-2.5 py-2 bg-background font-bold text-right text-primary">{{ fmtNum(detail.expenseLines.reduce((s, l) => s + l.amount, 0)) }} MGA</td>
            </tr>
          </tfoot>
        </table>
        </FormSection>

        <!-- Historique de validation -->
        <FormSection v-if="detail?.validationHistory?.length" title="Historique de validation">
          <ValidationTimeline :history="detail.validationHistory" />
        </FormSection>

        <!-- Suppression définitive -->
        <div v-if="auth.hasPermission('MISSION_SUPPRIMER') && !APPROVED_LINEAGE.includes(current.status)" class="flex justify-end mt-1">
          <button :class="cls.btnDestructive" :disabled="deleting" @click="deletePermanently">
            <Trash2 class="w-3.5 h-3.5" /> {{ deleting ? 'Suppression…' : 'Supprimer définitivement' }}
          </button>
        </div>
      </div>
    </template>
  </CardModalShell>
</template>
