<script setup lang="ts">
/**
 * Boutons d'action métier d'un contrat (Soumettre / Approuver / Retourner /
 * Refuser / Envoyer au candidat / Le candidat accepte / Le candidat refuse /
 * Annuler) + modales de commentaire. Réutilisé dans les actions contextuelles
 * de la liste (#row-actions) ET dans la barre d'actions de la fiche
 * (ContractCard), même pattern que MissionWorkflowActions.vue.
 */
import { reactive } from 'vue'
import { Send, Check, Undo2, X, Mail, CheckCircle2, XCircle, Ban } from 'lucide-vue-next'
import ModalShell from '../ui/ModalShell.vue'
import * as cls from '../../lib/formClasses'
import { confirmDialog } from '../../lib/confirm'
import { useContractStore } from '../../stores/recruitment'
import type { Contract } from '../../stores/recruitment'

const props = defineProps<{ item: Contract }>()
const contractStore = useContractStore()

const btn = 'px-2.5 py-[5px] rounded text-xs font-medium cursor-pointer whitespace-nowrap inline-flex items-center gap-1 transition-colors'
const approveCls = btn + ' bg-success-bg text-success hover:brightness-95'
const returnCls  = btn + ' bg-info-bg text-info hover:brightness-95'
const rejectCls  = btn + ' bg-danger-bg text-danger hover:brightness-95'
const cancelCls  = btn + ' bg-neutral-bg text-neutral hover:brightness-95'
const infoCls    = btn + ' bg-info-bg text-info hover:brightness-95'

const CANCELLABLE: Contract['status'][] = ['Draft', 'PendingApproval', 'Approved', 'SentToCandidate']

function submitContract() { contractStore.submit(props.item.id) }
function approveContract() { contractStore.approve(props.item.id) }
function sendContract() { contractStore.sendToCandidate(props.item.id) }

async function acceptContract() {
  if (await confirmDialog('Confirmer que le candidat accepte ce contrat ?')) contractStore.candidateAccept(props.item.id)
}
async function refuseContract() {
  if (await confirmDialog('Confirmer que le candidat refuse ce contrat ?')) contractStore.candidateRefuse(props.item.id)
}
async function cancelContract() {
  if (await confirmDialog('Annuler ce contrat ?')) contractStore.cancel(props.item.id)
}

/* ── Modale Retourner ───────────────────────────────────────── */
const returnModal = reactive({ open: false, comment: '', error: '' })
function openReturn() { Object.assign(returnModal, { open: true, comment: '', error: '' }) }
function confirmReturn() {
  if (returnModal.comment.trim().length === 0) { returnModal.error = 'Le commentaire est requis'; return }
  contractStore.returnItem(props.item.id, returnModal.comment.trim())
  returnModal.open = false
}

/* ── Modale Refuser ─────────────────────────────────────────── */
const rejectModal = reactive({ open: false, reason: '', error: '' })
function openReject() { Object.assign(rejectModal, { open: true, reason: '', error: '' }) }
function confirmReject() {
  if (rejectModal.reason.trim().length === 0) { rejectModal.error = 'Le motif est requis'; return }
  contractStore.reject(props.item.id, rejectModal.reason.trim())
  rejectModal.open = false
}
</script>

<template>
  <div class="flex items-center gap-1.5 flex-wrap">
    <button v-if="item.status === 'Draft'" :class="approveCls" @click="submitContract"><Send class="w-3.5 h-3.5" /> Soumettre</button>
    <template v-if="item.status === 'PendingApproval'">
      <button :class="approveCls" @click="approveContract"><Check class="w-3.5 h-3.5" /> Approuver</button>
      <button :class="returnCls" @click="openReturn"><Undo2 class="w-3.5 h-3.5" /> Retourner</button>
      <button :class="rejectCls" @click="openReject"><X class="w-3.5 h-3.5" /> Refuser</button>
    </template>
    <button v-if="item.status === 'Approved'" :class="infoCls" @click="sendContract"><Mail class="w-3.5 h-3.5" /> Envoyer au candidat</button>
    <template v-if="item.status === 'SentToCandidate'">
      <button :class="approveCls" @click="acceptContract"><CheckCircle2 class="w-3.5 h-3.5" /> Le candidat accepte</button>
      <button :class="rejectCls" @click="refuseContract"><XCircle class="w-3.5 h-3.5" /> Le candidat refuse</button>
    </template>
    <button v-if="CANCELLABLE.includes(item.status)" :class="cancelCls" @click="cancelContract"><Ban class="w-3.5 h-3.5" /> Annuler</button>
    <span v-if="!CANCELLABLE.includes(item.status) && item.status !== 'SentToCandidate'" class="text-xs text-muted-foreground italic">Aucune action disponible</span>
  </div>

  <!-- Modale Retourner -->
  <ModalShell :open="returnModal.open" title="Retourner le contrat" max-width="max-w-[420px]" @close="returnModal.open = false">
    <label :class="cls.fieldLabel">Commentaire *</label>
    <textarea v-model="returnModal.comment" :class="cls.fieldTextarea" placeholder="Expliquez les corrections requises…" rows="4"></textarea>
    <div v-if="returnModal.error" :class="cls.fieldError">{{ returnModal.error }}</div>
    <template #footer>
      <button :class="cls.btnPrimary" @click="confirmReturn"><Undo2 class="w-4 h-4" /> Retourner</button>
      <button :class="cls.btnOutline" @click="returnModal.open = false">Annuler</button>
    </template>
  </ModalShell>

  <!-- Modale Refuser -->
  <ModalShell :open="rejectModal.open" title="Refuser le contrat" max-width="max-w-[420px]" @close="rejectModal.open = false">
    <label :class="cls.fieldLabel">Motif du refus *</label>
    <textarea v-model="rejectModal.reason" :class="cls.fieldTextarea" placeholder="Indiquez le motif du refus…" rows="4"></textarea>
    <div v-if="rejectModal.error" :class="cls.fieldError">{{ rejectModal.error }}</div>
    <template #footer>
      <button :class="cls.btnPrimary" @click="confirmReject">Confirmer le refus</button>
      <button :class="cls.btnOutline" @click="rejectModal.open = false">Annuler</button>
    </template>
  </ModalShell>
</template>
