<script setup lang="ts">
/**
 * Fiche d'une grille d'évaluation d'entretien (lecture / édition) — sur
 * CardModalShell, même pattern que ContractTemplateCard.vue (édition inline,
 * pas de modale à part) : la création reste sur InterviewEvalTemplatesView
 * (CreateModalShell), mais la consultation/modification d'une grille
 * existante s'ouvre ici plutôt que dans la petite ModalShell partagée
 * d'avant (demande du 11/09 : rester uniforme avec le reste du module).
 */
import { ref, computed, watch } from 'vue'
import { Trash2 } from 'lucide-vue-next'
import CardModalShell from '../shared/CardModalShell.vue'
import FormSection from '../ui/form-field/FormSection.vue'
import * as cls from '../../lib/formClasses'
import { confirmDialog } from '../../lib/confirm'
import { withToast } from '../../lib/withToast'
import { useSubmitGuard } from '../../lib/submitGuard'
import { getApiErrorMessage } from '../../lib/api'
import { useEvalTemplateStore } from '../../stores/recruitment'
import type { InterviewEvaluationTemplate } from '../../stores/recruitment'

const props = defineProps<{
  /** Grilles de la liste courante, pour la navigation N° */
  items: InterviewEvaluationTemplate[]
  /** Grille affichée */
  itemId: string
}>()

const emit = defineEmits<{ close: [] }>()

const store = useEvalTemplateStore()

const currentId = ref(props.itemId)
watch(() => props.itemId, (v) => { currentId.value = v; isEditMode.value = false })

const current = computed<InterviewEvaluationTemplate | null>(() => props.items.find(t => t.id === currentId.value) ?? null)
const currentIndex = computed(() => props.items.findIndex(t => t.id === currentId.value))
const hasPrev = computed(() => currentIndex.value > 0)
const hasNext = computed(() => currentIndex.value >= 0 && currentIndex.value < props.items.length - 1)

// Numérotation par position (1, 2, 3…) : une grille n'a pas de code propre,
// même limite que ContractTemplateCard.vue / InterviewCard.vue.
const sidebarItems = computed(() => props.items.map((t, i) => ({ no: String(i + 1), label: t.name })))
const currentNo = computed(() => (currentIndex.value >= 0 ? String(currentIndex.value + 1) : null))

function goPrev() { if (hasPrev.value) { currentId.value = props.items[currentIndex.value - 1]!.id; isEditMode.value = false } }
function goNext() { if (hasNext.value) { currentId.value = props.items[currentIndex.value + 1]!.id; isEditMode.value = false } }
function selectSidebar(no: string) {
  const t = props.items[Number(no) - 1]
  if (t) { currentId.value = t.id; isEditMode.value = false }
}

/* ── Édition ────────────────────────────────────────────────── */
const isEditMode = ref(false)
const saveError = ref('')
const form = ref({ name: '', criteriaText: '' })

function enterEdit() {
  if (!current.value) return
  form.value = { name: current.value.name, criteriaText: current.value.criteria.join('\n') }
  saveError.value = ''
  isEditMode.value = true
}
function cancelEdit() { isEditMode.value = false; saveError.value = '' }

const { submitting, guard } = useSubmitGuard()
async function save() {
  if (!current.value) return
  const name = form.value.name.trim()
  const criteria = form.value.criteriaText.split('\n').map(c => c.trim()).filter(Boolean)
  if (!name) { saveError.value = 'Le nom est requis'; return }
  if (criteria.length === 0) { saveError.value = 'Ajoutez au moins un critère'; return }
  try {
    await guard(() => withToast('Enregistrement...', () => store.update(current.value!.id, { name, criteria }), () => 'Enregistrement impossible'))
    isEditMode.value = false
  } catch (e) {
    saveError.value = getApiErrorMessage(e, 'Enregistrement impossible')
  }
}

/* ── Suppression ────────────────────────────────────────────── */
async function remove() {
  if (!current.value || current.value.jobOffersCount) return
  if (await confirmDialog(`Supprimer la grille « ${current.value.name} » ?`)) {
    await withToast('Suppression…', () => store.remove(current.value!.id), () => 'Suppression impossible')
    emit('close')
  }
}

const pageTitle = computed(() => current.value?.name ?? '')
const readBox = 'text-[13px] text-foreground bg-background border border-border rounded-md px-2.5 h-[38px] flex items-center'
</script>

<template>
  <CardModalShell
    v-if="current"
    :page-title="pageTitle"
    banner-label="Grille d'évaluation d'entretien"
    :is-edit-mode="isEditMode"
    :is-saving="submitting"
    :show-title-new-button="false"
    :sidebar-items="sidebarItems"
    :current-no="currentNo"
    :has-prev="hasPrev"
    :has-next="hasNext"
    :has-unsaved-changes="isEditMode"
    :save-error="saveError"
    @close="emit('close')"
    @enter-edit="enterEdit"
    @cancel-edit="cancelEdit"
    @save="save"
    @go-prev="goPrev"
    @go-next="goNext"
    @select-sidebar="selectSidebar"
    @clear-save-error="saveError = ''"
  >
    <template #title-badges>
      <span class="text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap bg-primary/10 text-primary">
        {{ current.criteria.length }} critère(s)
      </span>
    </template>

    <template #action-buttons>
      <button
        v-if="!isEditMode"
        class="px-2.5 py-[5px] rounded text-xs font-medium cursor-pointer whitespace-nowrap inline-flex items-center gap-1 transition-colors bg-danger-bg text-danger hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="!!current.jobOffersCount"
        @click="remove"
      >
        <Trash2 class="w-3.5 h-3.5" /> Supprimer
      </button>
      <p v-if="current.jobOffersCount" class="text-[11px] text-muted-foreground">Rattachée à {{ current.jobOffersCount }} offre(s) : suppression impossible.</p>
    </template>

    <template #form>
      <div class="px-6 py-5 max-w-4xl">
        <FormSection title="Grille">
          <div :class="cls.field">
            <label :class="cls.fieldLabel">Nom de la grille</label>
            <input v-if="isEditMode" v-model="form.name" :class="cls.fieldInput" />
            <div v-else :class="readBox">{{ current.name }}</div>
          </div>
          <div :class="cls.field" class="mt-3">
            <label :class="cls.fieldLabel">Critères</label>
            <textarea
              v-if="isEditMode"
              v-model="form.criteriaText"
              :class="cls.fieldTextarea"
              rows="8"
              placeholder="Compétences techniques&#10;Communication&#10;Motivation&#10;Adéquation culturelle"
            ></textarea>
            <ul v-else class="text-[13px] text-foreground list-disc pl-5 space-y-0.5 bg-background border border-border rounded-md p-3">
              <li v-for="(c, i) in current.criteria" :key="i">{{ c }}</li>
            </ul>
            <p v-if="isEditMode" class="text-[11px] text-muted-foreground mt-1">Chaque critère sera noté de 0 à 5 lors de l'évaluation ; la note globale est la moyenne.</p>
          </div>
        </FormSection>
      </div>
    </template>
  </CardModalShell>
</template>
