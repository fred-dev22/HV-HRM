<script setup lang="ts">
/**
 * Actions d'une proposition d'embauche (workflow RH post-entretien, sans
 * circuit de validation interne) :
 *   Brouillon -> Envoyée au candidat -> Négociation* -> Acceptée | Refusée
 * "Acceptée" crée automatiquement la période d'essai. Le recruteur est
 * notifié de chaque étape (côté backend).
 */
import { reactive } from 'vue'
import { Mail, CheckCircle2, XCircle, Ban, MessagesSquare } from 'lucide-vue-next'
import ModalShell from '../ui/ModalShell.vue'
import * as cls from '../../lib/formClasses'
import { confirmDialog } from '../../lib/confirm'
import { withToast } from '../../lib/withToast'
import { useSubmitGuard } from '../../lib/submitGuard'
import { useContractStore } from '../../stores/recruitment'
import type { Contract } from '../../stores/recruitment'

const props = defineProps<{ item: Contract }>()
const contractStore = useContractStore()

const btn = 'px-2.5 py-[5px] rounded text-xs font-medium cursor-pointer whitespace-nowrap inline-flex items-center gap-1 transition-colors'
const sendCls    = btn + ' bg-info-bg text-info hover:brightness-95'
const acceptCls  = btn + ' bg-success-bg text-success hover:brightness-95'
const refuseCls  = btn + ' bg-danger-bg text-danger hover:brightness-95'
const negoCls    = btn + ' bg-warning-bg text-warning hover:brightness-95'
const cancelCls  = btn + ' bg-neutral-bg text-neutral hover:brightness-95'

const SENDABLE: Contract['status'][] = ['Draft', 'Negotiating']
const NEGOTIABLE: Contract['status'][] = ['Sent', 'Negotiating']
const CANCELLABLE: Contract['status'][] = ['Draft', 'Sent', 'Negotiating']

async function send() {
  const label = props.item.status === 'Draft' ? 'Envoyer cette proposition au candidat ?' : 'Renvoyer la proposition au candidat ?'
  if (await confirmDialog(label, { danger: false })) {
    await withToast('Envoi…', () => contractStore.send(props.item.id), () => 'Envoi impossible')
  }
}
async function accept() {
  if (await confirmDialog('Le candidat accepte cette proposition ? Une période d\'essai sera ouverte.', { danger: false })) {
    await withToast('Enregistrement…', () => contractStore.accept(props.item.id), () => 'Action impossible')
  }
}
async function cancel() {
  if (await confirmDialog('Annuler cette proposition ?', { danger: false })) {
    await withToast('Annulation…', () => contractStore.cancel(props.item.id), () => 'Annulation impossible')
  }
}

/* ── Modale Négocier ────────────────────────────────────────── */
const negoModal = reactive({ open: false, fromParty: 'Candidate' as 'HR' | 'Candidate', amount: '' as string, comment: '', error: '' })
function openNego() { Object.assign(negoModal, { open: true, fromParty: 'Candidate', amount: '', comment: '', error: '' }) }
const { submitting: submittingNego, guard: guardNego } = useSubmitGuard()
async function confirmNego() {
  if (negoModal.comment.trim().length === 0) { negoModal.error = 'Le commentaire est requis'; return }
  const amount = negoModal.amount.trim() ? Number(negoModal.amount) : undefined
  await guardNego(() => withToast(
    'Enregistrement…',
    () => contractStore.negotiate(props.item.id, {
      fromParty: negoModal.fromParty,
      amount: amount !== undefined && !Number.isNaN(amount) ? amount : undefined,
      comment: negoModal.comment.trim(),
    }),
    () => "Enregistrement de la négociation impossible",
  ))
  negoModal.open = false
}

