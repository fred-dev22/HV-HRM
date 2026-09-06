<script setup lang="ts">
/**
 * Fiche d'une note de frais (lecture / édition) — sur CardModalShell, pattern
 * frontdesk. Lignes de dépense éditables pour les brouillons/retournées.
 */
import { ref, computed, watch } from 'vue'
import { Plus, Trash2, Paperclip, Upload, Download, CircleAlert } from 'lucide-vue-next'
import CardModalShell from '../shared/CardModalShell.vue'
import StatusPill from '../ui/StatusPill.vue'
import UserAvatar from '../ui/UserAvatar.vue'
import ValidationTimeline from '../ui/ValidationTimeline.vue'
import FormSection from '../ui/form-field/FormSection.vue'
import ExpenseWorkflowActions from './ExpenseWorkflowActions.vue'
import * as cls from '../../lib/formClasses'
import { formatDate } from '../../lib/date'
import { useExpenseStore } from '../../stores/expenses'
import type { ExpenseLinePayload } from '../../stores/expenses'
import { useMissionConfigStore } from '../../stores/missionConfig'
import { useMissionStore } from '../../stores/missions'
import { useAttachmentStore } from '../../stores/attachments'
import { useAuthStore } from '../../stores/auth'
import { confirmDialog } from '../../lib/confirm'
import type { ExpenseReport } from '../../types'

const props = defineProps<{ reports: ExpenseReport[]; reportId: string }>()
const emit = defineEmits<{ close: [] }>()

const expenseStore = useExpenseStore()
const missionConfigStore = useMissionConfigStore()
const missionStore = useMissionStore()
const attachmentStore = useAttachmentStore()
const auth = useAuthStore()
if (missionConfigStore.expenseTypes.length === 0) missionConfigStore.fetchExpenseTypes()
if (missionConfigStore.ceilings.length === 0) missionConfigStore.fetchCeilings()

function fmt(n: number) { return n.toLocaleString('fr-FR') }

// Plafond (ExpenseCeiling) applicable a la categorie du beneficiaire — non
// bloquant (decision du 12/08), visible au createur ET au validateur (lecture
// comme edition, contrairement au form de creation ou seul le createur voit).
function lineCeiling(l: { expenseTypeId: string }) {
  const catId = current.value?.employeeCategoryId
  if (!catId) return null
  return missionConfigStore.getCeiling(l.expenseTypeId, catId) ?? null
}
function isOverCeiling(l: { expenseTypeId: string; amount: number }): boolean {
  const ceiling = lineCeiling(l)
  return !!ceiling && ceiling.maxAmount > 0 && l.amount > ceiling.maxAmount
}
function expenseTypeName(expenseTypeId: string): string {
  return missionConfigStore.expenseTypes.find(t => t.id === expenseTypeId)?.name ?? ''
}
const readOverCeilingLines = computed(() => (current.value?.lines ?? []).filter(isOverCeiling))
const editOverCeilingLines = computed(() => lines.value.filter(isOverCeiling))

const currentId = ref(props.reportId)
watch(() => props.reportId, (v) => { currentId.value = v; isEditMode.value = false })

const current = computed<ExpenseReport | null>(() => props.reports.find(r => r.id === currentId.value) ?? null)
const currentIndex = computed(() => props.reports.findIndex(r => r.id === currentId.value))
const hasPrev = computed(() => currentIndex.value > 0)
const hasNext = computed(() => currentIndex.value >= 0 && currentIndex.value < props.reports.length - 1)

const sidebarItems = computed(() => props.reports.map(r => ({ no: r.referenceCode, label: `${r.employeeName} · ${r.title}` })))
const currentNo = computed(() => current.value?.referenceCode ?? null)

// La liste passée en prop ne porte pas l'historique de validation — seul le
// detail (GET /expense-reports/:id) l'inclut.
const validationHistory = ref<ExpenseReport['validationHistory']>(undefined)
// Re-fetch aussi quand le statut de l'enregistrement courant change (ex :
// approbation depuis cette même fiche, currentId inchangé) — sinon
// l'historique reste figé sur son état d'ouverture jusqu'au rechargement.
watch(() => [currentId.value, current.value?.status] as const, async ([id]) => {
  validationHistory.value = undefined
  if (!id) return
  try {
    const detail = await expenseStore.fetchOne(id)
    validationHistory.value = detail.validationHistory
  } catch {
    // silencieux : l'historique est une amélioration, pas bloquant pour la fiche
  }
}, { immediate: true })

