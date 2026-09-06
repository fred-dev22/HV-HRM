<script setup lang="ts">
/**
 * Boutons d'action métier d'une note de frais (Approuver / Retourner /
 * Refuser / Soumettre / Annuler) + modales de commentaire. Réutilisé dans la
 * toolbar de la liste (actions contextuelles) ET dans la barre d'actions de la
 * fiche (ExpenseCard). Calqué sur MissionWorkflowActions/AbsenceWorkflowActions.
 *
 * Le serveur reste la seule autorité sur qui peut valider quoi (voir
 * expense-report.service.ts assertIsCurrentApprover) — les gates ci-dessous
 * n'évitent que les clics manifestement hors sujet, pas de logique de
 * permission dupliquée côté client.
 */
import { reactive } from 'vue'
import { Undo2, Check, X, Send, Ban, Trash2 } from 'lucide-vue-next'
import ModalShell from '../ui/ModalShell.vue'
import * as cls from '../../lib/formClasses'
import { confirmDialog } from '../../lib/confirm'
import { useExpenseStore } from '../../stores/expenses'
import { useAuthStore } from '../../stores/auth'
import type { ExpenseReport } from '../../types'

const props = defineProps<{ report: ExpenseReport }>()
const emit = defineEmits<{ deleted: [] }>()
const expenseStore = useExpenseStore()
const auth = useAuthStore()

const btn = 'px-2.5 py-[5px] rounded text-xs font-medium cursor-pointer whitespace-nowrap inline-flex items-center gap-1 transition-colors'
const approveCls = btn + ' bg-success-bg text-success hover:brightness-95'
const returnCls  = btn + ' bg-info-bg text-info hover:brightness-95'
const rejectCls  = btn + ' bg-danger-bg text-danger hover:brightness-95'
const cancelCls  = btn + ' bg-neutral-bg text-neutral hover:brightness-95'
const deleteCls  = btn + ' bg-danger-bg text-danger hover:brightness-95'

const IN_APPROVAL: ExpenseReport['status'][] = ['Pending', 'InApprovalN1', 'InApprovalN2', 'InApprovalN3', 'InApprovalN4']
const CANCELLABLE: ExpenseReport['status'][] = ['Draft', 'InApprovalN1', 'InApprovalN2', 'InApprovalN3', 'InApprovalN4', 'Approved']

// Beneficiaire OU createur (Lot A #172) — voir AbsenceWorkflowActions.vue
// pour le detail, meme raisonnement.
const isOwner   = () => props.report.employeeId === auth.user?.id || props.report.createdById === auth.user?.id
const canValidate = () => auth.hasPermission('FRAIS_VALIDER') && !isOwner() && IN_APPROVAL.includes(props.report.status)

function submit()  { expenseStore.submit(props.report.id) }
async function cancel() {
  if (await confirmDialog('Annuler cette note de frais ?')) expenseStore.cancel(props.report.id)
}
async function remove() {
  if (await confirmDialog('Supprimer définitivement cette note de frais ? Cette action est irréversible.', { danger: true })) {
    await expenseStore.remove(props.report.id)
    emit('deleted')
  }
}

/* ── Modale Approuver (commentaire facultatif) ────────────────── */
const approveModal = reactive({ open: false, comment: '', error: '' })
function openApprove() { Object.assign(approveModal, { open: true, comment: '', error: '' }) }
// Attend l'appel avant de fermer : sans ça, un échec serveur fermait la
// modale silencieusement — l'utilisateur voyait juste "rien ne se passe".
async function confirmApprove() {
  approveModal.error = ''
  try {
    await expenseStore.approve(props.report.id, approveModal.comment.trim() || undefined)
    approveModal.open = false
  } catch {
    approveModal.error = expenseStore.error ?? 'Impossible de valider cette note de frais'
  }
}

/* ── Modale Retourner ───────────────────────────────────────── */
const returnModal = reactive({ open: false, comment: '', error: '' })
function openReturn() { Object.assign(returnModal, { open: true, comment: '', error: '' }) }
async function confirmReturn() {
  if (returnModal.comment.trim().length === 0) { returnModal.error = 'Le commentaire est requis'; return }
  returnModal.error = ''
  try {
    await expenseStore.returnReport(props.report.id, returnModal.comment.trim())
    returnModal.open = false
  } catch {
    returnModal.error = expenseStore.error ?? 'Impossible de retourner cette note de frais'
  }
}

