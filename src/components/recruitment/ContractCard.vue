<script setup lang="ts">
/**
 * Fiche d'un contrat (lecture seule), sur CardModalShell, pattern frontdesk.
 * Navigateur de N° à gauche, barre d'actions métier (ContractWorkflowActions),
 * contenu organisé en FormSection. Calqué sur MissionCard.vue.
 */
import { ref, computed, watch } from 'vue'
import { Download, UserPlus, CheckCircle2 } from 'lucide-vue-next'
import { RouterLink } from 'vue-router'
import CardModalShell from '../shared/CardModalShell.vue'
import StatusPill from '../ui/StatusPill.vue'
import FormSection from '../ui/form-field/FormSection.vue'
import ContractWorkflowActions from './ContractWorkflowActions.vue'
import ConvertToEmployeeModal from './ConvertToEmployeeModal.vue'
import * as cls from '../../lib/formClasses'
import { formatDate } from '../../lib/date'
import { resolveContractContent, buildContractHtml, downloadContractPdf } from '../../lib/contractDocument'
import { useAuthStore } from '../../stores/auth'
import { useContractStore } from '../../stores/recruitment'
import type { Contract } from '../../stores/recruitment'

const props = defineProps<{
  /** Contrats de la liste courante (pour la navigation N°) */
  items: Contract[]
  /** Contrat affiché */
  itemId: string
}>()

const emit = defineEmits<{ close: [] }>()

const contractStore = useContractStore()

function formatSalary(n: number): string { return `${n.toLocaleString('fr-FR')} MGA` }

const currentId = ref(props.itemId)
watch(() => props.itemId, (v) => { currentId.value = v })

const current = computed<Contract | null>(() => props.items.find(c => c.id === currentId.value) ?? null)
const currentIndex = computed(() => props.items.findIndex(c => c.id === currentId.value))
const hasPrev = computed(() => currentIndex.value > 0)
const hasNext = computed(() => currentIndex.value >= 0 && currentIndex.value < props.items.length - 1)

const sidebarItems = computed(() => props.items.map((c, i) => ({ no: String(i + 1), label: c.candidateName })))
const currentNo = computed(() => (currentIndex.value >= 0 ? String(currentIndex.value + 1) : null))

function goPrev() { if (hasPrev.value) currentId.value = props.items[currentIndex.value - 1]!.id }
function goNext() { if (hasNext.value) currentId.value = props.items[currentIndex.value + 1]!.id }
function selectSidebar(no: string) {
  const c = props.items[Number(no) - 1]
  if (c) currentId.value = c.id
}

/* ── Document du contrat (aperçu écran + PDF) ──────────────────────
   Voir lib/contractDocument.ts : document HTML autonome, réutilisé tel quel
   pour l'aperçu (iframe) et pour l'impression/PDF (nouvel onglet). */
function documentInput(item: Contract) {
  const tpl = contractStore.templates.find(t => t.id === item.templateId)
  const resolvedContent = tpl
    ? resolveContractContent(tpl.content, {
        candidateName: item.candidateName, jobTitle: item.jobTitle, entityName: item.entityName,
        startDate: formatDate(item.startDate), endDate: item.endDate ? formatDate(item.endDate) : undefined,
        salary: formatSalary(item.salary),
      })
    : ''
  return {
    candidateName: item.candidateName, jobTitle: item.jobTitle, entityName: item.entityName,
    templateName: item.templateName ?? 'Proposition d\'embauche', resolvedContent,
  }
}

const documentHtml = computed(() => (current.value ? buildContractHtml(documentInput(current.value)) : ''))
function downloadPdf() { if (current.value) downloadContractPdf(documentInput(current.value)) }

/* ── Conversion candidat -> employe (backlog "Inclusion d'un Potentiel") ──
   Cree un vrai compte dans le module Employes via
   contractStore.convertToEmployee (voir ConvertToEmployeeModal). Reserve aux
   comptes disposant de EMPLOYE_CREER, verifie aussi cote serveur. */
const auth = useAuthStore()
const canCreateEmployee = computed(() => auth.hasPermission('EMPLOYE_CREER'))
const showConvert = ref(false)

const pageTitle = computed(() => current.value?.candidateName ?? '')
const readBox = 'text-[13px] text-foreground bg-background border border-border rounded-md px-2.5 h-[38px] flex items-center'
</script>