// Mission liée (optionnelle) — affichage lecture seule + options du
// sélecteur en édition (missions Approved du même bénéficiaire, même règle
// que ExpenseCreate.vue).
const linkedMissionLabel = ref('')
watch(() => current.value?.missionOrderId, async (id) => {
  linkedMissionLabel.value = ''
  if (!id) return
  try {
    const m = await missionStore.fetchOne(id)
    linkedMissionLabel.value = `${m.referenceCode} · ${m.destination}`
  } catch {
    // silencieux : simple affichage d'appoint, pas bloquant pour la fiche
  }
}, { immediate: true })
const approvedMissions = computed(() => missionStore.mine.filter(m => m.status === 'Approved'))

// Pièces jointes de la note de frais (reçus/justificatifs) — voir
// stores/attachments.ts (upload vers SharePoint via /attachments).
watch(currentId, (id) => { if (id) attachmentStore.fetchByEntity('ExpenseReport', id).catch(() => {}) }, { immediate: true })
const attachments = computed(() => currentId.value ? attachmentStore.forEntity('ExpenseReport', currentId.value) : [])
const attachmentInput = ref<HTMLInputElement | null>(null)
function triggerAttachmentUpload() { attachmentInput.value?.click() }
async function onAttachmentSelected(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  if (!file || !currentId.value) return
  try {
    await attachmentStore.upload('ExpenseReport', currentId.value, file)
  } catch {
    // attachmentStore.error porte le message pour l'UI (toast)
  }
}
async function removeAttachment(id: string) {
  if (!currentId.value) return
  if (!(await confirmDialog('Supprimer cette pièce jointe ?'))) return
  try {
    await attachmentStore.remove(id, 'ExpenseReport', currentId.value)
  } catch {
    // attachmentStore.error porte le message pour l'UI (toast)
  }
}

// Pièces jointes PAR LIGNE — possible seulement ici (fiche d'un rapport déjà
// enregistré, donc chaque ligne a un vrai Id) et pas depuis ExpenseCreate.vue :
// les lignes n'ont pas encore d'Id tant que le rapport entier n'a pas été
// créé en une transaction (voir ExpenseReportService.create).
watch(() => [currentId.value, current.value?.lines.length] as const, ([id]) => {
  if (!id || !current.value) return
  for (const l of current.value.lines) {
    attachmentStore.fetchByEntity('ExpenseLine', l.id).catch(() => {})
  }
}, { immediate: true })
function lineAttachments(lineId: string) {
  return attachmentStore.forEntity('ExpenseLine', lineId)
}
const lineAttachmentInput = ref<HTMLInputElement | null>(null)
const uploadTargetLineId = ref<string | null>(null)
function triggerLineAttachmentUpload(lineId: string) {
  uploadTargetLineId.value = lineId
  lineAttachmentInput.value?.click()
}
async function onLineAttachmentSelected(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  const lineId = uploadTargetLineId.value
  if (!file || !lineId) return
  try {
    await attachmentStore.upload('ExpenseLine', lineId, file)
  } catch {
    // attachmentStore.error porte le message pour l'UI (toast)
  }
}
async function removeLineAttachment(attachmentId: string, lineId: string) {
  if (!(await confirmDialog('Supprimer ce justificatif ?'))) return
  try {
    await attachmentStore.remove(attachmentId, 'ExpenseLine', lineId)
  } catch {
    // attachmentStore.error porte le message pour l'UI (toast)
  }
}
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

function goPrev() { if (hasPrev.value) { currentId.value = props.reports[currentIndex.value - 1]!.id; isEditMode.value = false } }
function goNext() { if (hasNext.value) { currentId.value = props.reports[currentIndex.value + 1]!.id; isEditMode.value = false } }
function selectSidebar(no: string) {
  const r = props.reports.find(x => x.referenceCode === no)
  if (r) { currentId.value = r.id; isEditMode.value = false }
}

/* ── Mode édition (brouillons / retournées) ─────────────────── */
const isEditMode = ref(false)
const canEdit = computed(() => current.value?.status === 'Draft' || current.value?.status === 'Returned')
const lines = ref<ExpenseLinePayload[]>([])
// Id réel de chaque ligne, en parallèle de `lines` (même index) — null pour
// une ligne ajoutée via addLine() et pas encore enregistrée. Séparé de
// ExpenseLinePayload (partagé avec la création, où aucune ligne n'a d'Id)
// pour retrouver la bonne pièce jointe même après un ajout/retrait de ligne
// en cours d'édition (un simple current.lines[i] se désynchroniserait).
const lineIds = ref<(string | null)[]>([])
const form = ref({ title: '', missionOrderId: '' })
const saveError = ref('')