/* ── Modale Refuser ─────────────────────────────────────────── */
const rejectModal = reactive({ open: false, reason: '', error: '' })
function openReject() { Object.assign(rejectModal, { open: true, reason: '', error: '' }) }
async function confirmReject() {
  if (rejectModal.reason.trim().length === 0) { rejectModal.error = 'Le motif est requis'; return }
  rejectModal.error = ''
  try {
    await expenseStore.reject(props.report.id, rejectModal.reason.trim())
    rejectModal.open = false
  } catch {
    rejectModal.error = expenseStore.error ?? 'Impossible de refuser cette note de frais'
  }
}
</script>

<template>
  <div class="flex items-center gap-1.5 flex-wrap">
    <template v-if="canValidate()">
      <button :class="approveCls" @click="openApprove"><Check class="w-3.5 h-3.5" /> Approuver</button>
      <button :class="returnCls" @click="openReturn"><Undo2 class="w-3.5 h-3.5" /> Retourner</button>
      <button :class="rejectCls" @click="openReject"><X class="w-3.5 h-3.5" /> Refuser</button>
    </template>
    <template v-else-if="isOwner() && (report.status === 'Draft' || report.status === 'Returned')">
      <button :class="approveCls" @click="submit"><Send class="w-3.5 h-3.5" /> Soumettre</button>
    </template>
    <span v-else-if="!isOwner() || !CANCELLABLE.includes(report.status)" class="text-xs text-muted-foreground italic">Aucune action disponible</span>

    <button v-if="isOwner() && CANCELLABLE.includes(report.status) && !canValidate()" :class="cancelCls" @click="cancel">
      <Ban class="w-3.5 h-3.5" /> Annuler
    </button>
    <button v-if="isOwner() && report.status === 'Draft'" :class="deleteCls" @click="remove">
      <Trash2 class="w-3.5 h-3.5" /> Supprimer
    </button>
  </div>

  <!-- Modale Approuver -->
  <ModalShell :open="approveModal.open" :title="`Approuver la note de ${report.employeeName}`" max-width="max-w-[420px]" @close="approveModal.open = false">
    <label :class="cls.fieldLabel">Commentaire <span :class="cls.fieldOptional">(optionnel)</span></label>
    <textarea v-model="approveModal.comment" :class="cls.fieldTextarea" placeholder="Un commentaire pour l'employé…" rows="3"></textarea>
    <div v-if="approveModal.error" :class="cls.fieldError">{{ approveModal.error }}</div>
    <template #footer>
      <button :class="cls.btnPrimary" @click="confirmApprove"><Check class="w-4 h-4" /> Approuver</button>
      <button :class="cls.btnOutline" @click="approveModal.open = false">Annuler</button>
    </template>
  </ModalShell>

  <!-- Modale Retourner -->
  <ModalShell :open="returnModal.open" :title="`Retourner la note de ${report.employeeName}`" max-width="max-w-[420px]" @close="returnModal.open = false">
    <label :class="cls.fieldLabel">Commentaire *</label>
    <textarea v-model="returnModal.comment" :class="cls.fieldTextarea" placeholder="Expliquez les corrections requises…" rows="4"></textarea>
    <div v-if="returnModal.error" :class="cls.fieldError">{{ returnModal.error }}</div>
    <template #footer>
      <button :class="cls.btnPrimary" @click="confirmReturn"><Undo2 class="w-4 h-4" /> Retourner</button>
      <button :class="cls.btnOutline" @click="returnModal.open = false">Annuler</button>
    </template>
  </ModalShell>

  <!-- Modale Refuser -->
  <ModalShell :open="rejectModal.open" :title="`Refuser la note de ${report.employeeName}`" max-width="max-w-[420px]" @close="rejectModal.open = false">
    <label :class="cls.fieldLabel">Motif du refus *</label>
    <textarea v-model="rejectModal.reason" :class="cls.fieldTextarea" placeholder="Indiquez le motif du refus…" rows="4"></textarea>
    <div v-if="rejectModal.error" :class="cls.fieldError">{{ rejectModal.error }}</div>
    <template #footer>
      <button :class="cls.btnPrimary" @click="confirmReject">Confirmer le refus</button>
      <button :class="cls.btnOutline" @click="rejectModal.open = false">Annuler</button>
    </template>
  </ModalShell>
</template>
