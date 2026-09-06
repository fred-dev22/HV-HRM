<script setup lang="ts">
/**
 * Fiche d'un entretien (lecture seule), sur CardModalShell, pattern
 * frontdesk. Pas de mode édition dans ce module (design uniquement, voir
 * src/stores/recruitment). Navigateur de N° à gauche numéroté par position
 * dans la liste courante : Interview n'a pas de code de référence propre.
 */
import { ref, computed, watch } from 'vue'
import { MapPin, Video, CalendarPlus } from 'lucide-vue-next'
import CardModalShell from '../shared/CardModalShell.vue'
import StatusPill from '../ui/StatusPill.vue'
import FormSection from '../ui/form-field/FormSection.vue'
import InterviewWorkflowActions from './InterviewWorkflowActions.vue'
import * as cls from '../../lib/formClasses'
import { googleCalendarUrl, outlookCalendarUrl, downloadIcs } from '../../lib/calendarLinks'
import type { Interview } from '../../stores/recruitment'

const props = defineProps<{
  /** Entretiens de la liste courante (déjà filtrée par la vue), pour la navigation N° */
  items: Interview[]
  /** Entretien affiché */
  itemId: string
}>()

const emit = defineEmits<{ close: [] }>()

const readBox = 'text-[13px] text-foreground bg-background border border-border rounded-md px-2.5 h-[38px] flex items-center'

const currentId = ref(props.itemId)
watch(() => props.itemId, (v) => { currentId.value = v })

const current = computed<Interview | null>(() => props.items.find(i => i.id === currentId.value) ?? null)
const currentIndex = computed(() => props.items.findIndex(i => i.id === currentId.value))
const hasPrev = computed(() => currentIndex.value > 0)
const hasNext = computed(() => currentIndex.value >= 0 && currentIndex.value < props.items.length - 1)

// Numérotation par position (1, 2, 3…) : la seule numérotation stable
// disponible ici, faute de référence métier sur l'entretien lui-même.
const sidebarItems = computed(() => props.items.map((i, idx) => ({ no: String(idx + 1), label: i.candidateName })))
const currentNo = computed(() => (currentIndex.value >= 0 ? String(currentIndex.value + 1) : null))

function goPrev() { if (hasPrev.value) currentId.value = props.items[currentIndex.value - 1]!.id }
function goNext() { if (hasNext.value) currentId.value = props.items[currentIndex.value + 1]!.id }
function selectSidebar(no: string) {
  const i = props.items[Number(no) - 1]
  if (i) currentId.value = i.id
}

/* ── Formatage date et heure (ex : "25/08/2026 10:00") ─────────── */
function formatDateTime(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso)
  if (!m) return iso
  const [, y, mo, d, h, mi] = m
  return `${d}/${mo}/${y} ${h}:${mi}`
}

// Ajout au calendrier — voir lib/calendarLinks.ts : aucun backend ni OAuth
// necessaire, Google/Outlook exposent une URL publique "ajouter un
// evenement", et le .ics s'ouvre dans n'importe quelle appli de calendrier.
// Le candidat est toujours invite (son email est connu). Les participants
// ne le sont que s'ils ont un email renseigne au moment de la planification.
function calendarEvent(i: Interview) {
  const attendees = [i.candidateEmail, ...i.participants.map(p => p.email)].filter((e): e is string => !!e)
  return {
    title: `Entretien · ${i.candidateName} (${i.jobOfferTitle})`,
    description: `Entretien de recrutement pour le poste de ${i.jobOfferTitle}.\nParticipants : ${i.participants.map(p => p.name).join(', ')}${i.mode === 'VideoCall' ? `\nLien : ${i.meetingLink}` : ''}`,
    location: i.mode === 'VideoCall' ? i.meetingLink : i.location,
    startIso: i.scheduledAt,
    attendees,
  }
}
function addToGoogle() { if (current.value) window.open(googleCalendarUrl(calendarEvent(current.value)), '_blank', 'noopener') }
function addToOutlook() { if (current.value) window.open(outlookCalendarUrl(calendarEvent(current.value)), '_blank', 'noopener') }
function downloadIcsFile() { if (current.value) downloadIcs(calendarEvent(current.value), `entretien-${current.value.candidateName.replace(/\s+/g, '-').toLowerCase()}`) }
</script>

