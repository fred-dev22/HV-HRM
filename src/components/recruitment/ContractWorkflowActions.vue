<script setup lang="ts">
/**
 * Actions d'une proposition d'embauche (workflow RH post-entretien, sans
 * circuit de validation interne) :
 *   Brouillon -> Envoyée au candidat -> Négociation* -> Acceptée | Refusée
 * "Acceptée" ne crée une période d'essai que si le RH la demande (case à
 * cocher, tout le monde n'en a pas une). Le recruteur est notifié de chaque
 * étape (côté backend).
 */
import { reactive } from 'vue'
import { Mail, CheckCircle2, XCircle, Ban, MessagesSquare } from 'lucide-vue-next'
import ModalShell from '../ui/ModalShell.vue'
import CreateModalShell from '../shared/CreateModalShell.vue'
import FormSection from '../ui/form-field/FormSection.vue'
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
/* ── Modale Accepter ────────────────────────────────────────── */
// Periode d'essai facultative, decochee par defaut : la creer par erreur pour
// quelqu'un qui n'en a pas bloquerait ensuite sa conversion en employe si elle
// etait annulee.
const acceptModal = reactive({ open: false, withTrial: false })
function openAccept() { Object.assign(acceptModal, { open: true, withTrial: false }) }
const { submitting: submittingAccept, guard: guardAccept } = useSubmitGuard()
async function confirmAccept() {
  await guardAccept(() => withToast(
    'Enregistrement…',
    () => contractStore.accept(props.item.id, { withTrial: acceptModal.withTrial }),
    () => 'Action impossible',
  ))
  acceptModal.open = false
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
  // Un <input type="number"> donne un nombre (pas une chaine) a v-model :
  // appeler .trim() dessus plantait sans message des qu'un montant etait saisi
  // et le tour n'etait jamais enregistre.
  const rawAmount = String(negoModal.amount ?? '').trim()
  const amount = rawAmount ? Number(rawAmount) : undefined
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
      <button :class="acceptCls" @click="openAccept"><CheckCircle2 class="w-3.5 h-3.5" /> Le candidat accepte</button>
      <button :class="refuseCls" @click="openRefuse"><XCircle class="w-3.5 h-3.5" /> Le candidat refuse</button>
    </template>
    <button v-if="CANCELLABLE.includes(item.status)" :class="cancelCls" @click="cancel"><Ban class="w-3.5 h-3.5" /> Annuler</button>
    <span
      v-if="['Accepted', 'Refused', 'Cancelled'].includes(item.status)"
      class="text-xs text-muted-foreground italic"
    >Aucune action disponible</span>
  </div>

  <!-- Modale Négocier : saisie a plusieurs champs, meme coque que les autres
       fiches de saisie de l'appli (bandeau, titre, boutons en haut). -->
  <CreateModalShell
    v-if="negoModal.open"
    title="Tour de négociation"
    banner-label="Négociation de la proposition"
    create-label="Enregistrer le tour"
    :is-saving="submittingNego"
    :save-error="negoModal.error"
    @close="negoModal.open = false"
    @create="confirmNego"
  >
    <template #form>
      <div class="flex-1 overflow-auto px-6 py-5">
        <div class="max-w-md mx-auto">
          <FormSection title="Échange">
            <div class="flex flex-col gap-3.5">
              <div :class="cls.field">
                <label :class="cls.fieldLabel">Proposition émise par <span class="text-danger">*</span></label>
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
                <label :class="cls.fieldLabel">Commentaire <span class="text-danger">*</span></label>
                <textarea v-model="negoModal.comment" :class="cls.fieldTextarea" placeholder="Détail de l'échange…" rows="4"></textarea>
              </div>
            </div>
          </FormSection>
        </div>
      </div>
    </template>
  </CreateModalShell>

  <!-- Modale Accepter -->
  <ModalShell :open="acceptModal.open" title="Le candidat accepte la proposition" max-width="max-w-[440px]" @close="acceptModal.open = false">
    <p class="text-[13px] text-foreground">Confirmez que le candidat accepte la proposition d'embauche.</p>
    <label class="flex items-start gap-2 text-[13px] text-foreground mt-3 cursor-pointer">
      <input v-model="acceptModal.withTrial" type="checkbox" class="mt-0.5" />
      <span>
        Prévoir une période d'essai (2 mois)
        <span class="block text-[11px] text-muted-foreground">
          Décochez si ce recrutement n'a pas de période d'essai : le candidat pourra être passé en employé directement.
        </span>
      </span>
    </label>
    <template #footer>
      <button :class="cls.btnPrimary" :disabled="submittingAccept" @click="confirmAccept">Confirmer l'acceptation</button>
      <button :class="cls.btnOutline" :disabled="submittingAccept" @click="acceptModal.open = false">Annuler</button>
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
