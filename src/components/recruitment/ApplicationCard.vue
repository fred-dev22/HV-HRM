<script setup lang="ts">
/**
 * Fiche complète d'une candidature (lecture seule), sur CardModalShell,
 * pattern frontdesk. Navigateur de N° à gauche (position dans la liste
 * courante), barre d'actions (ApplicationWorkflowActions), notes complètes
 * avec formulaire d'ajout. Partagée par les trois écrans de liste
 * (Candidatures, Spontanées, Stages) : même entité (Application), juste
 * filtrée différemment. Calquée sur HiringRequestCard / MissionCard.
 */
import { ref, computed, watch } from 'vue'
import { Plus, FileText } from 'lucide-vue-next'
import CardModalShell from '../shared/CardModalShell.vue'
import StatusPill from '../ui/StatusPill.vue'
import FormSection from '../ui/form-field/FormSection.vue'
import ApplicationWorkflowActions from './ApplicationWorkflowActions.vue'
import * as cls from '../../lib/formClasses'
import { formatDate } from '../../lib/date'
import { useApplicationStore } from '../../stores/recruitment'
import type { Application } from '../../stores/recruitment'
import { useAuthStore } from '../../stores/auth'

const props = defineProps<{
  /** Candidatures de la liste (déjà filtrée) courante, pour la navigation N° */
  items: Application[]
  /** Candidature affichée */
  itemId: string
}>()

const emit = defineEmits<{ close: [] }>()

const applicationStore = useApplicationStore()
const auth = useAuthStore()

const readBox = 'text-[13px] text-foreground bg-background border border-border rounded-md px-2.5 h-[38px] flex items-center'

const currentId = ref(props.itemId)
watch(() => props.itemId, (v) => { currentId.value = v })

const currentIndex = computed(() => props.items.findIndex(a => a.id === currentId.value))
const current = computed<Application | null>(() => props.items[currentIndex.value] ?? null)
const hasPrev = computed(() => currentIndex.value > 0)
const hasNext = computed(() => currentIndex.value >= 0 && currentIndex.value < props.items.length - 1)

const sidebarItems = computed(() => props.items.map((a, i) => ({ no: String(i + 1), label: a.candidateName })))
const currentNo = computed(() => (currentIndex.value >= 0 ? String(currentIndex.value + 1) : null))

function goPrev() { if (hasPrev.value) currentId.value = props.items[currentIndex.value - 1]!.id }
function goNext() { if (hasNext.value) currentId.value = props.items[currentIndex.value + 1]!.id }
function selectSidebar(no: string) {
  const idx = Number(no) - 1
  const a = props.items[idx]
  if (a) currentId.value = a.id
}

const pageTitle = computed(() => current.value?.candidateName ?? '')

/* ── Notes ──────────────────────────────────────────────────── */
const noteDraft = ref('')
watch(currentId, () => { noteDraft.value = '' })
function addNote() {
  const text = noteDraft.value.trim()
  if (!text || !current.value) return
  applicationStore.addNote(current.value.id, auth.user?.name ?? '', text)
  noteDraft.value = ''
}
</script>

<template>
  <CardModalShell
    v-if="current"
    :page-title="pageTitle"
    banner-label="Candidature"
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
      <span v-if="current.source === 'Internal'" class="text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap bg-info-bg text-info">Candidature interne</span>
    </template>

    <!-- Barre d'actions -->
    <template #action-buttons>
      <ApplicationWorkflowActions :item="current" />
    </template>

    <template #form>
      <div class="px-6 py-5 max-w-4xl">
        <!-- Section Candidat -->
        <FormSection title="Candidat" :recaps="[current.candidateName, current.candidateEmail || 'Interne']">
          <div class="grid grid-cols-2 gap-x-6 gap-y-4 max-sm:grid-cols-1">
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Nom</label>
              <div :class="readBox">{{ current.candidateName }}</div>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Email</label>
              <div :class="readBox">{{ current.candidateEmail || 'Candidature interne, sans email' }}</div>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Téléphone</label>
              <div :class="readBox">{{ current.candidatePhone || '—' }}</div>
            </div>
          </div>
        </FormSection>

        <!-- Section Candidature -->
        <FormSection title="Candidature" :recaps="[current.jobOfferTitle || 'Candidature spontanée', formatDate(current.appliedAt)]">
          <div class="grid grid-cols-2 gap-x-6 gap-y-4 max-sm:grid-cols-1">
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Offre liée</label>
              <div :class="readBox">{{ current.jobOfferTitle || 'Candidature spontanée' }}</div>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">CV</label>
              <div :class="readBox">
                <span v-if="current.cvFileName" class="inline-flex items-center gap-1.5 truncate"><FileText class="w-3.5 h-3.5 shrink-0" />{{ current.cvFileName }}</span>
                <span v-else class="text-muted-foreground">Dossier employé existant</span>
              </div>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Date de candidature</label>
              <div :class="readBox">{{ formatDate(current.appliedAt) }}</div>
            </div>
          </div>
        </FormSection>

        <!-- Section Notes -->
        <FormSection title="Notes" :recaps="[`${current.notes.length} note(s)`]">
          <div class="flex flex-col gap-2">
            <div v-if="current.notes.length === 0" class="text-xs text-muted-foreground italic">Aucune note pour le moment.</div>
            <div v-for="(note, i) in current.notes" :key="i" class="text-[13px] bg-background rounded-md px-3 py-2 flex flex-col gap-0.5">
              <div class="flex items-center justify-between gap-2">
                <span class="font-medium text-foreground text-xs truncate">{{ note.authorName }}</span>
                <span class="text-[11px] text-muted-foreground shrink-0">{{ formatDate(note.date) }}</span>
              </div>
              <p class="text-foreground whitespace-pre-line">{{ note.text }}</p>
            </div>
            <div :class="cls.field" class="mt-1">
              <label :class="cls.fieldLabel">Ajouter une note</label>
              <textarea v-model="noteDraft" :class="cls.fieldTextarea" rows="3" placeholder="Ajouter une note…"></textarea>
            </div>
            <button :class="cls.btnOutline" class="self-end" :disabled="!noteDraft.trim()" @click="addNote">
              <Plus class="w-3.5 h-3.5" /> Ajouter
            </button>
          </div>
        </FormSection>
      </div>
    </template>
  </CardModalShell>
</template>
