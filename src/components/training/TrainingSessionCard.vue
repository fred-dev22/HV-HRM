<script setup lang="ts">
/**
 * Fiche d'une session planifiée, sur CardModalShell. Module Formation
 * (backend /training, voir src/stores/training).
 */
import { ref, computed, watch, onMounted } from 'vue'
import { MapPin, Video, Users } from 'lucide-vue-next'
import CardModalShell from '../shared/CardModalShell.vue'
import StatusPill from '../ui/StatusPill.vue'
import FormSection from '../ui/form-field/FormSection.vue'
import * as cls from '../../lib/formClasses'
import { runAction, loadAll } from '../../lib/runAction'
import { useSessionStore, useEnrollmentStore } from '../../stores/training'
import type { TrainingSession } from '../../stores/training'

const props = defineProps<{
  items: TrainingSession[]
  itemId: string
}>()

const emit = defineEmits<{ close: [] }>()

const sessionStore = useSessionStore()
const enrollmentStore = useEnrollmentStore()

const readBox = 'text-[13px] text-foreground bg-background border border-border rounded-md px-2.5 h-[38px] flex items-center'

const currentId = ref(props.itemId)
watch(() => props.itemId, (v) => { currentId.value = v })

const current = computed<TrainingSession | null>(() => props.items.find(s => s.id === currentId.value) ?? null)
const currentIndex = computed(() => props.items.findIndex(s => s.id === currentId.value))
const hasPrev = computed(() => currentIndex.value > 0)
const hasNext = computed(() => currentIndex.value >= 0 && currentIndex.value < props.items.length - 1)

const sidebarItems = computed(() => props.items.map((s, i) => ({ no: String(i + 1), label: s.courseTitle })))
const currentNo = computed(() => (currentIndex.value >= 0 ? String(currentIndex.value + 1) : null))

function goPrev() { if (hasPrev.value) currentId.value = props.items[currentIndex.value - 1]!.id }
function goNext() { if (hasNext.value) currentId.value = props.items[currentIndex.value + 1]!.id }
function selectSidebar(no: string) {
  const s = props.items[Number(no) - 1]
  if (s) currentId.value = s.id
}

function formatSessionDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) + ' à ' +
    d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

const sessionEnrollments = computed(() =>
  current.value ? enrollmentStore.items.filter(e => e.sessionId === current.value!.id) : [])

// La fiche liste les inscrits de la session : on les charge si l'écran parent ne l'a pas fait.
onMounted(() => { if (!enrollmentStore.loaded) loadAll(() => enrollmentStore.fetchAll()) })

function markDone() {
  if (!current.value) return
  const id = current.value.id
  return runAction('Mise à jour…', () => sessionStore.markDone(id), 'Action impossible')
}
function cancelSession() {
  if (!current.value) return
  const id = current.value.id
  return runAction('Annulation…', () => sessionStore.cancel(id), 'Annulation impossible')
}
</script>

<template>
  <CardModalShell
    v-if="current"
    :page-title="current.courseTitle"
    banner-label="Session"
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
      <button v-if="current.status === 'Scheduled'" type="button" :class="cls.btnPrimary" @click="markDone">Marquer terminée</button>
      <button v-if="current.status === 'Scheduled'" type="button" :class="cls.btnOutline" @click="cancelSession">Annuler la session</button>
    </template>

    <template #form>
      <div class="px-6 py-5 max-w-4xl">
        <FormSection title="Session" :recaps="[formatSessionDate(current.scheduledAt)]">
          <div class="grid grid-cols-2 gap-x-6 gap-y-4 max-sm:grid-cols-1">
            <div :class="cls.field" class="col-span-2">
              <label :class="cls.fieldLabel">Formation</label>
              <div :class="readBox">{{ current.courseTitle }}</div>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Référence</label>
              <div :class="readBox" class="font-mono text-xs">{{ current.referenceCode }}</div>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Formateur</label>
              <div :class="readBox">{{ current.trainerName }}</div>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Début</label>
              <div :class="readBox">{{ formatSessionDate(current.scheduledAt) }}</div>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Fin</label>
              <div :class="readBox">{{ formatSessionDate(current.endAt) }}</div>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Mode</label>
              <div :class="readBox">
                <component :is="current.mode === 'InPerson' ? MapPin : Video" class="w-3.5 h-3.5 text-primary mr-1.5 shrink-0" />
                {{ current.mode === 'InPerson' ? 'Présentiel' : 'Visioconférence' }}
              </div>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Capacité</label>
              <div :class="readBox">
                <Users class="w-3.5 h-3.5 text-muted-foreground mr-1.5 shrink-0" /> {{ current.enrolledCount }}/{{ current.capacity }}
              </div>
            </div>
            <div v-if="current.location" :class="cls.field" class="col-span-2">
              <label :class="cls.fieldLabel">Lieu</label>
              <div :class="readBox">{{ current.location }}</div>
            </div>
            <div v-if="current.meetingLink" :class="cls.field" class="col-span-2">
              <label :class="cls.fieldLabel">Lien de visioconférence</label>
              <div :class="readBox" class="truncate">{{ current.meetingLink }}</div>
            </div>
          </div>
        </FormSection>

        <FormSection title="Inscrits" :recaps="[`${sessionEnrollments.length} inscrit(s)`]">
          <p v-if="sessionEnrollments.length === 0" class="text-[12px] text-muted-foreground">Aucun inscrit pour cette session.</p>
          <div v-else class="flex flex-col gap-1.5">
            <div v-for="e in sessionEnrollments" :key="e.id" class="flex items-center justify-between gap-3 px-2.5 py-2 rounded-md border border-border bg-background">
              <div class="min-w-0">
                <div class="text-[13px] font-medium text-foreground truncate">{{ e.employeeName }}</div>
                <div class="text-[11px] text-muted-foreground truncate">{{ e.entityName }}</div>
              </div>
              <StatusPill :status="e.status" />
            </div>
          </div>
        </FormSection>
      </div>
    </template>
  </CardModalShell>
</template>