function enterEdit() {
  if (!current.value) return
  lineIds.value = current.value.lines.map(l => l.id)
  lines.value = current.value.lines.map(l => ({
    date: l.date, expenseTypeId: l.expenseTypeId, description: l.description, amount: l.amount,
  }))
  form.value = { title: current.value.title, missionOrderId: current.value.missionOrderId ?? '' }
  missionStore.fetchMine(current.value.employeeId)
  isEditMode.value = true
}
function cancelEdit() { isEditMode.value = false }
function addLine() {
  lines.value.push({ date: new Date().toISOString().slice(0, 10), expenseTypeId: missionConfigStore.expenseTypes[0]?.id ?? '', description: '', amount: 0 })
  lineIds.value.push(null)
}
function removeLine(i: number) { lines.value.splice(i, 1); lineIds.value.splice(i, 1) }
const editTotal = computed(() => lines.value.reduce((s, l) => s + (l.amount || 0), 0))
async function save() {
  if (!current.value) return
  if (lines.value.some(l => !l.amount || l.amount <= 0)) {
    saveError.value = 'Le montant de chaque ligne de dépense doit être supérieur à 0'
    return
  }
  saveError.value = ''
  try {
    await expenseStore.update(current.value.id, {
      title: form.value.title, missionOrderId: form.value.missionOrderId || undefined, lines: lines.value,
    })
    isEditMode.value = false
  } catch {
    saveError.value = expenseStore.error ?? "La mise à jour a échoué."
  }
}

const pageTitle = computed(() => (current.value ? `${current.value.referenceCode} · ${current.value.title}` : ''))
const readBox = 'text-[13px] text-foreground bg-background border border-border rounded-md px-2.5 h-[38px] flex items-center'
const th = 'text-left px-2.5 py-2 text-[11px] font-bold text-muted-foreground uppercase tracking-[0.05em] bg-background border-b border-border'
const td = 'px-2.5 py-2 border-b border-border'
const cellInput = 'w-full h-8 px-2 border border-border rounded bg-card text-xs text-foreground outline-none focus:border-primary'

// Une note approuvee (ou remboursee) ne doit plus pouvoir etre supprimee —
// meme regle cote backend (expense-report.service.ts softDelete). InApprovalN2+
// inclus : y arriver implique qu'un validateur a deja approuve une etape
// (decision du 12/08).
const APPROVED_LINEAGE: ExpenseReport['status'][] = [
  'Approved', 'Reimbursed', 'InApprovalN2', 'InApprovalN3', 'InApprovalN4',
]

