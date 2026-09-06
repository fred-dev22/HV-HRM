<script setup lang="ts">
/**
 * Boutons d'action métier d'un entretien (Marquer comme effectué / Évaluer /
 * Annuler) + modale d'évaluation (note, commentaire, évaluateur). Réutilisé
 * dans le volet d'aperçu de la liste ET dans la barre d'actions de la fiche
 * (InterviewCard). Calqué sur MissionWorkflowActions.vue / JobOfferWorkflowActions.vue.
 */
import { reactive, computed } from 'vue'
import { CheckCircle2, Star, Ban } from 'lucide-vue-next'
import ModalShell from '../ui/ModalShell.vue'
import * as cls from '../../lib/formClasses'
import { confirmDialog } from '../../lib/confirm'
import { useInterviewStore } from '../../stores/recruitment'
import type { Interview } from '../../stores/recruitment'
import { useAuthStore } from '../../stores/auth'

const props = defineProps<{ item: Interview }>()
const interviewStore = useInterviewStore()
const auth = useAuthStore()

const btn = 'px-2.5 py-[5px] rounded text-xs font-medium cursor-pointer whitespace-nowrap inline-flex items-center gap-1 transition-colors'
const doneCls     = btn + ' bg-success-bg text-success hover:brightness-95'
const evaluateCls = btn + ' bg-info-bg text-info hover:brightness-95'
const cancelCls   = btn + ' bg-neutral-bg text-neutral hover:brightness-95'

function markDoneItem() { interviewStore.markDone(props.item.id) }

async function cancelItem() {
  if (await confirmDialog('Annuler cet entretien ?')) interviewStore.cancel(props.item.id)
}

/* ── Modale Évaluer ─────────────────────────────────────────────────
   Grille d'évaluation standardisée optionnelle (voir cartographie client,
   "Entretiens" → "Grilles d'évaluation standardisées") : la note globale
   devient la moyenne des critères choisis, sinon on garde la note libre
   /5 d'avant. */
const evaluateModal = reactive({
  open: false, templateId: '', score: 5, comment: '', interviewerName: '',
  criteriaScores: [] as { label: string; score: number }[], error: '',
})
function openEvaluate() {
  Object.assign(evaluateModal, { open: true, templateId: '', score: 5, comment: '', interviewerName: auth.user?.name ?? '', criteriaScores: [], error: '' })
}
function onTemplateChange() {
  const tpl = interviewStore.evaluationTemplates.find(t => t.id === evaluateModal.templateId)
  evaluateModal.criteriaScores = tpl ? tpl.criteria.map(label => ({ label, score: 3 })) : []
}
const averageScore = computed(() => {
  if (evaluateModal.criteriaScores.length === 0) return evaluateModal.score
  const sum = evaluateModal.criteriaScores.reduce((s, c) => s + c.score, 0)
  return Math.round((sum / evaluateModal.criteriaScores.length) * 10) / 10
})
function confirmEvaluate() {
  if (evaluateModal.comment.trim().length === 0) { evaluateModal.error = 'Le commentaire est requis'; return }
  if (!evaluateModal.interviewerName.trim()) { evaluateModal.error = "Le nom de l'évaluateur est requis"; return }
  const tpl = interviewStore.evaluationTemplates.find(t => t.id === evaluateModal.templateId)
  interviewStore.evaluate(props.item.id, {
    score: tpl ? averageScore.value : evaluateModal.score,
    comment: evaluateModal.comment.trim(),
    interviewerName: evaluateModal.interviewerName.trim(),
    templateName: tpl?.name,
    criteriaScores: tpl ? evaluateModal.criteriaScores : undefined,
  })
  evaluateModal.open = false
}
</script>

<template>
  <div class="flex items-center gap-1.5 flex-wrap">
    <template v-if="item.status === 'Scheduled'">
      <button :class="doneCls" @click="markDoneItem"><CheckCircle2 class="w-3.5 h-3.5" /> Marquer comme effectué</button>
      <button :class="evaluateCls" @click="openEvaluate"><Star class="w-3.5 h-3.5" /> Évaluer</button>
      <button :class="cancelCls" @click="cancelItem"><Ban class="w-3.5 h-3.5" /> Annuler</button>
    </template>
    <span v-else class="text-xs text-muted-foreground italic">Aucune action disponible</span>
  </div>

  <!-- Modale Évaluer -->
  <ModalShell :open="evaluateModal.open" title="Évaluer l'entretien" max-width="max-w-[460px]" @close="evaluateModal.open = false">
    <div :class="cls.field">
      <label :class="cls.fieldLabel">Grille d'évaluation <span :class="cls.fieldOptional">(optionnel)</span></label>
      <select v-model="evaluateModal.templateId" :class="cls.fieldSelect" @change="onTemplateChange">
        <option value="">Aucune (note libre)</option>
        <option v-for="t in interviewStore.evaluationTemplates" :key="t.id" :value="t.id">{{ t.name }}</option>
      </select>
    </div>

    <div v-if="evaluateModal.criteriaScores.length > 0" class="flex flex-col gap-2 mt-2">
      <div v-for="c in evaluateModal.criteriaScores" :key="c.label" :class="cls.field">
        <label :class="cls.fieldLabel">{{ c.label }}</label>
        <select v-model.number="c.score" :class="cls.fieldSelect">
          <option v-for="n in 5" :key="n" :value="n">{{ n }} / 5</option>
        </select>
      </div>
      <p class="text-[11px] text-muted-foreground">Note globale calculée automatiquement : <strong class="text-foreground">{{ averageScore }} / 5</strong></p>
    </div>
    <div v-else :class="cls.field">
      <label :class="cls.fieldLabel">Note *</label>
      <select v-model.number="evaluateModal.score" :class="cls.fieldSelect">
        <option v-for="n in 5" :key="n" :value="n">{{ n }} / 5</option>
      </select>
    </div>

    <div :class="cls.field">
      <label :class="cls.fieldLabel">Commentaire *</label>
      <textarea v-model="evaluateModal.comment" :class="cls.fieldTextarea" placeholder="Impressions, points forts, réserves…" rows="4"></textarea>
    </div>
    <div :class="cls.field">
      <label :class="cls.fieldLabel">Évaluateur *</label>
      <input v-model="evaluateModal.interviewerName" :class="cls.fieldInput" placeholder="Nom de l'évaluateur" />
    </div>
    <div v-if="evaluateModal.error" :class="cls.fieldError">{{ evaluateModal.error }}</div>
    <template #footer>
      <button :class="cls.btnPrimary" @click="confirmEvaluate"><Star class="w-4 h-4" /> Enregistrer l'évaluation</button>
      <button :class="cls.btnOutline" @click="evaluateModal.open = false">Annuler</button>
    </template>
  </ModalShell>
</template>
