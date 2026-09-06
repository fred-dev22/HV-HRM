<script setup lang="ts">
/**
 * Boutons d'action métier d'une offre d'emploi (Soumettre / Approuver /
 * Refuser / Publier / Clôturer) + modale de refus. Réutilisé dans le volet
 * d'aperçu de la liste ET dans la barre d'actions de la fiche
 * (JobOfferCard). Calqué sur MissionWorkflowActions.vue. Pas de bouton
 * Retourner (JobOfferStatus n'a pas d'état Returned) ni Annuler (pas
 * d'action cancel exposée par useJobOfferStore).
 */
import { reactive } from 'vue'
import { Send, Check, X, Rocket, Archive } from 'lucide-vue-next'
import ModalShell from '../ui/ModalShell.vue'
import * as cls from '../../lib/formClasses'
import { useJobOfferStore } from '../../stores/recruitment'
import type { JobOffer } from '../../stores/recruitment'

const props = defineProps<{ item: JobOffer }>()
const jobOfferStore = useJobOfferStore()

const btn = 'px-2.5 py-[5px] rounded text-xs font-medium cursor-pointer whitespace-nowrap inline-flex items-center gap-1 transition-colors'
const approveCls = btn + ' bg-success-bg text-success hover:brightness-95'
const rejectCls  = btn + ' bg-danger-bg text-danger hover:brightness-95'
const cancelCls  = btn + ' bg-neutral-bg text-neutral hover:brightness-95'

function submitOffer() { jobOfferStore.submit(props.item.id) }
function approveOffer() { jobOfferStore.approve(props.item.id) }
function publishOffer() { jobOfferStore.publish(props.item.id) }

/* ── Modale Clôturer ────────────────────────────────────────────
   Le coût de la campagne (annonces, cabinet…) est demandé ici, au moment où
   il est enfin connu — voir JobOffer.recruitmentCost et PipelineView.vue
   ("coût par recrutement"). Optionnel : on ne bloque pas la clôture si le
   recruteur ne l'a pas encore. */
const closeModal = reactive({ open: false, cost: '' as string })
function openClose() { Object.assign(closeModal, { open: true, cost: '' }) }
function confirmClose() {
  const trimmed = closeModal.cost.trim()
  const cost = trimmed ? Number(trimmed) : undefined
  jobOfferStore.close(props.item.id, cost !== undefined && !Number.isNaN(cost) ? cost : undefined)
  closeModal.open = false
}

/* ── Modale Refuser ─────────────────────────────────────────── */
const rejectModal = reactive({ open: false, reason: '', error: '' })
function openReject() { Object.assign(rejectModal, { open: true, reason: '', error: '' }) }
function confirmReject() {
  if (rejectModal.reason.trim().length === 0) { rejectModal.error = 'Le motif est requis'; return }
  jobOfferStore.reject(props.item.id, rejectModal.reason.trim())
  rejectModal.open = false
}
</script>

<template>
  <div class="flex items-center gap-1.5 flex-wrap">
    <button v-if="item.status === 'Draft'" :class="approveCls" @click="submitOffer"><Send class="w-3.5 h-3.5" /> Soumettre</button>
    <template v-if="item.status === 'PendingApproval'">
      <button :class="approveCls" @click="approveOffer"><Check class="w-3.5 h-3.5" /> Approuver</button>
      <button :class="rejectCls" @click="openReject"><X class="w-3.5 h-3.5" /> Refuser</button>
    </template>
    <button v-if="item.status === 'Approved'" :class="approveCls" @click="publishOffer"><Rocket class="w-3.5 h-3.5" /> Publier</button>
    <button v-if="item.status === 'Published'" :class="cancelCls" @click="openClose"><Archive class="w-3.5 h-3.5" /> Clôturer</button>
    <span v-if="!['Draft', 'PendingApproval', 'Approved', 'Published'].includes(item.status)" class="text-xs text-muted-foreground italic">Aucune action disponible</span>
  </div>

  <!-- Modale Refuser -->
  <ModalShell :open="rejectModal.open" title="Refuser l'offre" max-width="max-w-[420px]" @close="rejectModal.open = false">
    <label :class="cls.fieldLabel">Motif du refus *</label>
    <textarea v-model="rejectModal.reason" :class="cls.fieldTextarea" placeholder="Indiquez le motif du refus…" rows="4"></textarea>
    <div v-if="rejectModal.error" :class="cls.fieldError">{{ rejectModal.error }}</div>
    <template #footer>
      <button :class="cls.btnPrimary" @click="confirmReject">Confirmer le refus</button>
      <button :class="cls.btnOutline" @click="rejectModal.open = false">Annuler</button>
    </template>
  </ModalShell>

  <!-- Modale Clôturer -->
  <ModalShell :open="closeModal.open" title="Clôturer l'offre d'emploi" max-width="max-w-[420px]" @close="closeModal.open = false">
    <label :class="cls.fieldLabel">Coût du recrutement <span :class="cls.fieldOptional">(optionnel, en MGA)</span></label>
    <input type="number" min="0" v-model="closeModal.cost" :class="cls.fieldInput" placeholder="ex : 450000" />
    <p class="text-[11px] text-muted-foreground mt-1">Annonces, cabinet de recrutement, etc. Sert au calcul du coût moyen par recrutement (page Pipeline).</p>
    <template #footer>
      <button :class="cls.btnPrimary" @click="confirmClose">Confirmer la clôture</button>
      <button :class="cls.btnOutline" @click="closeModal.open = false">Annuler</button>
    </template>
  </ModalShell>
</template>
