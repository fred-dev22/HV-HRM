<script setup lang="ts">
/**
 * Boutons d'action métier d'une expression de besoin (Soumettre / Approuver /
 * Retourner / Refuser / Annuler) + modales de commentaire. Réutilisé dans les
 * actions contextuelles de la liste ET dans la barre d'actions de la fiche
 * (HiringRequestCard). Calqué sur MissionWorkflowActions.
 */
import { reactive } from 'vue'
import { Send, Check, Undo2, X, Ban } from 'lucide-vue-next'
import ModalShell from '../ui/ModalShell.vue'
import * as cls from '../../lib/formClasses'
import { confirmDialog } from '../../lib/confirm'
import { useHiringRequestStore } from '../../stores/recruitment'
import type { HiringRequest } from '../../stores/recruitment'

const props = defineProps<{ item: HiringRequest }>()
const hiringRequestStore = useHiringRequestStore()

const btn = 'px-2.5 py-[5px] rounded text-xs font-medium cursor-pointer whitespace-nowrap inline-flex items-center gap-1 transition-colors'
const approveCls = btn + ' bg-success-bg text-success hover:brightness-95'
const returnCls  = btn + ' bg-info-bg text-info hover:brightness-95'
const rejectCls  = btn + ' bg-danger-bg text-danger hover:brightness-95'
const cancelCls  = btn + ' bg-neutral-bg text-neutral hover:brightness-95'

const CANCELLABLE: HiringRequest['status'][] = ['Draft', 'PendingApproval']

function submitReq() { hiringRequestStore.submit(props.item.id) }
function approveReq() { hiringRequestStore.approve(props.item.id) }

async function cancelReq() {
  if (await confirmDialog('Annuler cette expression de besoin ?')) hiringRequestStore.cancel(props.item.id)
}

/* ── Modale Retourner ───────────────────────────────────────── */
const returnModal = reactive({ open: false, comment: '', error: '' })
function openReturn() { Object.assign(returnModal, { open: true, comment: '', error: '' }) }
function confirmReturn() {
  if (returnModal.comment.trim().length === 0) { returnModal.error = 'Le commentaire est requis'; return }
  hiringRequestStore.returnItem(props.item.id, returnModal.comment.trim())
  returnModal.open = false
}

/* ── Modale Refuser ─────────────────────────────────────────── */
const rejectModal = reactive({ open: false, reason: '', error: '' })
function openReject() { Object.assign(rejectModal, { open: true, reason: '', error: '' }) }
function confirmReject() {
  if (rejectModal.reason.trim().length === 0) { rejectModal.error = 'Le motif est requis'; return }
  hiringRequestStore.reject(props.item.id, rejectModal.reason.trim())
  rejectModal.open = false
}
</script>

<template>
  <div class="flex items-center gap-1.5 flex-wrap">
    <button v-if="item.status === 'Draft'" :class="approveCls" @click="submitReq"><Send class="w-3.5 h-3.5" /> Soumettre</button>
    <template v-if="item.status === 'PendingApproval'">
      <button :class="approveCls" @click="approveReq"><Check class="w-3.5 h-3.5" /> Approuver</button>
      <button :class="returnCls" @click="openReturn"><Undo2 class="w-3.5 h-3.5" /> Retourner</button>
      <button :class="rejectCls" @click="openReject"><X class="w-3.5 h-3.5" /> Refuser</button>
    </template>
    <button v-if="CANCELLABLE.includes(item.status)" :class="cancelCls" @click="cancelReq"><Ban class="w-3.5 h-3.5" /> Annuler</button>
    <span v-if="!CANCELLABLE.includes(item.status)" class="text-xs text-muted-foreground italic">Aucune action disponible</span>
  </div>

  <!-- Modale Retourner -->
  <ModalShell :open="returnModal.open" title="Retourner la demande" max-width="max-w-[420px]" @close="returnModal.open = false">
    <label :class="cls.fieldLabel">Commentaire *</label>
    <textarea v-model="returnModal.comment" :class="cls.fieldTextarea" placeholder="Expliquez les corrections requises…" rows="4"></textarea>
    <div v-if="returnModal.error" :class="cls.fieldError">{{ returnModal.error }}</div>
    <template #footer>
      <button :class="cls.btnPrimary" @click="confirmReturn"><Undo2 class="w-4 h-4" /> Retourner</button>
      <button :class="cls.btnOutline" @click="returnModal.open = false">Annuler</button>
    </template>
  </ModalShell>

  <!-- Modale Refuser -->
  <ModalShell :open="rejectModal.open" title="Refuser la demande" max-width="max-w-[420px]" @close="rejectModal.open = false">
    <label :class="cls.fieldLabel">Motif du refus *</label>
    <textarea v-model="rejectModal.reason" :class="cls.fieldTextarea" placeholder="Indiquez le motif du refus…" rows="4"></textarea>
    <div v-if="rejectModal.error" :class="cls.fieldError">{{ rejectModal.error }}</div>
    <template #footer>
      <button :class="cls.btnPrimary" @click="confirmReject">Confirmer le refus</button>
      <button :class="cls.btnOutline" @click="rejectModal.open = false">Annuler</button>
    </template>
  </ModalShell>
</template>