/* ── Modale Refuser ─────────────────────────────────────────── */
const refuseModal = reactive({ open: false, reason: '', error: '' })
function openRefuse() { Object.assign(refuseModal, { open: true, reason: '', error: '' }) }
const { submitting: submittingRefuse, guard: guardRefuse } = useSubmitGuard()
async function confirmRefuse() {
  if (refuseModal.reason.trim().length === 0) { refuseModal.error = 'Le motif est requis'; return }
  await guardRefuse(() => withToast('Enregistrement…', () => contractStore.refuse(props.item.id, refuseModal.reason.trim()), () => 'Action impossible'))
  refuseModal.open = false
}
</script>

<template>
  <div class="flex items-center gap-1.5 flex-wrap">
    <button v-if="SENDABLE.includes(item.status)" :class="sendCls" @click="send">
      <Mail class="w-3.5 h-3.5" /> {{ item.status === 'Draft' ? 'Envoyer au candidat' : 'Renvoyer' }}
    </button>
    <template v-if="NEGOTIABLE.includes(item.status)">
      <button :class="negoCls" @click="openNego"><MessagesSquare class="w-3.5 h-3.5" /> Négocier</button>
      <button :class="acceptCls" @click="accept"><CheckCircle2 class="w-3.5 h-3.5" /> Le candidat accepte</button>
      <button :class="refuseCls" @click="openRefuse"><XCircle class="w-3.5 h-3.5" /> Le candidat refuse</button>
    </template>
    <button v-if="CANCELLABLE.includes(item.status)" :class="cancelCls" @click="cancel"><Ban class="w-3.5 h-3.5" /> Annuler</button>
    <span
      v-if="['Accepted', 'Refused', 'Cancelled'].includes(item.status)"
      class="text-xs text-muted-foreground italic"
    >Aucune action disponible</span>
  </div>

  <!-- Modale Négocier -->
  <ModalShell :open="negoModal.open" title="Tour de négociation" max-width="max-w-[440px]" @close="negoModal.open = false">
    <div :class="cls.field">
      <label :class="cls.fieldLabel">Proposition émise par *</label>
      <select v-model="negoModal.fromParty" :class="cls.fieldSelect">
        <option value="Candidate">Le candidat</option>
        <option value="HR">Le RH</option>
      </select>
    </div>
    <div :class="cls.field">
      <label :class="cls.fieldLabel">Montant proposé <span :class="cls.fieldOptional">(optionnel, en MGA)</span></label>
      <input type="number" min="0" v-model="negoModal.amount" :class="cls.fieldInput" placeholder="ex : 1200000" />
      <p class="text-[11px] text-muted-foreground mt-1">Si le RH propose un montant, il remplace le salaire de la proposition.</p>
    </div>
    <div :class="cls.field">
      <label :class="cls.fieldLabel">Commentaire *</label>
      <textarea v-model="negoModal.comment" :class="cls.fieldTextarea" placeholder="Détail de l'échange…" rows="3"></textarea>
    </div>
    <div v-if="negoModal.error" :class="cls.fieldError">{{ negoModal.error }}</div>
    <template #footer>
      <button :class="cls.btnPrimary" :disabled="submittingNego" @click="confirmNego">Enregistrer le tour</button>
      <button :class="cls.btnOutline" :disabled="submittingNego" @click="negoModal.open = false">Annuler</button>
    </template>
  </ModalShell>

  <!-- Modale Refuser -->
  <ModalShell :open="refuseModal.open" title="Le candidat refuse" max-width="max-w-[420px]" @close="refuseModal.open = false">
    <label :class="cls.fieldLabel">Motif du refus *</label>
    <textarea v-model="refuseModal.reason" :class="cls.fieldTextarea" placeholder="Motif communiqué par le candidat…" rows="4"></textarea>
    <div v-if="refuseModal.error" :class="cls.fieldError">{{ refuseModal.error }}</div>
    <template #footer>
      <button :class="cls.btnPrimary" :disabled="submittingRefuse" @click="confirmRefuse">Confirmer</button>
      <button :class="cls.btnOutline" :disabled="submittingRefuse" @click="refuseModal.open = false">Annuler</button>
    </template>
  </ModalShell>
</template>
