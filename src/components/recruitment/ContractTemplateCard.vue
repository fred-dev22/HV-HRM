<script setup lang="ts">
/**
 * Fiche d'un modèle de contrat (lecture / édition) — sur CardModalShell,
 * même pattern que EmployeeCard.vue : édition inline (pas de modale à part)
 * et navigateur de N° à gauche pour passer d'un modèle à l'autre sans
 * fermer/rouvrir. Type de contrat affiché en badge à côté du titre.
 */
import { ref, computed, watch } from 'vue'
import CardModalShell from '../shared/CardModalShell.vue'
import FormSection from '../ui/form-field/FormSection.vue'
import * as cls from '../../lib/formClasses'
import { resolveContractContent, buildContractHtml } from '../../lib/contractDocument'
import { useContractStore } from '../../stores/recruitment'
import type { ContractTemplate } from '../../stores/recruitment'

const props = defineProps<{
  /** Modèles de la liste courante, pour la navigation N° */
  items: ContractTemplate[]
  /** Modèle affiché */
  itemId: string
}>()

const emit = defineEmits<{ close: [] }>()

const contractStore = useContractStore()

// Liste fixe, identique à celle de ContractsView.vue (voir decision du
// 29/08 : pas d'ajout de type libre depuis l'écran, ça reprend les vrais
// types du module Employés + "Période d'essai" propre au recrutement).
const CONTRACT_TYPES = [
  { value: 'CDI', label: 'CDI' },
  { value: 'CDD', label: 'CDD' },
  { value: 'Stage', label: 'Stage' },
  { value: 'Freelance', label: 'Freelance' },
  { value: 'Apprenti', label: 'Apprentissage' },
  { value: 'Alternant', label: 'Alternance' },
  { value: 'Essai', label: 'Période d\'essai' },
]
const CONTRACT_TYPE_LABELS: Record<string, string> = Object.fromEntries(CONTRACT_TYPES.map(c => [c.value, c.label]))
function typeLabel(value: string): string { return CONTRACT_TYPE_LABELS[value] ?? value }

const currentId = ref(props.itemId)
watch(() => props.itemId, (v) => { currentId.value = v; isEditMode.value = false })

const current = computed<ContractTemplate | null>(() => props.items.find(t => t.id === currentId.value) ?? null)
const currentIndex = computed(() => props.items.findIndex(t => t.id === currentId.value))
const hasPrev = computed(() => currentIndex.value > 0)
const hasNext = computed(() => currentIndex.value >= 0 && currentIndex.value < props.items.length - 1)

// Numérotation par position (1, 2, 3…) : un modèle n'a pas de code propre,
// même limite que InterviewCard.vue/JobOfferCard.vue.
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
const form = ref({ name: '', contractType: 'CDI', content: '' })

function enterEdit() {
  if (!current.value) return
  form.value = { name: current.value.name, contractType: current.value.contractType, content: current.value.content }
  saveError.value = ''
  isEditMode.value = true
}
function cancelEdit() { isEditMode.value = false; saveError.value = '' }
function save() {
  if (!current.value) return
  if (!form.value.name.trim()) { saveError.value = 'Le nom est requis'; return }
  if (!form.value.content.trim()) { saveError.value = 'Le contenu est requis'; return }
  contractStore.updateTemplate(current.value.id, {
    name: form.value.name.trim(), contractType: form.value.contractType, content: form.value.content.trim(),
  })
  isEditMode.value = false
}

// Construit en JS (pas en template) : voir ContractsView.vue, deux "}}"
// litteraux dans un meme mustache Vue font echouer le compilateur.
const placeholderHint = 'Placeholders disponibles : ' +
  ['nom_candidat', 'poste', 'entite', 'date_debut', 'date_fin', 'salaire'].map(p => `{{${p}}}`).join(', ') +
  '. {{date_fin}} reste vide pour un modèle de type CDI (durée indéterminée).'

