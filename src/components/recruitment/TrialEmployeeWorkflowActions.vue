<script setup lang="ts">
/**
 * Boutons d'action métier d'une période d'essai (Évaluer / Convertir en CDI /
 * Prolonger / Annuler) + modales associées. Réutilisé dans les actions
 * contextuelles de la liste (#row-actions), dans le volet d'aperçu
 * (#details-panel) ET dans la barre d'actions de la fiche
 * (TrialEmployeeCard), même pattern que MissionWorkflowActions.vue.
 */
import { reactive, ref, computed } from 'vue'
import { ClipboardCheck, UserCheck, CalendarClock, Ban } from 'lucide-vue-next'
import ModalShell from '../ui/ModalShell.vue'
import ConvertToEmployeeModal from './ConvertToEmployeeModal.vue'
import * as cls from '../../lib/formClasses'
import { confirmDialog } from '../../lib/confirm'
import { withToast } from '../../lib/withToast'
import { useSubmitGuard } from '../../lib/submitGuard'
import { useAuthStore } from '../../stores/auth'
import { useTrialStore, useContractStore } from '../../stores/recruitment'
import type { TrialEmployee } from '../../stores/recruitment'

const props = defineProps<{ item: TrialEmployee }>()
const trialStore = useTrialStore()
const contractStore = useContractStore()
const auth = useAuthStore()

// Contrat lie (necessaire a la modale de conversion). Charge la liste si vide.
const linkedContract = computed(() => contractStore.items.find((c) => c.id === props.item.contractId) ?? null)
const showConvert = ref(false)

const btn = 'px-2.5 py-[5px] rounded text-xs font-medium cursor-pointer whitespace-nowrap inline-flex items-center gap-1 transition-colors'
const approveCls = btn + ' bg-success-bg text-success hover:brightness-95'
const infoCls    = btn + ' bg-info-bg text-info hover:brightness-95'
const warningCls = btn + ' bg-warning-bg text-warning hover:brightness-95'
const cancelCls  = btn + ' bg-neutral-bg text-neutral hover:brightness-95'

const ACTIONABLE: TrialEmployee['status'][] = ['OnTrial', 'Extended']

async function convertTrial() {
  // Cas 1 : un employe reel est deja rattache (conversion du contrat faite) ->
  // simple confirmation OnTrial -> Active, corps vide.
  if (props.item.createdEmployeeId || linkedContract.value?.createdEmployeeId) {
    if (await confirmDialog("Confirmer cet employé à l'issue de la période d'essai ?", { danger: false })) {
      await withToast('Confirmation…', () => trialStore.convert(props.item.id), () => 'Action impossible')
    }
    return
  }
  // Cas 2 : aucun employe -> il faut creer le profil (permission requise).
  if (!auth.hasPermission('EMPLOYE_CREER')) {
    await confirmDialog(
      "Aucun profil employé n'est encore rattaché. La création d'un profil requiert la permission de créer un employé : demandez au RH.",
      { danger: false },
    )
    return
  }
  if (contractStore.items.length === 0) await contractStore.fetchAll()
  showConvert.value = true
}
async function cancelTrial() {
  if (await confirmDialog("Annuler cette période d'essai ?", { danger: false })) {
    await withToast('Annulation…', () => trialStore.cancel(props.item.id), () => 'Annulation impossible')
  }
}

/* ── Modale Évaluer ─────────────────────────────────────────── */
const evaluateModal = reactive({ open: false, score: 5, comment: '', error: '' })
function openEvaluate() {
  Object.assign(evaluateModal, { open: true, score: 5, comment: '', error: '' })
}
const { submitting: submittingEvaluate, guard: guardEvaluate } = useSubmitGuard()
async function confirmEvaluate() {
  if (evaluateModal.comment.trim().length === 0) { evaluateModal.error = 'Le commentaire est requis'; return }
  await guardEvaluate(() => withToast(
    'Enregistrement…',
    () => trialStore.evaluate(props.item.id, { score: evaluateModal.score, comment: evaluateModal.comment.trim() }),
    () => "Enregistrement impossible",
  ))
  evaluateModal.open = false
}

