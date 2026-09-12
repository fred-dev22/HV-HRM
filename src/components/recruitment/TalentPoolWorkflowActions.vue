<script setup lang="ts">
/**
 * Boutons d'action du vivier de talents (Évaluer / Fermer/Rouvrir / Retirer).
 * Réutilisé dans le volet d'aperçu de la liste ET dans la barre d'actions de
 * la fiche (TalentPoolCard). Calqué sur MissionWorkflowActions.vue.
 *
 * TalentPoolEntry n'a pas de workflow d'approbation, mais a un statut simple
 * ouvert/fermé (voir types.ts, "Potentiels ouverts" dans les specs client) et
 * un historique d'évaluations, en plus de l'action de suppression.
 */
import { reactive } from 'vue'
import { Trash2, ClipboardCheck, Lock, LockOpen } from 'lucide-vue-next'
import ModalShell from '../ui/ModalShell.vue'
import * as cls from '../../lib/formClasses'
import { confirmDialog } from '../../lib/confirm'
import { withToast } from '../../lib/withToast'
import { useSubmitGuard } from '../../lib/submitGuard'
import { useTalentPoolStore } from '../../stores/recruitment'
import type { TalentPoolEntry } from '../../stores/recruitment'

const props = defineProps<{ item: TalentPoolEntry }>()
const emit = defineEmits<{ removed: [] }>()
const talentPoolStore = useTalentPoolStore()

const btn = 'px-2.5 py-[5px] rounded text-xs font-medium cursor-pointer whitespace-nowrap inline-flex items-center gap-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
const removeCls = btn + ' bg-danger-bg text-danger hover:brightness-95'
const infoCls = btn + ' bg-info-bg text-info hover:brightness-95'
const neutralCls = btn + ' bg-neutral-bg text-neutral hover:brightness-95'

async function remove() {
  if (await confirmDialog('Retirer ce profil du vivier de talents ?')) {
    await withToast('Retrait…', () => talentPoolStore.remove(props.item.id), () => 'Retrait impossible')
    emit('removed')
  }
}
const { submitting: togglingStatus, guard: guardToggleStatus } = useSubmitGuard()
async function toggleStatus() {
  const action = props.item.status === 'Open' ? () => talentPoolStore.close(props.item.id) : () => talentPoolStore.reopen(props.item.id)
  await guardToggleStatus(() => withToast('Mise à jour…', action, () => 'Action impossible'))
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
    () => talentPoolStore.addEvaluation(props.item.id, { score: evaluateModal.score, comment: evaluateModal.comment.trim() }),
    () => "Enregistrement impossible",
  ))
  evaluateModal.open = false
}
</script>

<template>
  <div class="flex items-center gap-1.5 flex-wrap">
    <button :class="infoCls" @click="openEvaluate"><ClipboardCheck class="w-3.5 h-3.5" /> Évaluer</button>
    <button v-if="item.status === 'Open'" :class="neutralCls" :disabled="togglingStatus" @click="toggleStatus"><Lock class="w-3.5 h-3.5" /> Fermer</button>
    <button v-else :class="infoCls" :disabled="togglingStatus" @click="toggleStatus"><LockOpen class="w-3.5 h-3.5" /> Rouvrir</button>
    <button :class="removeCls" @click="remove">
      <Trash2 class="w-3.5 h-3.5" /> Retirer du vivier
    </button>
  </div>

  <!-- Modale Évaluer -->
  <ModalShell :open="evaluateModal.open" title="Évaluer ce profil" max-width="max-w-[420px]" @close="evaluateModal.open = false">
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
</template>
