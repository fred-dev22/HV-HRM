<script setup lang="ts">
/**
 * Fiche d'une demande d'absence (lecture / édition) — sur CardModalShell,
 * pattern frontdesk. Navigateur de N° à gauche, barre d'actions métier, mode
 * lecture par défaut ; édition possible pour les brouillons.
 */
import { ref, computed, watch } from 'vue'
import { TriangleAlert, Paperclip, Upload, Download, Trash2 } from 'lucide-vue-next'
import CardModalShell from '../shared/CardModalShell.vue'
import StatusPill from '../ui/StatusPill.vue'
import UserAvatar from '../ui/UserAvatar.vue'
import ValidationTimeline from '../ui/ValidationTimeline.vue'
import FormSection from '../ui/form-field/FormSection.vue'
import SearchableDropdown from '../ui/SearchableDropdown.vue'
import AbsenceWorkflowActions from './AbsenceWorkflowActions.vue'
import * as cls from '../../lib/formClasses'
import { formatDate } from '../../lib/date'
import { useLeaveRequestStore } from '../../stores/leaveRequests'
import { useLeaveTypesStore } from '../../stores/leaveTypes'
import { useLeaveTransactionStore } from '../../stores/leaveTransactions'
import { useCalendarStore } from '../../stores/calendar'
import { useAttachmentStore } from '../../stores/attachments'
import { useAuthStore } from '../../stores/auth'
import { useEmployeeStore } from '../../stores/employees'
import { confirmDialog } from '../../lib/confirm'
import { getWorkingDaysBetween } from '../../utils/calendar'
import type { LeaveRequest } from '../../types'

const props = defineProps<{
  /** Demandes de la liste courante (pour la navigation N°) */
  leaves: LeaveRequest[]
  /** Demande affichée */
  requestId: string
}>()

const emit = defineEmits<{ close: [] }>()

const store = useLeaveRequestStore()
const leaveTypesStore = useLeaveTypesStore()
const leaveTransactionStore = useLeaveTransactionStore()
const calendarStore = useCalendarStore()
const attachmentStore = useAttachmentStore()
const auth = useAuthStore()
const employeeStore = useEmployeeStore()
if (leaveTypesStore.leaveTypes.length === 0) leaveTypesStore.fetchAll()
if (employeeStore.directory.length === 0) employeeStore.fetchDirectory()
// Toujours rafraîchi (pas de garde "si vide") : le solde utilisé pour
// l'avertissement "solde insuffisant" ci-dessous doit refléter les
// approbations décidées entre-temps, voir DashboardEmployee.vue.
leaveTransactionStore.fetchMyBalances()

function leaveNo(l: LeaveRequest) { return l.referenceCode }

// Une fois approuvee (ou tout statut derive), une demande ne doit plus
// pouvoir etre supprimee definitivement — meme regle cote backend
// (leave-request.service.ts softDelete). InApprovalN2+ inclus : y arriver
// implique qu'un validateur a deja approuve une etape (decision du 12/08).
const APPROVED_LINEAGE: LeaveRequest['status'][] = [
  'Approved', 'Registered', 'Done', 'Regularized', 'InApprovalN2', 'InApprovalN3', 'InApprovalN4',
]

// Le préavis minimum n'est plus bloquant à la soumission (decision du
// 01/08) — avertissement visible sur la fiche pour le validateur.
function noticeWarning(l: LeaveRequest): string | null {
  const type = leaveTypesStore.leaveTypes.find(t => t.id === l.leaveTypeId)
  if (!type || type.noticeDays <= 0) return null
  const submitted = new Date(l.createdAt); submitted.setHours(0, 0, 0, 0)
  const start = new Date(l.startDate)
  const diffDays = Math.ceil((start.getTime() - submitted.getTime()) / 86400000)
  if (diffDays >= type.noticeDays) return null
  return `Préavis de ${type.noticeDays} jour(s) non respecté (soumis ${diffDays} jour(s) avant le début)`
}

const currentId = ref(props.requestId)
watch(() => props.requestId, (v) => { currentId.value = v; isEditMode.value = false })

const current = computed<LeaveRequest | null>(() => props.leaves.find(l => l.id === currentId.value) ?? null)
const currentIndex = computed(() => props.leaves.findIndex(l => l.id === currentId.value))
const hasPrev = computed(() => currentIndex.value > 0)
const hasNext = computed(() => currentIndex.value >= 0 && currentIndex.value < props.leaves.length - 1)