<template>
  <CardModalShell
    v-if="current"
    :page-title="pageTitle"
    banner-label="Contrat"
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
      <ContractWorkflowActions :item="current" />
    </template>

    <template #form>
      <div class="px-6 py-5 max-w-4xl">
        <!-- Section Contrat -->
        <FormSection title="Contrat" :recaps="[current.jobTitle, current.entityName]">
          <div class="grid grid-cols-2 gap-x-6 gap-y-4 max-sm:grid-cols-1">
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Candidat</label>
              <div :class="readBox">{{ current.candidateName }}</div>
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
              <label :class="cls.fieldLabel">Modèle</label>
              <div :class="readBox">{{ current.templateName || 'Aucun modèle' }}</div>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Référence</label>
              <div :class="readBox" class="font-mono text-xs">{{ current.referenceCode }}</div>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Date de début</label>
              <div :class="readBox">{{ formatDate(current.startDate) }}</div>
            </div>
            <div v-if="current.endDate" :class="cls.field">
              <label :class="cls.fieldLabel">Date de fin</label>
              <div :class="readBox">{{ formatDate(current.endDate) }}</div>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Salaire mensuel brut</label>
              <div :class="readBox">{{ formatSalary(current.salary) }}</div>
            </div>
          </div>
          <div v-if="current.rejectionReason" :class="cls.fieldErrorBlock" class="mt-3">{{ current.rejectionReason }}</div>
        </FormSection>

        <!-- Section Conversion en employé (backlog "Inclusion d'un Potentiel") -->
        <FormSection v-if="current.status === 'Accepted'" title="Conversion en employé">
          <div v-if="current.createdEmployeeId" class="flex items-center gap-2 text-success text-[13px] font-medium">
            <CheckCircle2 class="w-4 h-4" /> Profil employé créé
            <RouterLink :to="{ name: 'hr-employee-edit', params: { id: current.createdEmployeeId } }" class="text-primary hover:underline ml-1">
              Ouvrir la fiche employé
            </RouterLink>
          </div>
          <template v-else-if="canCreateEmployee">
            <button type="button" :class="cls.btnPrimary" @click="showConvert = true">
              <UserPlus class="w-4 h-4" /> Créer le profil employé
            </button>
            <p class="text-[11px] text-muted-foreground mt-1.5">
              Crée un vrai compte dans le module Employés à partir de cette proposition d'embauche.
              À déclencher une fois le contrat signé physiquement et reçu par les RH.
            </p>
          </template>
          <p v-else class="text-[11px] text-muted-foreground italic">
            La création d'un profil employé requiert la permission de créer un employé.
          </p>
        </FormSection>

        <!-- Section Négociation -->
        <FormSection v-if="current.negotiationRounds.length > 0" title="Négociation" :recaps="[`${current.negotiationRounds.length} tour(s)`]">
          <div class="flex flex-col gap-2">
            <div v-for="r in current.negotiationRounds" :key="r.roundNo" class="text-[13px] bg-background rounded-md px-3 py-2 flex flex-col gap-0.5">
              <div class="flex items-center justify-between gap-2">
                <span class="font-medium text-foreground text-xs">
                  Tour {{ r.roundNo }} · {{ r.fromParty === 'HR' ? 'RH' : 'Candidat' }}
                  <span v-if="r.amount != null" class="text-primary">· {{ formatSalary(r.amount) }}</span>
                </span>
                <span class="text-[11px] text-muted-foreground shrink-0">{{ formatDate(r.date) }}</span>
              </div>
              <p class="text-foreground whitespace-pre-line">{{ r.comment }}</p>
            </div>
          </div>
        </FormSection>

        <!-- Section Document du contrat -->
        <FormSection title="Document du contrat">
          <div class="border border-border rounded-lg overflow-hidden h-[560px] bg-muted">
            <iframe :srcdoc="documentHtml" class="w-full h-full border-0" title="Aperçu du contrat" />
          </div>
          <button type="button" :class="[cls.btnPrimary, 'mt-3']" @click="downloadPdf">
            <Download class="w-4 h-4" /> Télécharger le PDF
          </button>
          <p class="text-[11px] text-muted-foreground mt-1.5">
            Ouvre le document dans un nouvel onglet et lance l'impression : choisissez "Enregistrer au format PDF" comme destination pour le télécharger.
          </p>
        </FormSection>
      </div>
    </template>
  </CardModalShell>

  <ConvertToEmployeeModal
    v-if="current"
    :open="showConvert"
    :contract="current"
    mode="contract"
    @close="showConvert = false"
    @done="showConvert = false"
  />
</template>
