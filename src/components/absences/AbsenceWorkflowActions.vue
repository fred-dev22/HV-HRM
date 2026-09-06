<script setup lang="ts">
/**
 * Boutons d'action métier d'une demande d'absence (Approuver / Retourner /
 * Refuser / Soumettre / Annuler / Marquer effectué / Régulariser), avec les
 * modales de commentaire nécessaires. Réutilisé dans la toolbar de la liste
 * (actions contextuelles) ET dans la barre d'actions de la fiche (AbsenceCard).
 *
 * Le serveur reste la seule autorité sur qui peut valider quoi (voir
 * leave-request.service.ts assertIsCurrentApprover) — les gates ci-dessous
 * n'évitent que les clics manifestement hors sujet (ex : approuver sa propre
 * demande), pas de logique de permission dupliquée côté client.
 */
import { reactive } from 'vue'
import { Undo2, Check, X, Send, CheckCheck, RotateCcw, Ban, Trash2 } from 'lucide-vue-next'
import ModalShell from '../ui/ModalShell.vue'
import * as cls from '../../lib/formClasses'
import { confirmDialog } from '../../lib/confirm'
import { useLeaveRequestStore } from '../../stores/leaveRequests'
import { useAuthStore } from '../../stores/auth'
import type { LeaveRequest } from '../../types'

const props = defineProps<{ leave: LeaveRequest }>()
const emit = defineEmits<{ deleted: [] }>()
const store = useLeaveRequestStore()
const auth  = useAuthStore()

const btn = 'px-2.5 py-[5px] rounded text-xs font-medium cursor-pointer whitespace-nowrap inline-flex items-center gap-1 transition-colors'
const approveCls = btn + ' bg-success-bg text-success hover:brightness-95'
const returnCls  = btn + ' bg-info-bg text-info hover:brightness-95'
const rejectCls  = btn + ' bg-danger-bg text-danger hover:brightness-95'
const cancelCls  = btn + ' bg-neutral-bg text-neutral hover:brightness-95'
const deleteCls  = btn + ' bg-danger-bg text-danger hover:brightness-95'

const IN_APPROVAL: LeaveRequest['status'][] = ['Pending', 'InApprovalN1', 'InApprovalN2', 'InApprovalN3', 'InApprovalN4']
// Une fois Approved/Registered, seule une action administrative peut encore
// annuler (voir LeaveRequestService.cancel côté backend) — le demandeur lui-
// même ne peut plus revenir en arrière depuis ce bouton self-service.
const CANCELLABLE: LeaveRequest['status'][] = ['Draft', 'Pending', 'InApprovalN1', 'InApprovalN2', 'InApprovalN3', 'InApprovalN4']

// Beneficiaire OU createur (Lot A #172 : n'importe qui peut creer une
// demande pour n'importe qui) — le createur doit garder la main sur les
// actions de son propre brouillon meme s'il n'en est pas le beneficiaire,
// exactement comme le backend l'autorise deja (voir
// LeaveRequestService.submit/cancel/remove).
const isOwner   = () => props.leave.employeeId === auth.user?.id || props.leave.createdById === auth.user?.id
// Avoir la permission CONGE_VALIDER (large, quelqu'un qui valide QUELQUE
// PART dans l'entreprise) ne veut pas dire que CETTE demande attend une
// decision de MOI precisement — un Directeur RH avec CONGE_VOIR_TOUT peut
// voir une demande encore a l'etape N+1 alors que lui n'intervient qu'en
// N+2 : sans ce filtre supplementaire, les boutons Approuver/Retourner/
// Refuser s'affichaient quand meme et echouaient cote serveur au clic
// (assertIsCurrentApprover). pendingForMe est deja calcule cote serveur
// avec la bonne logique d'etape courante (voir findPendingForMe) — on s'en
// sert ici comme unique source de verite plutot que de la dupliquer.
const canValidate = () =>
  auth.hasPermission('CONGE_VALIDER') && !isOwner() && IN_APPROVAL.includes(props.leave.status) &&
  store.pendingForMe.some(l => l.id === props.leave.id)

function submit()  { store.submit(props.leave.id) }
function markDone() { store.markDone(props.leave.id) }
function regularize() { store.regularize(props.leave.id) }
async function cancel() {
  if (await confirmDialog('Annuler cette demande ?')) store.cancel(props.leave.id)
}
// Suppression definitive — distincte d'Annuler (qui garde la trace, statut
// Cancelled). Reservee au createur et aux brouillons (le serveur refait la
// meme verification, voir LeaveRequestService.remove) : rien n'a encore ete
// soumis, aucune trace d'audit a preserver.
async function remove() {
  if (await confirmDialog('Supprimer définitivement cette demande ? Cette action est irréversible.', { danger: true })) {
    await store.remove(props.leave.id)
    emit('deleted')
  }
}

/* ── Modale Approuver (commentaire facultatif) ────────────────── */
const approveModal = reactive({ open: false, comment: '', error: '' })
function openApprove() { Object.assign(approveModal, { open: true, comment: '', error: '' }) }
// Attend l'appel avant de fermer : sans ça, un échec serveur (permission,
// étape déjà décidée...) fermait la modale silencieusement — l'utilisateur
// voyait juste "rien ne se passe", sans lien évident avec la vraie cause.
async function confirmApprove() {
  approveModal.error = ''
  try {
    await store.approve(props.leave.id, approveModal.comment.trim() || undefined)
    approveModal.open = false
  } catch {
    approveModal.error = store.error ?? 'Impossible de valider cette demande'
  }
}