/* ── Aperçu (exemple) ───────────────────────────────────────────────
   Toujours visible, pas seulement en édition — pour comparer les modèles
   en naviguant, sans avoir à cliquer "Modifier" à chaque fois. Reflète le
   contenu enregistré hors édition, ou la saisie en cours pendant l'édition. */
const TEMPLATE_PREVIEW_EXAMPLE = {
  candidateName: 'Jean Rakoto', jobTitle: 'Comptable', entityName: 'Direction Générale',
  startDate: '01/01/2026', endDate: '31/12/2026', salary: '500 000',
}
const previewSource = computed(() => (isEditMode.value ? form.value : (current.value ?? { name: '', contractType: 'CDI', content: '' })))
const previewHtml = computed(() => {
  const src = previewSource.value
  const resolvedContent = resolveContractContent(src.content, {
    ...TEMPLATE_PREVIEW_EXAMPLE,
    endDate: src.contractType === 'CDI' ? undefined : TEMPLATE_PREVIEW_EXAMPLE.endDate,
  })
  return buildContractHtml({
    candidateName: TEMPLATE_PREVIEW_EXAMPLE.candidateName, jobTitle: TEMPLATE_PREVIEW_EXAMPLE.jobTitle,
    entityName: TEMPLATE_PREVIEW_EXAMPLE.entityName, templateName: src.name || 'Modèle de contrat', resolvedContent,
  })
})

const pageTitle = computed(() => current.value?.name ?? '')
const readBox = 'text-[13px] text-foreground bg-background border border-border rounded-md px-2.5 h-[38px] flex items-center'
</script>

<template>
  <CardModalShell
    v-if="current"
    :page-title="pageTitle"
    banner-label="Modèle de contrat"
    :is-edit-mode="isEditMode"
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
        {{ typeLabel(current.contractType) }}
      </span>
    </template>

    <template #form>
      <div class="px-6 py-5 max-w-4xl">
        <FormSection title="Modèle">
          <div class="grid grid-cols-2 gap-x-6 gap-y-4 max-sm:grid-cols-1">
            <div :class="cls.field" class="col-span-2">
              <label :class="cls.fieldLabel">Nom du modèle</label>
              <input v-if="isEditMode" v-model="form.name" :class="cls.fieldInput" />
              <div v-else :class="readBox">{{ current.name }}</div>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Type de contrat</label>
              <select v-if="isEditMode" v-model="form.contractType" :class="cls.fieldSelect">
                <option v-for="c in CONTRACT_TYPES" :key="c.value" :value="c.value">{{ c.label }}</option>
              </select>
              <div v-else :class="readBox">{{ typeLabel(current.contractType) }}</div>
            </div>
          </div>
        </FormSection>

        <FormSection title="Contenu">
          <div :class="cls.field">
            <label :class="cls.fieldLabel">Contenu</label>
            <textarea v-if="isEditMode" v-model="form.content" :class="cls.fieldTextarea" rows="6" placeholder="Texte du contrat…"></textarea>
            <p v-else class="text-[13px] text-foreground whitespace-pre-line bg-background border border-border rounded-md p-3">{{ current.content }}</p>
            <p v-if="isEditMode" class="text-[11px] text-muted-foreground mt-1">{{ placeholderHint }}</p>
          </div>
        </FormSection>

        <FormSection title="Aperçu (exemple)">
          <div class="border border-border rounded-lg overflow-hidden h-[420px] bg-muted">
            <iframe :srcdoc="previewHtml" class="w-full h-full border-0" title="Aperçu du modèle" />
          </div>
          <p class="text-[11px] text-muted-foreground mt-1.5">
            Rendu avec des données d'exemple (candidat, poste, dates fictifs) — juste pour voir le document final, sans l'imprimer.
          </p>
        </FormSection>
      </div>
    </template>
  </CardModalShell>
</template>
