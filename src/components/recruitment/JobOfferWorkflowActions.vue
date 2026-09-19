<script setup lang="ts">
/**
 * Actions d'une offre d'emploi. Aucun circuit de validation (décision client
 * du 05/09) : Brouillon -> Publiée (une seule fois) -> Clôturée. "Si on veut
 * publier, on publie une fois." Le coût de campagne est demandé à la clôture
 * (sert au coût par recrutement, page Pipeline).
 */
import { reactive } from 'vue'
import { Rocket, Archive, Trash2 } from 'lucide-vue-next'
import ModalShell from '../ui/ModalShell.vue'
import * as cls from '../../lib/formClasses'
import { confirmDialog } from '../../lib/confirm'
import { withToast } from '../../lib/withToast'
import { useSubmitGuard } from '../../lib/submitGuard'
import { useJobOfferStore } from '../../stores/recruitment'
import type { JobOffer } from '../../stores/recruitment'

const props = defineProps<{ item: JobOffer }>()
const jobOfferStore = useJobOfferStore()

const btn = 'px-2.5 py-[5px] rounded text-xs font-medium cursor-pointer whitespace-nowrap inline-flex items-center gap-1 transition-colors'
const publishCls = btn + ' bg-success-bg text-success hover:brightness-95'
const closeCls   = btn + ' bg-neutral-bg text-neutral hover:brightness-95'
const deleteCls  = btn + ' bg-danger-bg text-danger hover:brightness-95'

async function publishOffer() {
  if (await confirmDialog('Publier cette offre ? Elle sera visible sur le portail carrière.', { danger: false })) {
    await withToast('Publication…', () => jobOfferStore.publish(props.item.id), () => 'Publication impossible')
  }
}
async function removeOffer() {
  if (await confirmDialog('Supprimer ce brouillon d\'offre ?')) {
    await withToast('Suppression…', () => jobOfferStore.remove(props.item.id), () => 'Suppression impossible')
  }
}

/* ── Modale Clôturer ─────────────────────────────────────────── */
const closeModal = reactive({ open: false, cost: '' as string })
function openClose() { Object.assign(closeModal, { open: true, cost: '' }) }
const { submitting: submittingClose, guard: guardClose } = useSubmitGuard()
async function confirmClose() {
  // Un <input type="number"> donne un nombre (pas une chaine) a v-model.
  const trimmed = String(closeModal.cost ?? '').trim()
  const cost = trimmed ? Number(trimmed) : undefined
  await guardClose(() => withToast(
    'Clôture…',
    () => jobOfferStore.close(props.item.id, cost !== undefined && !Number.isNaN(cost) ? cost : undefined),
    () => 'Clôture impossible',
  ))
  closeModal.open = false
}
</script>

<template>
  <div class="flex items-center gap-1.5 flex-wrap">
    <button v-if="item.status === 'Draft'" :class="publishCls" @click="publishOffer"><Rocket class="w-3.5 h-3.5" /> Publier</button>
    <button v-if="item.status === 'Published'" :class="closeCls" @click="openClose"><Archive class="w-3.5 h-3.5" /> Clôturer</button>
    <button v-if="item.status === 'Draft'" :class="deleteCls" @click="removeOffer"><Trash2 class="w-3.5 h-3.5" /> Supprimer</button>
    <span v-if="item.status === 'Closed'" class="text-xs text-muted-foreground italic">Aucune action disponible</span>
  </div>

  <!-- Modale Clôturer -->
  <ModalShell :open="closeModal.open" title="Clôturer l'offre d'emploi" max-width="max-w-[420px]" @close="closeModal.open = false">
    <label :class="cls.fieldLabel">Coût du recrutement <span :class="cls.fieldOptional">(optionnel, en MGA)</span></label>
    <input type="number" min="0" v-model="closeModal.cost" :class="cls.fieldInput" placeholder="ex : 450000" />
    <p class="text-[11px] text-muted-foreground mt-1">Annonces, cabinet de recrutement, etc. Sert au calcul du coût moyen par recrutement (page Pipeline).</p>
    <template #footer>
      <button :class="cls.btnPrimary" :disabled="submittingClose" @click="confirmClose">Confirmer la clôture</button>
      <button :class="cls.btnOutline" :disabled="submittingClose" @click="closeModal.open = false">Annuler</button>
    </template>
  </ModalShell>
</template>