/* ── Modale Prolonger ───────────────────────────────────────── */
const extendModal = reactive({ open: false, newEndDate: '', error: '' })
function openExtend() {
  Object.assign(extendModal, { open: true, newEndDate: props.item.trialEndDate, error: '' })
}
const { submitting: submittingExtend, guard: guardExtend } = useSubmitGuard()
async function confirmExtend() {
  if (!extendModal.newEndDate) { extendModal.error = 'La nouvelle date de fin est requise'; return }
  await guardExtend(() => withToast('Prolongation…', () => trialStore.extend(props.item.id, extendModal.newEndDate), () => 'Prolongation impossible'))
  extendModal.open = false
}
</script>

<template>
  <div class="flex items-center gap-1.5 flex-wrap">
    <template v-if="ACTIONABLE.includes(item.status)">
      <button :class="infoCls" @click="openEvaluate"><ClipboardCheck class="w-3.5 h-3.5" /> Évaluer</button>
      <button :class="approveCls" @click="convertTrial"><UserCheck class="w-3.5 h-3.5" /> Convertir en CDI</button>
      <button :class="warningCls" @click="openExtend"><CalendarClock class="w-3.5 h-3.5" /> Prolonger</button>
      <button :class="cancelCls" @click="cancelTrial"><Ban class="w-3.5 h-3.5" /> Annuler</button>
    </template>
    <span v-else class="text-xs text-muted-foreground italic">Aucune action disponible</span>
  </div>

  <!-- Modale Évaluer -->
  <ModalShell :open="evaluateModal.open" title="Évaluer la période d'essai" max-width="max-w-[420px]" @close="evaluateModal.open = false">
    <div :class="cls.field">
      <label :class="cls.fieldLabel">Note *</label>
      <select v-model.number="evaluateModal.score" :class="cls.fieldSelect">
        <option v-for="n in 5" :key="n" :value="n">{{ n }} / 5</option>
      </select>
    </div>
    <div :class="cls.field">
      <label :class="cls.fieldLabel">Commentaire *</label>
      <textarea v-model="evaluateModal.comment" :class="cls.fieldTextarea" placeholder="Impressions, points forts, réserves…" rows="4"></textarea>
    </div>
    <div v-if="evaluateModal.error" :class="cls.fieldError">{{ evaluateModal.error }}</div>
    <template #footer>
      <button :class="cls.btnPrimary" :disabled="submittingEvaluate" @click="confirmEvaluate"><ClipboardCheck class="w-4 h-4" /> Enregistrer l'évaluation</button>
      <button :class="cls.btnOutline" :disabled="submittingEvaluate" @click="evaluateModal.open = false">Annuler</button>
    </template>
  </ModalShell>

  <!-- Modale Prolonger -->
  <ModalShell :open="extendModal.open" title="Prolonger la période d'essai" max-width="max-w-[420px]" @close="extendModal.open = false">
    <div :class="cls.field">
      <label :class="cls.fieldLabel">Nouvelle date de fin *</label>
      <input type="date" v-model="extendModal.newEndDate" :class="cls.fieldInput" />
    </div>
    <div v-if="extendModal.error" :class="cls.fieldError">{{ extendModal.error }}</div>
    <template #footer>
      <button :class="cls.btnPrimary" :disabled="submittingExtend" @click="confirmExtend"><CalendarClock class="w-4 h-4" /> Prolonger</button>
      <button :class="cls.btnOutline" :disabled="submittingExtend" @click="extendModal.open = false">Annuler</button>
    </template>
  </ModalShell>

  <!-- Conversion candidat -> employe a la confirmation -->
  <ConvertToEmployeeModal
    v-if="linkedContract"
    :open="showConvert"
    :contract="linkedContract"
    mode="trial"
    :trial-id="item.id"
    @close="showConvert = false"
    @done="showConvert = false"
  />
</template>