const sidebarItems = computed(() => props.leaves.map(l => ({ no: leaveNo(l), label: `${l.employeeName} · ${l.leaveTypeName}` })))
const currentNo = computed(() => (current.value ? leaveNo(current.value) : null))

// La liste passée en prop (mine/team/all) ne porte pas l'historique de
// validation — seul le détail (GET /leave-requests/:id) l'inclut.
const validationHistory = ref<LeaveRequest['validationHistory']>(undefined)
// Re-fetch aussi quand le statut de l'enregistrement courant change (ex :
// approbation depuis cette même fiche, currentId inchangé) — sinon
// l'historique reste figé sur son état d'ouverture jusqu'au rechargement.
watch(() => [currentId.value, current.value?.status] as const, async ([id]) => {
  validationHistory.value = undefined
  if (!id) return
  try {
    const detail = await store.fetchOne(id)
    validationHistory.value = detail.validationHistory
  } catch {
    // silencieux : l'historique est une amélioration, pas bloquant pour la fiche
  }
}, { immediate: true })

// Justificatif médical (congé maladie) — voir stores/attachments.ts (upload
// vers SharePoint via /attachments). Réservé aux types de congé
// WorkflowType='Medical' : c'est le seul cas où un document de preuve a du
// sens (arrêt de travail), pas les congés annuels/RTT/etc.
const isMedicalLeave = computed(() => {
  if (!current.value) return false
  const type = leaveTypesStore.leaveTypes.find(t => t.id === current.value!.leaveTypeId)
  return type?.workflowType === 'Medical'
})
watch(currentId, (id) => { if (id) attachmentStore.fetchByEntity('LeaveRequest', id).catch(() => {}) }, { immediate: true })
const attachments = computed(() => currentId.value ? attachmentStore.forEntity('LeaveRequest', currentId.value) : [])
const attachmentInput = ref<HTMLInputElement | null>(null)
function triggerAttachmentUpload() { attachmentInput.value?.click() }
async function onAttachmentSelected(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  if (!file || !currentId.value) return
  try {
    await attachmentStore.upload('LeaveRequest', currentId.value, file)
  } catch {
    // attachmentStore.error porte le message pour l'UI (toast)
  }
}
async function removeAttachment(id: string) {
  if (!currentId.value) return
  if (!(await confirmDialog('Supprimer ce justificatif ?'))) return
  try {
    await attachmentStore.remove(id, 'LeaveRequest', currentId.value)
  } catch {
    // attachmentStore.error porte le message pour l'UI (toast)
  }
}
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

function goPrev() { if (hasPrev.value) { currentId.value = props.leaves[currentIndex.value - 1]!.id; isEditMode.value = false } }
function goNext() { if (hasNext.value) { currentId.value = props.leaves[currentIndex.value + 1]!.id; isEditMode.value = false } }
function selectSidebar(no: string) {
  const l = props.leaves.find(x => leaveNo(x) === no)
  if (l) { currentId.value = l.id; isEditMode.value = false }
}

/* ── Mode édition (brouillons uniquement) ───────────────────── */
const isEditMode = ref(false)
const canEdit = computed(() => current.value?.status === 'Draft' || current.value?.status === 'Returned')
const form = ref({
  leaveTypeId: '', startDate: '', startPeriod: 'full' as 'full' | 'am' | 'pm',
  endDate: '', endPeriod: 'full' as 'full' | 'am' | 'pm',
  interimEmployeeId: '', reason: '',
})
const saveError = ref('')

const leaveTypeItems = computed(() => leaveTypesStore.activeTypes.map(lt => ({ id: lt.id, label: lt.name })))
// Meme regle qu'AbsenceCreate.vue (decision du 01/08) : pas de restriction
// d'entite sur l'interimaire, seul le beneficiaire est exclu.
const interimItems = computed(() =>
  employeeStore.directory
    .filter(e => e.id !== current.value?.employeeId)
    .map(e => ({
      id: e.id, label: e.name, sublabel: e.entityName, initials: e.avatarText, avatarColor: e.avatarBg,
      itemDisabled: e.status !== 'active',
      disabledReason: e.status !== 'active' ? 'compte désactivé' : undefined,
    })),
)

function enterEdit() {
  if (!current.value) return
  form.value = {
    leaveTypeId: current.value.leaveTypeId,
    startDate: current.value.startDate,
    startPeriod: current.value.startPeriod,
    endDate: current.value.endDate,
    endPeriod: current.value.endPeriod,
    interimEmployeeId: current.value.interimEmployeeId ?? '',
    reason: current.value.reason ?? '',
  }
  // Le calendrier qui pilote isNotWorkingDay/formWorkingDaysCount doit etre
  // celui DU BENEFICIAIRE (meme regle qu'AbsenceCreate.vue) — jamais
  // refetch si deja en memoire pour la bonne personne, mais on ne le sait
  // pas d'avance donc on le rejoue a chaque entree en edition.
  calendarStore.fetchCalendar(current.value.employeeId)
  isEditMode.value = true
}
function cancelEdit() { isEditMode.value = false }

