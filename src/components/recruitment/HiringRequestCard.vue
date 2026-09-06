<script setup lang="ts">
/**
 * Fiche d'une expression de besoin (lecture seule), sur CardModalShell,
 * pattern frontdesk. Navigateur de N° à gauche (position dans la liste
 * courante), barre d'actions métier (HiringRequestWorkflowActions).
 */
import { ref, computed, watch } from 'vue'
import FormSection from '../ui/form-field/FormSection.vue'
import StatusPill from '../ui/StatusPill.vue'
import CardModalShell from '../shared/CardModalShell.vue'
import HiringRequestWorkflowActions from './HiringRequestWorkflowActions.vue'
import * as cls from '../../lib/formClasses'
import { formatDate } from '../../lib/date'
import type { HiringRequest } from '../../stores/recruitment'

const props = defineProps<{
  /** Expressions de besoin de la liste courante (pour la navigation N°) */
  requests: HiringRequest[]
  /** Expression de besoin affichée */
  requestId: string
}>()

const emit = defineEmits<{ close: [] }>()

const readBox = 'text-[13px] text-foreground bg-background border border-border rounded-md px-2.5 h-[38px] flex items-center'

const currentId = ref(props.requestId)
watch(() => props.requestId, (v) => { currentId.value = v })

const currentIndex = computed(() => props.requests.findIndex(r => r.id === currentId.value))
const current = computed<HiringRequest | null>(() => props.requests[currentIndex.value] ?? null)
const hasPrev = computed(() => currentIndex.value > 0)
const hasNext = computed(() => currentIndex.value >= 0 && currentIndex.value < props.requests.length - 1)

const sidebarItems = computed(() => props.requests.map((r, i) => ({ no: String(i + 1), label: r.positionTitle })))
const currentNo = computed(() => (currentIndex.value >= 0 ? String(currentIndex.value + 1) : null))

function goPrev() { if (hasPrev.value) currentId.value = props.requests[currentIndex.value - 1]!.id }
function goNext() { if (hasNext.value) currentId.value = props.requests[currentIndex.value + 1]!.id }
function selectSidebar(no: string) {
  const idx = Number(no) - 1
  const r = props.requests[idx]
  if (r) currentId.value = r.id
}

const pageTitle = computed(() => current.value?.positionTitle ?? '')
</script>

<template>
  <CardModalShell
    v-if="current"
    :page-title="pageTitle"
    banner-label="Expression de besoin"
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

    <!-- Barre d'actions métier -->
    <template #action-buttons>
      <HiringRequestWorkflowActions :item="current" />
    </template>

    <template #form>
      <div class="px-6 py-5 max-w-4xl">
        <!-- Section Demande -->
        <FormSection title="Demande" :recaps="[current.entityName, `${current.headcount} poste(s)`]">
          <div class="grid grid-cols-2 gap-x-6 gap-y-4 max-sm:grid-cols-1">
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Poste</label>
              <div :class="readBox">{{ current.positionTitle }}</div>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Entité</label>
              <div :class="readBox">{{ current.entityName }}</div>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Effectif</label>
              <div :class="readBox">{{ current.headcount }}</div>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Demandé par</label>
              <div :class="readBox">{{ current.requestedByName }}</div>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Date</label>
              <div :class="readBox">{{ formatDate(current.requestedAt) }}</div>
            </div>
          </div>
          <div v-if="current.rejectionReason" :class="[cls.fieldErrorBlock, 'mt-3']">{{ current.rejectionReason }}</div>
        </FormSection>

        <!-- Section Profil recherché -->
        <FormSection title="Profil recherché">
          <div :class="cls.field">
            <div :class="[readBox, 'h-auto min-h-[38px] py-2 whitespace-pre-line']">{{ current.profile }}</div>
          </div>
        </FormSection>
      </div>
    </template>
  </CardModalShell>
</template>
