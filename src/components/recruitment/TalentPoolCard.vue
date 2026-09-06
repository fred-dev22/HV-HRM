<script setup lang="ts">
/**
 * Fiche complète d'un profil du vivier de talents (lecture seule, pas
 * d'édition pour ce module) - sur CardModalShell, pattern frontdesk.
 * Navigateur de N° à gauche (position dans la liste courante), barre
 * d'actions métier (TalentPoolWorkflowActions), sections Profil / Tags / Notes.
 */
import { ref, computed, watch } from 'vue'
import CardModalShell from '../shared/CardModalShell.vue'
import FormSection from '../ui/form-field/FormSection.vue'
import TalentPoolWorkflowActions from './TalentPoolWorkflowActions.vue'
import * as cls from '../../lib/formClasses'
import { formatDate } from '../../lib/date'
import type { TalentPoolEntry } from '../../stores/recruitment'

const props = defineProps<{
  /** Profils de la liste courante (déjà filtrés/triés), pour la navigation N° */
  entries: TalentPoolEntry[]
  /** Profil affiché */
  entryId: string
}>()

const emit = defineEmits<{ close: [] }>()

const currentId = ref(props.entryId)
watch(() => props.entryId, (v) => { currentId.value = v })

const current = computed<TalentPoolEntry | null>(() => props.entries.find(e => e.id === currentId.value) ?? null)
const currentIndex = computed(() => props.entries.findIndex(e => e.id === currentId.value))
const hasPrev = computed(() => currentIndex.value > 0)
const hasNext = computed(() => currentIndex.value >= 0 && currentIndex.value < props.entries.length - 1)

const sidebarItems = computed(() => props.entries.map((e, i) => ({ no: String(i + 1), label: e.candidateName })))
const currentNo = computed(() => (currentIndex.value >= 0 ? String(currentIndex.value + 1) : null))

function goPrev() { if (hasPrev.value) currentId.value = props.entries[currentIndex.value - 1]!.id }
function goNext() { if (hasNext.value) currentId.value = props.entries[currentIndex.value + 1]!.id }
function selectSidebar(no: string) {
  const entry = props.entries[Number(no) - 1]
  if (entry) currentId.value = entry.id
}

const readBox = 'text-[13px] text-foreground bg-background border border-border rounded-md px-2.5 h-[38px] flex items-center'
</script>

<template>
  <CardModalShell
    v-if="current"
    :page-title="current.candidateName"
    banner-label="Profil du vivier"
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
      <span
        class="text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
        :class="current.status === 'Open' ? 'bg-success-bg text-success' : 'bg-neutral-bg text-neutral'"
      >{{ current.status === 'Open' ? 'Ouvert' : 'Fermé' }}</span>
    </template>

    <template #action-buttons>
      <TalentPoolWorkflowActions :item="current" @removed="emit('close')" />
    </template>

    <template #form>
      <div class="px-6 py-5 max-w-4xl">
        <!-- Section Profil -->
        <FormSection title="Profil" :recaps="[current.candidateEmail, current.candidatePhone]">
          <div class="grid grid-cols-2 gap-x-6 gap-y-4 max-sm:grid-cols-1">
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Nom</label>
              <div :class="readBox">{{ current.candidateName }}</div>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Email</label>
              <div :class="readBox">{{ current.candidateEmail }}</div>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Téléphone</label>
              <div :class="readBox">{{ current.candidatePhone || 'Non renseigné' }}</div>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Ajouté le</label>
              <div :class="readBox">{{ formatDate(current.addedAt) }}</div>
            </div>
          </div>
        </FormSection>

        <!-- Section Tags -->
        <FormSection title="Tags" :recaps="[`${current.tags.length} tag(s)`]">
          <div v-if="current.tags.length > 0" class="flex flex-wrap gap-1.5">
            <span
              v-for="tag in current.tags"
              :key="tag"
              class="text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap bg-primary/10 text-primary"
            >{{ tag }}</span>
          </div>
          <p v-else class="text-xs text-muted-foreground italic">Aucun tag</p>
        </FormSection>

        <!-- Section Notes -->
        <FormSection title="Notes">
          <p v-if="current.notes" class="text-[13px] text-foreground whitespace-pre-line">{{ current.notes }}</p>
          <p v-else class="text-xs text-muted-foreground italic">Aucune note</p>
        </FormSection>

        <!-- Section Évaluations -->
        <FormSection title="Évaluations" :recaps="[`${current.evaluations.length} évaluation(s)`]">
          <div v-if="current.evaluations.length === 0" class="text-xs text-muted-foreground italic">Aucune évaluation pour le moment.</div>
          <div v-for="(ev, i) in current.evaluations" :key="i" class="text-[13px] bg-background rounded-md px-3 py-2 flex flex-col gap-0.5 mb-2 last:mb-0">
            <div class="flex items-center justify-between gap-2">
              <span class="font-medium text-foreground text-xs truncate">{{ ev.evaluatedByName }} — {{ ev.score }} / 5</span>
              <span class="text-[11px] text-muted-foreground shrink-0">{{ formatDate(ev.date) }}</span>
            </div>
            <p class="text-foreground whitespace-pre-line">{{ ev.comment }}</p>
          </div>
        </FormSection>
      </div>
    </template>
  </CardModalShell>
</template>
