<script setup lang="ts">
/**
 * Fiche d'une offre d'emploi (lecture seule), sur CardModalShell.
 * La candidature interne (mobilité) est initiée par l'employé lui-même
 * depuis son espace (US12, voir MyInternalApplicationsView.vue), pas par le
 * recruteur depuis cette fiche.
 */
import { ref, computed, watch } from 'vue'
import { Eye, Users, Link2, Check, Coins, ClipboardCheck, Megaphone, Copy } from 'lucide-vue-next'
import CardModalShell from '../shared/CardModalShell.vue'
import StatusPill from '../ui/StatusPill.vue'
import FormSection from '../ui/form-field/FormSection.vue'
import ModalShell from '../ui/ModalShell.vue'
import JobOfferWorkflowActions from './JobOfferWorkflowActions.vue'
import JobOfferDistributionPanel from './JobOfferDistributionPanel.vue'
import * as cls from '../../lib/formClasses'
import { formatDate } from '../../lib/date'
import { JOB_DISTRIBUTION_UI_ENABLED } from '../../config/features'
import { useJobOfferStore } from '../../stores/recruitment'
import type { JobOffer, ShareContent } from '../../stores/recruitment'

const props = defineProps<{
  /** Offres de la liste courante (déjà filtrée par la vue), pour la navigation N° */
  items: JobOffer[]
  /** Offre affichée */
  itemId: string
}>()

const emit = defineEmits<{ close: [] }>()

const jobOfferStore = useJobOfferStore()

const readBox = 'text-[13px] text-foreground bg-background border border-border rounded-md px-2.5 h-[38px] flex items-center'

const currentId = ref(props.itemId)
watch(() => props.itemId, (v) => { currentId.value = v })

const current = computed<JobOffer | null>(() => props.items.find(o => o.id === currentId.value) ?? null)
const currentIndex = computed(() => props.items.findIndex(o => o.id === currentId.value))
const hasPrev = computed(() => currentIndex.value > 0)
const hasNext = computed(() => currentIndex.value >= 0 && currentIndex.value < props.items.length - 1)

const sidebarItems = computed(() => props.items.map((o, i) => ({ no: String(i + 1), label: o.title })))
const currentNo = computed(() => (currentIndex.value >= 0 ? String(currentIndex.value + 1) : null))

function goPrev() { if (hasPrev.value) currentId.value = props.items[currentIndex.value - 1]!.id }
function goNext() { if (hasNext.value) currentId.value = props.items[currentIndex.value + 1]!.id }
function selectSidebar(no: string) {
  const o = props.items[Number(no) - 1]
  if (o) currentId.value = o.id
}

const showStats = computed(() => current.value?.status === 'Published' || current.value?.status === 'Closed')

function formatCost(n: number): string { return `${n.toLocaleString('fr-FR')} MGA` }

// Lien du portail carrière public — adressé par le jeton opaque de l'offre.
const publicUrl = computed(() => current.value ? `${window.location.origin}/careers/${current.value.publicToken}` : '')
const copied = ref(false)
async function copyPublicUrl() {
  await navigator.clipboard.writeText(publicUrl.value)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}

// Section Diffusion : visible des que l'offre n'est plus un brouillon, tant
// que la fonctionnalite n'est pas masquee (voir config/features.ts).
const showDistribution = computed(() => JOB_DISTRIBUTION_UI_ENABLED && (current.value?.status === 'Published' || current.value?.status === 'Closed'))

// Contenu pret a coller (LinkedIn, X, intranet, e-mail cabinet).
const shareModal = ref(false)
const shareLoading = ref(false)
const shareContent = ref<ShareContent | null>(null)
const copiedKey = ref('')
async function openShare() {
  if (!current.value) return
  shareModal.value = true
  if (shareContent.value) return
  shareLoading.value = true
  try {
    shareContent.value = await jobOfferStore.fetchShareContent(current.value.id)
  } finally {
    shareLoading.value = false
  }
}
async function copyShare(key: string, text: string) {
  await navigator.clipboard.writeText(text)
  copiedKey.value = key
  setTimeout(() => { if (copiedKey.value === key) copiedKey.value = '' }, 2000)
}
const SHARE_BLOCKS: { key: keyof ShareContent; label: string }[] = [
  { key: 'plainText', label: 'Texte simple' },
  { key: 'markdown', label: 'Markdown' },
  { key: 'linkedinPost', label: 'Post LinkedIn' },
  { key: 'twitterShort', label: 'Post court (X)' },
]

// Re-charger le contenu si on change d'offre pendant la navigation N°.
watch(currentId, () => { shareContent.value = null })
</script>