<template>
  <CardModalShell
    v-if="current"
    :page-title="current.candidateName"
    banner-label="Entretien"
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
      <InterviewWorkflowActions :item="current" />
    </template>

    <template #form>
      <div class="px-6 py-5 max-w-4xl">
        <!-- Section Entretien -->
        <FormSection title="Entretien" :recaps="[current.jobOfferTitle, formatDateTime(current.scheduledAt)]">
          <div class="grid grid-cols-2 gap-x-6 gap-y-4 max-sm:grid-cols-1">
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Candidat</label>
              <div :class="readBox">{{ current.candidateName }}</div>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Offre</label>
              <div :class="readBox">{{ current.jobOfferTitle }}</div>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Date et heure</label>
              <div :class="readBox">{{ formatDateTime(current.scheduledAt) }}</div>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">{{ current.mode === 'VideoCall' ? 'Visioconférence' : 'Lieu' }}</label>
              <div v-if="current.mode === 'VideoCall'" :class="readBox">
                <a :href="current.meetingLink" target="_blank" rel="noopener" class="flex items-center gap-1.5 text-primary hover:underline truncate">
                  <Video class="w-3.5 h-3.5 shrink-0" /> {{ current.meetingLink }}
                </a>
              </div>
              <div v-else :class="readBox">
                <span class="flex items-center gap-1.5"><MapPin class="w-3.5 h-3.5 shrink-0 text-muted-foreground" /> {{ current.location }}</span>
              </div>
            </div>
            <div :class="cls.field" class="col-span-2">
              <label :class="cls.fieldLabel">Participants</label>
              <div :class="[readBox, 'h-auto min-h-[38px] py-2 flex-wrap gap-x-1.5']">
                <span v-for="(p, idx) in current.participants" :key="p.name">
                  {{ p.name }}<span v-if="!p.email" class="text-muted-foreground/70" title="Pas d'email renseigné : ne sera pas invité automatiquement au calendrier"> (sans email)</span><span v-if="idx < current.participants.length - 1">, </span>
                </span>
              </div>
            </div>
          </div>

          <div class="mt-4 pt-4 border-t border-border">
            <p class="text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em] mb-2 flex items-center gap-1.5">
              <CalendarPlus class="w-3.5 h-3.5" /> Ajouter à mon calendrier
            </p>
            <p class="text-[11px] text-muted-foreground mb-2">
              Invite automatiquement {{ current.candidateName }}{{ current.participants.filter(p => p.email).length ? ` et ${current.participants.filter(p => p.email).length} participant(s)` : '' }} dès l'enregistrement de l'événement.
            </p>
            <div class="flex items-center gap-2 flex-wrap">
              <button type="button" :class="cls.btnOutline" @click="addToGoogle">Google Calendar</button>
              <button type="button" :class="cls.btnOutline" @click="addToOutlook">Outlook</button>
              <button type="button" :class="cls.btnOutline" @click="downloadIcsFile">Télécharger (.ics)</button>
            </div>
          </div>
        </FormSection>

        <!-- Section Évaluation -->
        <FormSection v-if="current.evaluation" title="Évaluation" :recaps="[`${current.evaluation.score}/5`, current.evaluation.interviewerName]">
          <div class="grid grid-cols-2 gap-x-6 gap-y-4 max-sm:grid-cols-1">
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Note{{ current.evaluation.templateName ? ' globale' : '' }}</label>
              <div :class="readBox">{{ current.evaluation.score }} / 5</div>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Évaluateur</label>
              <div :class="readBox">{{ current.evaluation.interviewerName }}</div>
            </div>
            <div v-if="current.evaluation.templateName" :class="cls.field" class="col-span-2">
              <label :class="cls.fieldLabel">Grille utilisée</label>
              <div :class="readBox">{{ current.evaluation.templateName }}</div>
            </div>
            <div v-if="current.evaluation.criteriaScores && current.evaluation.criteriaScores.length > 0" class="col-span-2 grid grid-cols-2 gap-2">
              <div v-for="c in current.evaluation.criteriaScores" :key="c.label" class="flex items-center justify-between bg-background border border-border rounded-md px-2.5 h-[34px] text-[13px]">
                <span class="text-muted-foreground truncate">{{ c.label }}</span>
                <span class="font-medium text-foreground shrink-0">{{ c.score }} / 5</span>
              </div>
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