// ── Avertissements en direct pendant l'edition (meme regle qu'AbsenceCreate.vue,
// decision du 04/08 : solde/préavis/date passée restent non bloquants, le
// validateur decide) — recalcules depuis `form`, pas depuis `current` figé,
// pour ne pas perdre ces controles quand on modifie un brouillon. ──
const currentType = computed(() => leaveTypesStore.leaveTypes.find(t => t.id === form.value.leaveTypeId) ?? null)
const isMedicalType = computed(() => currentType.value?.workflowType === 'Medical')

const formIsPastDate = computed(() => {
  if (!form.value.startDate) return false
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const p = form.value.startDate.split('-').map(Number)
  return new Date(p[0] ?? 0, (p[1] ?? 1) - 1, p[2] ?? 1) < today
})

const formWorkingDaysCount = computed(() => {
  if (!form.value.startDate || !form.value.endDate) return 0
  return getWorkingDaysBetween(form.value.startDate, form.value.endDate, calendarStore.calendar, form.value.startPeriod, form.value.endPeriod)
})

// Meme restriction qu'a la creation : le solde "myBalances" n'est connu que
// pour l'utilisateur connecte, l'avertissement en direct ne peut donc
// s'afficher que si le beneficiaire de la demande, c'est lui-meme.
const isOwnRequest = computed(() => !!current.value && current.value.employeeId === auth.user?.id)
const myBalance = computed(() => {
  if (!form.value.leaveTypeId) return null
  return leaveTransactionStore.myBalances.find(b => b.leaveTypeId === form.value.leaveTypeId) ?? null
})
const formIsBalanceInsufficient = computed(() => {
  if (!formWorkingDaysCount.value || !currentType.value) return false
  if (currentType.value.daysPerYear <= 0) return false
  if (!isOwnRequest.value || !myBalance.value) return false
  return formWorkingDaysCount.value > myBalance.value.balance
})

// Préavis : recalculé depuis form.startDate — current.createdAt (date de
// soumission initiale) ne change pas en édition, seule la date de début
// bouge, voir noticeWarning() ci-dessus pour l'équivalent lecture seule.
const formNoticeWarning = computed(() => {
  if (!current.value || !form.value.startDate || !currentType.value || currentType.value.noticeDays <= 0) return null
  const submitted = new Date(current.value.createdAt); submitted.setHours(0, 0, 0, 0)
  const p = form.value.startDate.split('-').map(Number)
  const start = new Date(p[0] ?? 0, (p[1] ?? 1) - 1, p[2] ?? 1)
  const diffDays = Math.ceil((start.getTime() - submitted.getTime()) / 86400000)
  if (diffDays >= currentType.value.noticeDays) return null
  return `Préavis de ${currentType.value.noticeDays} jour(s) non respecté (soumis ${diffDays} jour(s) avant le début)`
})
async function save() {
  if (!current.value || !form.value.leaveTypeId) return
  try {
    await store.update(current.value.id, {
      leaveTypeId: form.value.leaveTypeId,
      startDate: form.value.startDate,
      startPeriod: form.value.startPeriod,
      endDate: form.value.endDate,
      endPeriod: form.value.endPeriod,
      interimEmployeeId: form.value.interimEmployeeId || undefined,
      reason: form.value.reason,
    })
    isEditMode.value = false
  } catch {
    saveError.value = store.error ?? "La mise à jour a échoué."
  }
}

const pageTitle = computed(() => (current.value ? `${leaveNo(current.value)} · ${current.value.employeeName}` : ''))
const readBox = 'text-[13px] text-foreground bg-background border border-border rounded-md px-2.5 h-[38px] flex items-center'