<template>
  <CardModalShell
    v-if="current"
    :page-title="current.title"
    banner-label="Offre d'emploi"
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
      <JobOfferWorkflowActions :item="current" />
    </template>

    <template #form>
      <div class="px-6 py-5 max-w-4xl">
        <!-- Section Offre -->
        <FormSection title="Offre" :recaps="[current.entityName, current.contractType, current.location]">
          <div class="grid grid-cols-2 gap-x-6 gap-y-4 max-sm:grid-cols-1">
            <div :class="cls.field" class="col-span-2">
              <label :class="cls.fieldLabel">Titre</label>
              <div :class="readBox">{{ current.title }}</div>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Référence</label>
              <div :class="readBox" class="font-mono text-xs">{{ current.referenceCode }}</div>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Entité</label>
              <div :class="readBox">{{ current.entityName }}</div>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Type de contrat</label>
              <div :class="readBox">{{ current.contractType }}</div>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Lieu</label>
              <div :class="readBox">{{ current.location }}</div>
            </div>
            <div v-if="current.salaryText" :class="cls.field">
              <label :class="cls.fieldLabel">Rémunération affichée</label>
              <div :class="readBox">
                <Coins class="w-3.5 h-3.5 text-primary mr-1.5 shrink-0" /> {{ current.salaryText }}
              </div>
            </div>
            <div v-if="current.publishedAt" :class="cls.field">
              <label :class="cls.fieldLabel">Publiée le</label>
              <div :class="readBox">{{ formatDate(current.publishedAt) }}</div>
            </div>
            <div v-if="current.evaluationTemplateName" :class="cls.field">
              <label :class="cls.fieldLabel">Grille d'évaluation d'entretien</label>
              <div :class="readBox">
                <ClipboardCheck class="w-3.5 h-3.5 text-primary mr-1.5 shrink-0" /> {{ current.evaluationTemplateName }}
              </div>
            </div>
          </div>
          <div v-if="current.status === 'Published'" :class="cls.field" class="mt-3">
            <label :class="cls.fieldLabel">Lien public (portail carrière)</label>
            <div class="flex items-center gap-2">
              <div :class="readBox" class="flex-1 truncate font-mono text-xs">{{ publicUrl }}</div>
              <button type="button" :class="cls.btnOutline" class="shrink-0" @click="copyPublicUrl">
                <Check v-if="copied" class="w-3.5 h-3.5 text-success" />
                <Link2 v-else class="w-3.5 h-3.5" />
                {{ copied ? 'Copié' : 'Copier' }}
              </button>
            </div>
            <p class="text-[11px] text-muted-foreground mt-1">N'importe qui avec ce lien peut voir l'offre et postuler, sans se connecter.</p>
          </div>
        </FormSection>

        <!-- Section Description -->
        <FormSection title="Description">
          <p class="text-[13px] text-foreground whitespace-pre-line">{{ current.description }}</p>
        </FormSection>

        <!-- Section Diffusion (backlog "Diffusion multi-plateformes") -->
        <FormSection v-if="showDistribution" title="Diffusion">
          <div class="mb-3">
            <button type="button" :class="cls.btnOutline" @click="openShare">
              <Megaphone class="w-4 h-4" /> Contenu à partager
            </button>
          </div>
          <JobOfferDistributionPanel :offer-id="current.id" />
        </FormSection>

        <!-- Section Statistiques -->
        <FormSection v-if="showStats" title="Statistiques" :recaps="[`${current.views} vue(s)`, `${jobOfferStore.applicationsCount(current.id)} candidature(s)`]">
          <div class="grid grid-cols-2 gap-x-6 gap-y-4 max-sm:grid-cols-1">
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Vues</label>
              <div class="flex items-center gap-2 h-[38px]">
                <Eye class="w-4 h-4 text-muted-foreground" />
                <span class="text-[13px] font-medium text-foreground">{{ current.views }}</span>
              </div>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Candidatures</label>
              <div class="flex items-center gap-2 h-[38px]">
                <Users class="w-4 h-4 text-muted-foreground" />
                <span class="text-[13px] font-medium text-foreground">{{ jobOfferStore.applicationsCount(current.id) }}</span>
              </div>
            </div>
            <div v-if="current.recruitmentCost !== undefined" :class="cls.field">
              <label :class="cls.fieldLabel">Coût du recrutement</label>
              <div class="flex items-center gap-2 h-[38px]">
                <Coins class="w-4 h-4 text-muted-foreground" />
                <span class="text-[13px] font-medium text-foreground">{{ formatCost(current.recruitmentCost) }}</span>
              </div>
            </div>
          </div>
        </FormSection>
      </div>
    </template>
  </CardModalShell>

  <!-- Contenu pret a coller pour diffusion manuelle -->
  <ModalShell :open="shareModal" title="Contenu à partager" max-width="max-w-[640px]" @close="shareModal = false">
    <div v-if="shareLoading" class="text-[13px] text-muted-foreground py-6 text-center">Chargement...</div>
    <div v-else-if="shareContent" class="flex flex-col gap-4">
      <p class="text-[12px] text-muted-foreground">
        Textes prêts à coller sur LinkedIn, X, l'intranet ou dans un e-mail à un cabinet. Le lien de candidature du portail public y est déjà inséré.
      </p>
      <div v-for="b in SHARE_BLOCKS" :key="b.key" :class="cls.field">
        <div class="flex items-center justify-between">
          <label :class="cls.fieldLabel">{{ b.label }}</label>
          <button type="button" class="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline" @click="copyShare(b.key, shareContent[b.key])">
            <Check v-if="copiedKey === b.key" class="w-3 h-3 text-success" />
            <Copy v-else class="w-3 h-3" />
            {{ copiedKey === b.key ? 'Copié' : 'Copier' }}
          </button>
        </div>
        <textarea :value="shareContent[b.key]" readonly rows="4" :class="cls.fieldTextarea" class="font-mono text-[11px]"></textarea>
      </div>
    </div>
    <template #footer>
      <button :class="cls.btnOutline" @click="shareModal = false">Fermer</button>
    </template>
  </ModalShell>
</template>
