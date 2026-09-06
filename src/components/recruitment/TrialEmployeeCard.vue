<script setup lang="ts">
/**
 * Fiche d'une période d'essai (lecture seule) — sur CardModalShell, pattern
 * frontdesk. Navigateur de N° à gauche, barre d'actions métier
 * (TrialEmployeeWorkflowActions), contenu organisé en FormSection. Calqué
 * sur MissionCard.vue.
 */
import { ref, computed, watch } from 'vue'
import { Download } from 'lucide-vue-next'
import CardModalShell from '../shared/CardModalShell.vue'
import StatusPill from '../ui/StatusPill.vue'
import FormSection from '../ui/form-field/FormSection.vue'
import TrialEmployeeWorkflowActions from './TrialEmployeeWorkflowActions.vue'
import * as cls from '../../lib/formClasses'
import { formatDate } from '../../lib/date'
import { resolveContractContent, buildContractHtml, downloadContractPdf } from '../../lib/contractDocument'
import { useContractStore } from '../../stores/recruitment'
import type { TrialEmployee } from '../../stores/recruitment'

const contractStore = useContractStore()

const props = defineProps<{
  /** Périodes d'essai de la liste courante (pour la navigation N°) */
  items: TrialEmployee[]
  /** Période d'essai affichée */
  itemId: string
}>()

const emit = defineEmits<{ close: [] }>()

const currentId = ref(props.itemId)
watch(() => props.itemId, (v) => { currentId.value = v })

const current = computed<TrialEmployee | null>(() => props.items.find(t => t.id === currentId.value) ?? null)
const currentIndex = computed(() => props.items.findIndex(t => t.id === currentId.value))
const hasPrev = computed(() => currentIndex.value > 0)
const hasNext = computed(() => currentIndex.value >= 0 && currentIndex.value < props.items.length - 1)

const sidebarItems = computed(() => props.items.map((t, i) => ({ no: String(i + 1), label: t.employeeName })))
const currentNo = computed(() => (currentIndex.value >= 0 ? String(currentIndex.value + 1) : null))

function goPrev() { if (hasPrev.value) currentId.value = props.items[currentIndex.value - 1]!.id }
function goNext() { if (hasNext.value) currentId.value = props.items[currentIndex.value + 1]!.id }
function selectSidebar(no: string) {
  const t = props.items[Number(no) - 1]
  if (t) currentId.value = t.id
}

const pageTitle = computed(() => current.value?.employeeName ?? '')
const readBox = 'text-[13px] text-foreground bg-background border border-border rounded-md px-2.5 h-[38px] flex items-center'

function formatSalary(n: number): string { return `${n.toLocaleString('fr-FR')} MGA` }

/* ── Contrat lié (voir TrialEmployee.contractId) ────────────────────
   Une période d'essai naît toujours d'un contrat déjà généré (voir
   ContractsView.vue) — on retrouve ici le même document que sur sa fiche. */
const linkedContract = computed(() => current.value ? contractStore.items.find(c => c.id === current.value!.contractId) ?? null : null)

function documentInput() {
  const contract = linkedContract.value
  if (!contract) return null
  const tpl = contractStore.templates.find(t => t.id === contract.templateId)
  const resolvedContent = tpl
    ? resolveContractContent(tpl.content, {
        candidateName: contract.candidateName, jobTitle: contract.jobTitle, entityName: contract.entityName,
        startDate: formatDate(contract.startDate), endDate: contract.endDate ? formatDate(contract.endDate) : undefined,
        salary: formatSalary(contract.salary),
      })
    : ''
  return {
    candidateName: contract.candidateName, jobTitle: contract.jobTitle, entityName: contract.entityName,
    templateName: contract.templateName, resolvedContent,
  }
}

const documentHtml = computed(() => {
  const input = documentInput()
  return input ? buildContractHtml(input) : ''
})
function downloadPdf() {
  const input = documentInput()
  if (input) downloadContractPdf(input)
}
</script>

<template>
  <CardModalShell
    v-if="current"
    :page-title="pageTitle"
    banner-label="Période d'essai"
    :is-edit-mode="false"
    :show-edit="false"
    :show-title-new-button="false"
    :sidebar-items="sidebarItems"
    :current-no="currentNo"
    :has-prev="hasPrev"
    :has-next="hasNext"
    @close="emit('close')"
    @go-prev="goPrev"
    @go-next="goNext"
    @select-sidebar="selectSidebar"
  >
    <template #title-badges>
      <StatusPill :status="current.status" />
    </template>

    <template #action-buttons>
      <TrialEmployeeWorkflowActions :item="current" />
    </template>

    <template #form>
      <div class="px-6 py-5 max-w-4xl">
        <!-- Section Période d'essai -->
        <FormSection title="Période d'essai" :recaps="[current.jobTitle, current.entityName]">
          <div class="grid grid-cols-2 gap-x-6 gap-y-4 max-sm:grid-cols-1">
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Employé</label>
              <div :class="readBox">{{ current.employeeName }}</div>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Poste</label>
              <div :class="readBox">{{ current.jobTitle }}</div>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Entité</label>
              <div :class="readBox">{{ current.entityName }}</div>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Date de début</label>
              <div :class="readBox">{{ formatDate(current.startDate) }}</div>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Date de fin d'essai</label>
              <div :class="readBox">{{ formatDate(current.trialEndDate) }}</div>
            </div>
          </div>
        </FormSection>

        <!-- Section Contrat lié -->
        <FormSection v-if="linkedContract" title="Contrat lié" :recaps="[linkedContract.templateName]">
          <div class="border border-border rounded-lg overflow-hidden h-[560px] bg-muted">
            <iframe :srcdoc="documentHtml" class="w-full h-full border-0" title="Aperçu du contrat" />
          </div>
          <button type="button" :class="[cls.btnPrimary, 'mt-3']" @click="downloadPdf">
            <Download class="w-4 h-4" /> Télécharger le PDF
          </button>
        </FormSection>

        <!-- Section Évaluation -->
        <FormSection v-if="current.evaluation" title="Évaluation" :recaps="[`${current.evaluation.score}/5`]">
          <div class="grid grid-cols-2 gap-x-6 gap-y-4 max-sm:grid-cols-1">
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Note</label>
              <div :class="readBox">{{ current.evaluation.score }} / 5</div>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Évaluateur</label>
              <div :class="readBox">{{ current.evaluation.evaluatedByName }}</div>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Date</label>
              <div :class="readBox">{{ formatDate(current.evaluation.date) }}</div>
            </div>
            <div :class="cls.field" class="col-span-2">
              <label :class="cls.fieldLabel">Commentaire</label>
              <div :class="[readBox, 'h-auto min-h-[38px] py-2 whitespace-pre-line']">{{ current.evaluation.comment }}</div>
            </div>
          </div>
        </FormSection>
      </div>
    </template>
  </CardModalShell>
</template>