// Suppression definitive (Lot I) — jamais mise en avant, toujours en bas de
// la fiche (decision du 11/08, meme pattern que EmployeeCard.vue). Disponible
// quel que soit le statut courant de la demande.
const deleting = ref(false)
async function deletePermanently() {
  if (!current.value) return
  if (!(await confirmDialog(
    `Supprimer définitivement cette demande (${leaveNo(current.value)}) ? Elle disparaîtra de toute l'application. Cette action est irréversible.`,
    { danger: true },
  ))) return
  deleting.value = true
  try {
    await store.deletePermanently(current.value.id)
    emit('close')
  } catch {
    // store.error porte le message pour l'UI (toast)
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <CardModalShell
    v-if="current"
    :page-title="pageTitle"
    :page-number="leaveNo(current)"
    banner-label="Fiche demande d'absence"
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
      <AbsenceWorkflowActions :leave="current" @deleted="emit('close')" />
    </template>

    <template #form>
      <div class="px-6 py-5 max-w-4xl">
        <!-- Section Général -->
        <FormSection title="Général" :recaps="[current.employeeName, current.leaveTypeName, `${current.daysCount}j`]">
        <div class="grid grid-cols-2 gap-x-6 gap-y-4 max-sm:grid-cols-1">
          <!-- Employé -->
          <div :class="cls.field">
            <label :class="cls.fieldLabel">Employé</label>
            <div class="flex items-center gap-2 h-[38px]">
              <UserAvatar :name="current.employeeName" size="sm" />
              <span class="text-[13px] font-medium text-foreground">{{ current.employeeName }}</span>
            </div>
          </div>

          <!-- Type -->
          <div :class="cls.field">
            <label :class="cls.fieldLabel">Type d'absence</label>
            <SearchableDropdown
              v-if="isEditMode"
              :items="leaveTypeItems"
              :model-value="form.leaveTypeId"
              :show-avatar="false"
              @update:model-value="form.leaveTypeId = String($event)"
            />
            <div v-else :class="readBox">{{ current.leaveTypeName }}</div>
          </div>

          <!-- Date début -->
          <div :class="cls.field">
            <label :class="cls.fieldLabel">Date de début</label>
            <input v-if="isEditMode" type="date" v-model="form.startDate" :class="cls.fieldInput" />
            <div v-else :class="readBox">{{ formatDate(current.startDate) }}</div>
            <div v-if="isEditMode && formIsPastDate && !isMedicalType" :class="cls.fieldWarning"><TriangleAlert class="w-3.5 h-3.5 shrink-0" /> La date est dans le passé, confirmez-vous ?</div>
          </div>

          <!-- Période de début -->
          <div :class="cls.field">
            <span :class="cls.fieldLabel">Période de début</span>
            <div v-if="isEditMode" :class="cls.radioGroup">
              <label :class="cls.radioItem"><input type="radio" v-model="form.startPeriod" value="full" /><span>Journée entière</span></label>
              <label :class="cls.radioItem"><input type="radio" v-model="form.startPeriod" value="am" /><span>Matin</span></label>
              <label :class="cls.radioItem"><input type="radio" v-model="form.startPeriod" value="pm" /><span>Après-midi</span></label>
            </div>
            <div v-else :class="readBox">{{ { full: 'Journée entière', am: 'Matin', pm: 'Après-midi' }[current.startPeriod] }}</div>
          </div>

          <!-- Date fin -->
          <div :class="cls.field">
            <label :class="cls.fieldLabel">Date de fin</label>
            <input v-if="isEditMode" type="date" v-model="form.endDate" :min="form.startDate" :class="cls.fieldInput" />
            <div v-else :class="readBox">{{ formatDate(current.endDate) }}</div>
          </div>

          <!-- Période de fin -->
          <div :class="cls.field">
            <span :class="cls.fieldLabel">Période de fin</span>
            <div v-if="isEditMode" :class="cls.radioGroup">
              <label :class="cls.radioItem"><input type="radio" v-model="form.endPeriod" value="full" /><span>Journée entière</span></label>
              <label :class="cls.radioItem"><input type="radio" v-model="form.endPeriod" value="am" /><span>Matin</span></label>
              <label :class="cls.radioItem"><input type="radio" v-model="form.endPeriod" value="pm" /><span>Après-midi</span></label>
            </div>
            <div v-else :class="readBox">{{ { full: 'Journée entière', am: 'Matin', pm: 'Après-midi' }[current.endPeriod] }}</div>
          </div>

          <!-- Jours ouvrés -->
          <div :class="cls.field">
            <label :class="cls.fieldLabel">Jours ouvrés</label>
            <div :class="readBox">{{ current.daysCount }} jour(s)</div>
          </div>

          <!-- Référence -->
          <div :class="cls.field">
            <label :class="cls.fieldLabel">Référence</label>
            <div :class="readBox">{{ current.referenceCode }}</div>
          </div>

          <!-- Créée par -->
          <div v-if="current.createdByName && current.createdByName !== current.employeeName" :class="cls.field">
            <label :class="cls.fieldLabel">Créée par</label>
            <div :class="readBox">{{ current.createdByName }}</div>
          </div>

          <!-- Intérimaire -->
          <div v-if="isEditMode || current.interimEmployeeName" :class="cls.field">
            <label :class="cls.fieldLabel">Intérimaire</label>
            <SearchableDropdown
              v-if="isEditMode"
              :items="interimItems"
              :model-value="form.interimEmployeeId"
              placeholder="Qui assure l'intérim ?"
              @update:model-value="form.interimEmployeeId = String($event)"
            />
            <div v-else :class="readBox">{{ current.interimEmployeeName }}</div>
          </div>

          <!-- Motif -->
          <div :class="cls.field">
            <label :class="cls.fieldLabel">Motif</label>
            <textarea v-if="isEditMode" v-model="form.reason" :class="cls.fieldTextarea" rows="3" placeholder="Motif de la demande…"></textarea>
            <div v-else :class="[readBox, 'min-h-[38px] h-auto py-2']">{{ current.reason || '—' }}</div>
          </div>

          <!-- Préavis insuffisant : avertissement non bloquant. En édition,
               recalculé en direct depuis form.startDate (voir formNoticeWarning). -->
          <div v-if="isEditMode ? formNoticeWarning : noticeWarning(current)" class="flex items-center gap-2 text-[13px] text-warning bg-warning-bg rounded-md px-2.5 py-2 col-span-full">
            <TriangleAlert class="w-4 h-4 shrink-0" /> {{ isEditMode ? formNoticeWarning : noticeWarning(current) }}
          </div>

          <!-- Solde insuffisant : avertissement non bloquant, le validateur décide.
               En édition, recalculé en direct depuis le formulaire (form*) plutôt
               que depuis le flag figé du serveur (current.insufficientBalance),
               sinon changer de type/dates ne met plus à jour l'avertissement. -->
          <div v-if="isEditMode ? formIsBalanceInsufficient : current.insufficientBalance" class="flex items-center gap-2 text-[13px] text-danger bg-danger-bg rounded-md px-2.5 py-2 col-span-full">
            <TriangleAlert class="w-4 h-4 shrink-0" /> Solde insuffisant pour ce type de congé, à valider en connaissance de cause.
          </div>

          <!-- Motif de refus / retour -->
          <div v-if="current.rejectionReason" :class="cls.field">
            <label :class="cls.fieldLabel">{{ current.status === 'Returned' ? 'Commentaire de retour' : 'Motif du refus' }}</label>
            <div class="text-[13px] text-danger bg-danger-bg border border-danger/20 rounded-md px-2.5 py-2">{{ current.rejectionReason }}</div>
          </div>
        </div>
        <div v-if="saveError" class="text-xs text-danger bg-danger-bg px-3 py-2 rounded-md mt-3">{{ saveError }}</div>
        </FormSection>

        <!-- Justificatif médical (congés maladie uniquement) -->
        <FormSection v-if="isMedicalLeave" :title="`Justificatif médical (${attachments.length})`">
          <input ref="attachmentInput" type="file" class="hidden" @change="onAttachmentSelected" />
          <button
            class="inline-flex items-center gap-1 px-3 py-[5px] rounded-md bg-primary/10 text-primary text-xs font-semibold cursor-pointer hover:bg-primary/20 mb-2 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="attachmentStore.uploading"
            @click="triggerAttachmentUpload"
          >
            <Upload class="w-3.5 h-3.5" /> {{ attachmentStore.uploading ? 'Envoi…' : 'Ajouter un justificatif' }}
          </button>
          <div v-if="attachments.length === 0" class="text-[12px] text-muted-foreground italic">Aucun justificatif fourni</div>
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

        <!-- Historique de validation -->
        <FormSection v-if="validationHistory?.length" title="Historique de validation">
          <ValidationTimeline :history="validationHistory" />
        </FormSection>

        <!-- Suppression définitive — jamais possible une fois approuvée
             (Approved/Registered/Done/Regularized) : c'est la trace qui
             justifie le solde de congés consommé. -->
        <div v-if="auth.hasPermission('CONGE_SUPPRIMER') && !APPROVED_LINEAGE.includes(current.status)" class="flex justify-end mt-1">
          <button :class="cls.btnDestructive" :disabled="deleting" @click="deletePermanently">
            <Trash2 class="w-3.5 h-3.5" /> {{ deleting ? 'Suppression…' : 'Supprimer définitivement' }}
          </button>
        </div>
      </div>
    </template>
  </CardModalShell>
</template>