// Suppression definitive (Lot I) — jamais mise en avant, toujours en bas de
// la fiche (decision du 11/08, meme pattern que EmployeeCard.vue). Disponible
// quel que soit le statut courant de la note de frais.
const deleting = ref(false)
async function deletePermanently() {
  if (!current.value) return
  if (!(await confirmDialog(
    `Supprimer définitivement cette note de frais (${current.value.referenceCode}) ? Elle disparaîtra de toute l'application. Cette action est irréversible.`,
    { danger: true },
  ))) return
  deleting.value = true
  try {
    await expenseStore.deletePermanently(current.value.id)
    emit('close')
  } catch {
    // expenseStore.error porte le message pour l'UI (toast)
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
    banner-label="Note de frais"
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

    <template v-if="!isEditMode" #action-buttons>
      <ExpenseWorkflowActions :report="current" @deleted="emit('close')" />
    </template>

    <template #form>
      <div class="px-6 py-5 max-w-4xl">
        <!-- Général -->
        <FormSection title="Général" :recaps="[current.employeeName, current.title]">
        <div class="grid grid-cols-2 gap-x-6 gap-y-4 max-sm:grid-cols-1">
          <div :class="cls.field">
            <label :class="cls.fieldLabel">Employé</label>
            <div class="flex items-center gap-2 h-[38px]">
              <UserAvatar :name="current.employeeName" size="sm" />
              <span class="text-[13px] font-medium text-foreground">{{ current.employeeName }}</span>
            </div>
          </div>
          <div :class="cls.field">
            <label :class="cls.fieldLabel">Soumis le</label>
            <div :class="readBox">{{ current.submittedAt ? formatDate(current.submittedAt) : '—' }}</div>
          </div>
          <div :class="cls.field">
            <label :class="cls.fieldLabel">Titre</label>
            <input v-if="isEditMode" v-model="form.title" :class="cls.fieldInput" />
            <div v-else :class="readBox">{{ current.title }}</div>
          </div>
          <div :class="cls.field">
            <label :class="cls.fieldLabel">Mission liée</label>
            <select v-if="isEditMode" v-model="form.missionOrderId" :class="cls.fieldSelect">
              <option value="">Aucune</option>
              <option v-for="m in approvedMissions" :key="m.id" :value="m.id">{{ m.referenceCode }} · {{ m.destination }}</option>
            </select>
            <div v-else :class="readBox">{{ linkedMissionLabel || '—' }}</div>
          </div>
          <div v-if="current.createdByName && current.createdByName !== current.employeeName" :class="cls.field">
            <label :class="cls.fieldLabel">Créée par</label>
            <div :class="readBox">{{ current.createdByName }}</div>
          </div>
        </div>
        </FormSection>

        <!-- Lignes -->
        <FormSection :title="`Lignes de dépense (${current.lines.length})`" :recaps="[`${fmt(current.totalAmount)} MGA`]">
          <div v-if="isEditMode" class="flex justify-end mb-2">
            <button class="inline-flex items-center gap-1 px-3 py-[5px] rounded-md bg-primary/10 text-primary text-xs font-semibold cursor-pointer hover:bg-primary/20" @click="addLine">
              <Plus class="w-3.5 h-3.5" /> Ajouter
            </button>
          </div>
        <input ref="lineAttachmentInput" type="file" class="hidden" @change="onLineAttachmentSelected" />
        <table class="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th :class="th">Date</th>
              <th :class="th">Catégorie</th>
              <th :class="th">Description</th>
              <th :class="[th, 'text-right']">Montant</th>
              <th :class="[th, 'text-center']">Pièce jointe</th>
              <th v-if="isEditMode" :class="th"></th>
            </tr>
          </thead>
          <tbody>
            <!-- Lecture -->
            <template v-if="!isEditMode">
              <tr v-for="l in current.lines" :key="l.id">
                <td :class="td">{{ formatDate(l.date) }}</td>
                <td :class="td">{{ l.expenseTypeName }}</td>
                <td :class="td">{{ l.description }}</td>
                <td :class="[td, 'text-right tabular-nums', isOverCeiling(l) ? 'text-danger font-semibold' : '']">{{ fmt(l.amount) }} {{ l.currency }}</td>
                <td :class="[td, 'text-center']">
                  <div class="flex flex-col items-center gap-1">
                    <button
                      class="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 shrink-0"
                      title="Ajouter un justificatif"
                      @click="triggerLineAttachmentUpload(l.id)"
                    >
                      <Upload class="w-3.5 h-3.5" />
                    </button>
                    <div v-if="lineAttachments(l.id).length" class="flex flex-col gap-0.5">
                      <div v-for="a in lineAttachments(l.id)" :key="a.id" class="flex items-center gap-1">
                        <a :href="a.fileUrl" target="_blank" rel="noopener" class="text-[10px] text-primary hover:underline truncate max-w-[80px]" :title="a.fileName">{{ a.fileName }}</a>
                        <button class="text-muted-foreground hover:text-danger shrink-0" title="Supprimer" @click="removeLineAttachment(a.id, l.id)"><Trash2 class="w-2.5 h-2.5" /></button>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
            <!-- Édition -->
            <template v-else>
              <tr v-for="(l, i) in lines" :key="i">
                <td :class="td"><input type="date" v-model="l.date" :class="cellInput" /></td>
                <td :class="td">
                  <select v-model="l.expenseTypeId" :class="cellInput">
                    <option v-for="t in missionConfigStore.expenseTypes" :key="t.id" :value="t.id">{{ t.name }}</option>
                  </select>
                </td>
                <td :class="td"><input v-model="l.description" :class="cellInput" placeholder="Description…" /></td>
                <td :class="td">
                  <input
                    type="number" min="0" v-model.number="l.amount"
                    :class="[cellInput, 'text-right', isOverCeiling(l) ? '!border-danger !text-danger' : '']"
                  />
                </td>
                <td :class="[td, 'text-center']">
                  <div v-if="lineIds[i]" class="flex flex-col items-center gap-1">
                    <button
                      class="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 shrink-0"
                      title="Ajouter un justificatif"
                      @click="triggerLineAttachmentUpload(lineIds[i]!)"
                    >
                      <Upload class="w-3.5 h-3.5" />
                    </button>
                    <div v-if="lineAttachments(lineIds[i]!).length" class="flex flex-col gap-0.5">
                      <div v-for="a in lineAttachments(lineIds[i]!)" :key="a.id" class="flex items-center gap-1">
                        <a :href="a.fileUrl" target="_blank" rel="noopener" class="text-[10px] text-primary hover:underline truncate max-w-[80px]" :title="a.fileName">{{ a.fileName }}</a>
                        <button class="text-muted-foreground hover:text-danger shrink-0" title="Supprimer" @click="removeLineAttachment(a.id, lineIds[i]!)"><Trash2 class="w-2.5 h-2.5" /></button>
                      </div>
                    </div>
                  </div>
                  <span v-else class="text-[10px] text-muted-foreground italic">Après ajout</span>
                </td>
                <td :class="td">
                  <button class="w-7 h-7 rounded-md bg-danger-bg text-danger flex items-center justify-center cursor-pointer hover:brightness-95" @click="removeLine(i)"><Trash2 class="w-3.5 h-3.5" /></button>
                </td>
              </tr>
            </template>
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3" class="px-2.5 py-2 bg-background font-bold">TOTAL</td>
              <td class="px-2.5 py-2 bg-background font-bold text-right text-primary tabular-nums">{{ fmt(isEditMode ? editTotal : current.totalAmount) }} MGA</td>
              <td class="bg-background" :colspan="isEditMode ? 2 : 1"></td>
            </tr>
          </tfoot>
        </table>
        <div v-if="(isEditMode ? editOverCeilingLines : readOverCeilingLines).length > 0" :class="cls.fieldErrorBlock" class="mt-3">
          <CircleAlert class="w-3.5 h-3.5 shrink-0" />
          <span>
            Plafond dépassé pour la catégorie du bénéficiaire —
            <template v-for="(l, i) in (isEditMode ? editOverCeilingLines : readOverCeilingLines)" :key="i">{{ i > 0 ? ', ' : '' }}{{ expenseTypeName(l.expenseTypeId) }} ({{ fmt(l.amount) }} MGA, plafond {{ fmt(lineCeiling(l)?.maxAmount ?? 0) }} MGA)</template>.
          </span>
        </div>
        <div v-if="saveError" class="text-xs text-danger bg-danger-bg px-3 py-2 rounded-md mt-3">{{ saveError }}</div>
        </FormSection>

        <!-- Pièces jointes (reçus/justificatifs) -->
        <FormSection :title="`Pièces jointes (${attachments.length})`">
          <input ref="attachmentInput" type="file" class="hidden" @change="onAttachmentSelected" />
          <button
            class="inline-flex items-center gap-1 px-3 py-[5px] rounded-md bg-primary/10 text-primary text-xs font-semibold cursor-pointer hover:bg-primary/20 mb-2 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="attachmentStore.uploading"
            @click="triggerAttachmentUpload"
          >
            <Upload class="w-3.5 h-3.5" /> {{ attachmentStore.uploading ? 'Envoi…' : 'Ajouter un fichier' }}
          </button>
          <div v-if="attachments.length === 0" class="text-[12px] text-muted-foreground italic">Aucune pièce jointe</div>
          <ul v-else class="flex flex-col gap-1.5">
            <li v-for="a in attachments" :key="a.id" class="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-background border border-border text-[13px]">
              <Paperclip class="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <a :href="a.fileUrl" target="_blank" rel="noopener" class="flex-1 truncate text-foreground hover:text-primary hover:underline" :title="a.fileName">{{ a.fileName }}</a>
              <span class="text-[11px] text-muted-foreground shrink-0">{{ formatFileSize(a.fileSize) }}</span>
              <a :href="a.fileUrl" target="_blank" rel="noopener" class="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-primary shrink-0" title="Ouvrir">
                <Download class="w-3.5 h-3.5" />
              </a>
              <button class="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-danger shrink-0" title="Supprimer" @click="removeAttachment(a.id)">
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </li>
          </ul>
        </FormSection>

        <!-- Motif de refus / retour -->
        <div v-if="current.rejectionReason" class="mb-3">
          <label :class="cls.fieldLabel">{{ current.status === 'Returned' ? 'Commentaire de retour' : 'Motif du refus' }}</label>
          <div class="text-[13px] text-danger bg-danger-bg border border-danger/20 rounded-md px-2.5 py-2 mt-1">{{ current.rejectionReason }}</div>
        </div>

        <!-- Historique -->
        <FormSection v-if="validationHistory?.length" title="Historique de validation">
          <ValidationTimeline :history="validationHistory" />
        </FormSection>

        <!-- Suppression définitive -->
        <div v-if="auth.hasPermission('FRAIS_SUPPRIMER') && !APPROVED_LINEAGE.includes(current.status)" class="flex justify-end mt-1">
          <button :class="cls.btnDestructive" :disabled="deleting" @click="deletePermanently">
            <Trash2 class="w-3.5 h-3.5" /> {{ deleting ? 'Suppression…' : 'Supprimer définitivement' }}
          </button>
        </div>
      </div>
    </template>
  </CardModalShell>
</template>