/* ── Modale Retourner ───────────────────────────────────────── */
const returnModal = reactive({ open: false, comment: '', error: '' })
function openReturn() { Object.assign(returnModal, { open: true, comment: '', error: '' }) }
async function confirmReturn() {
  if (returnModal.comment.trim().length === 0) { returnModal.error = 'Le commentaire est requis'; return }
  returnModal.error = ''
  try {
    await store.returnLeave(props.leave.id, returnModal.comment.trim())
    returnModal.open = false
  } catch {
    returnModal.error = store.error ?? 'Impossible de retourner cette demande'
  }
}

/* ── Modale Refuser ─────────────────────────────────────────── */
const rejectModal = reactive({ open: false, reason: '', error: '' })
function openReject() { Object.assign(rejectModal, { open: true, reason: '', error: '' }) }
async function confirmReject() {
  if (rejectModal.reason.trim().length === 0) { rejectModal.error = 'Le motif est requis'; return }
  rejectModal.error = ''
  try {
    await store.reject(props.leave.id, rejectModal.reason.trim())
    rejectModal.open = false
  } catch {
    rejectModal.error = store.error ?? 'Impossible de refuser cette demande'
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
    <template v-else-if="isOwner() && (leave.status === 'Draft' || leave.status === 'Returned')">
      <button :class="approveCls" @click="submit"><Send class="w-3.5 h-3.5" /> Soumettre</button>
    </template>
    <template v-else-if="isOwner() && leave.status === 'Registered'">
      <button :class="approveCls" @click="markDone"><CheckCheck class="w-3.5 h-3.5" /> Marquer effectué</button>
    </template>
    <template v-else-if="isOwner() && leave.status === 'Done'">
      <button :class="approveCls" @click="regularize"><RotateCcw class="w-3.5 h-3.5" /> Régulariser</button>
    </template>
    <span v-else-if="!isOwner() || !CANCELLABLE.includes(leave.status)" class="text-xs text-muted-foreground italic">Aucune action disponible</span>

    <button v-if="isOwner() && CANCELLABLE.includes(leave.status) && !canValidate()" :class="cancelCls" @click="cancel">
      <Ban class="w-3.5 h-3.5" /> Annuler
    </button>
    <button v-if="isOwner() && leave.status === 'Draft'" :class="deleteCls" @click="remove">
      <Trash2 class="w-3.5 h-3.5" /> Supprimer
    </button>
  </div>

  <!-- Modale Approuver -->
  <ModalShell :open="approveModal.open" :title="`Approuver la demande de ${leave.employeeName}`" max-width="max-w-[420px]" @close="approveModal.open = false">
    <label :class="cls.fieldLabel">Commentaire <span :class="cls.fieldOptional">(optionnel)</span></label>
    <textarea v-model="approveModal.comment" :class="cls.fieldTextarea" placeholder="Un commentaire pour l'employé…" rows="3"></textarea>
    <div v-if="approveModal.error" :class="cls.fieldError">{{ approveModal.error }}</div>
    <template #footer>
      <button :class="cls.btnPrimary" @click="confirmApprove"><Check class="w-4 h-4" /> Approuver</button>
      <button :class="cls.btnOutline" @click="approveModal.open = false">Annuler</button>
    </template>
  </ModalShell>

  <!-- Modale Retourner -->
  <ModalShell :open="returnModal.open" :title="`Retourner la demande de ${leave.employeeName}`" max-width="max-w-[420px]" @close="returnModal.open = false">
    <label :class="cls.fieldLabel">Commentaire *</label>
    <textarea v-model="returnModal.comment" :class="cls.fieldTextarea" placeholder="Expliquez ce qui doit être corrigé…" rows="4"></textarea>
    <div v-if="returnModal.error" :class="cls.fieldError">{{ returnModal.error }}</div>
    <template #footer>
      <button :class="cls.btnPrimary" @click="confirmReturn"><Undo2 class="w-4 h-4" /> Retourner</button>
      <button :class="cls.btnOutline" @click="returnModal.open = false">Annuler</button>
    </template>
  </ModalShell>

  <!-- Modale Refuser -->
  <ModalShell :open="rejectModal.open" :title="`Refuser la demande de ${leave.employeeName}`" max-width="max-w-[420px]" @close="rejectModal.open = false">
    <label :class="cls.fieldLabel">Motif du refus *</label>
    <textarea v-model="rejectModal.reason" :class="cls.fieldTextarea" placeholder="Indiquez le motif du refus…" rows="4"></textarea>
    <div v-if="rejectModal.error" :class="cls.fieldError">{{ rejectModal.error }}</div>
    <template #footer>
      <button :class="cls.btnPrimary" @click="confirmReject">Confirmer le refus</button>
      <button :class="cls.btnOutline" @click="rejectModal.open = false">Annuler</button>
    </template>
  </ModalShell>
</template>
