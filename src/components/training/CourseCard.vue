<script setup lang="ts">
/**
 * Fiche d'une formation du catalogue, sur CardModalShell. Module Formation
 * (design uniquement, données fictives, voir src/stores/training), calquée
 * sur JobOfferCard.vue.
 */
import { ref, computed, watch } from 'vue'
import { Coins, CalendarDays, Building2 } from 'lucide-vue-next'
import CardModalShell from '../shared/CardModalShell.vue'
import StatusPill from '../ui/StatusPill.vue'
import FormSection from '../ui/form-field/FormSection.vue'
import * as cls from '../../lib/formClasses'
import { formatDate } from '../../lib/date'
import { useCourseStore, useSessionStore } from '../../stores/training'
import type { Course } from '../../stores/training'

const props = defineProps<{
  items: Course[]
  itemId: string
}>()

const emit = defineEmits<{ close: [] }>()

const courseStore = useCourseStore()
const sessionStore = useSessionStore()

const readBox = 'text-[13px] text-foreground bg-background border border-border rounded-md px-2.5 h-[38px] flex items-center'

const currentId = ref(props.itemId)
watch(() => props.itemId, (v) => { currentId.value = v })

const current = computed<Course | null>(() => props.items.find(c => c.id === currentId.value) ?? null)
const currentIndex = computed(() => props.items.findIndex(c => c.id === currentId.value))
const hasPrev = computed(() => currentIndex.value > 0)
const hasNext = computed(() => currentIndex.value >= 0 && currentIndex.value < props.items.length - 1)

const sidebarItems = computed(() => props.items.map((c, i) => ({ no: String(i + 1), label: c.title })))
const currentNo = computed(() => (currentIndex.value >= 0 ? String(currentIndex.value + 1) : null))

function goPrev() { if (hasPrev.value) currentId.value = props.items[currentIndex.value - 1]!.id }
function goNext() { if (hasNext.value) currentId.value = props.items[currentIndex.value + 1]!.id }
function selectSidebar(no: string) {
  const c = props.items[Number(no) - 1]
  if (c) currentId.value = c.id
}

function formatMga(n: number): string { return `${n.toLocaleString('fr-FR')} MGA` }
const budgetPct = computed(() => {
  if (!current.value || current.value.budgetAllocated === 0) return 0
  return Math.min(100, Math.round((current.value.budgetUsed / current.value.budgetAllocated) * 100))
})

const courseSessions = computed(() =>
  current.value ? sessionStore.items.filter(s => s.courseId === current.value!.id)
    .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt)) : [])

function startCourse() { if (current.value) courseStore.setStatus(current.value.id, 'InProgress') }
function archiveCourse() { if (current.value) courseStore.setStatus(current.value.id, 'Archived') }
function reopenCourse() { if (current.value) courseStore.setStatus(current.value.id, 'InProgress') }
</script>

<template>
  <CardModalShell
    v-if="current"
    :page-title="current.title"
    banner-label="Formation"
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
      <button v-if="current.status === 'InPreparation'" type="button" :class="cls.btnPrimary" @click="startCourse">Démarrer la formation</button>
      <button v-if="current.status === 'InProgress'" type="button" :class="cls.btnOutline" @click="archiveCourse">Archiver</button>
      <button v-if="current.status === 'Archived'" type="button" :class="cls.btnOutline" @click="reopenCourse">Réactiver</button>
    </template>

    <template #form>
      <div class="px-6 py-5 max-w-4xl">
        <FormSection title="Formation" :recaps="[current.category, `${current.durationHours} h`]">
          <div class="grid grid-cols-2 gap-x-6 gap-y-4 max-sm:grid-cols-1">
            <div :class="cls.field" class="col-span-2">
              <label :class="cls.fieldLabel">Intitulé</label>
              <div :class="readBox">{{ current.title }}</div>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Référence</label>
              <div :class="readBox" class="font-mono text-xs">{{ current.referenceCode }}</div>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Catégorie</label>
              <div :class="readBox">{{ current.category }}</div>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Durée</label>
              <div :class="readBox">{{ current.durationHours }} h</div>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Effectif maximum</label>
              <div :class="readBox">{{ current.maxParticipants }} participant(s)</div>
            </div>
            <div :class="cls.field" class="col-span-2">
              <label :class="cls.fieldLabel">Prestataire</label>
              <div :class="readBox">
                <Building2 class="w-3.5 h-3.5 text-primary mr-1.5 shrink-0" /> {{ current.providerName ?? 'Non défini' }}
              </div>
            </div>
          </div>
        </FormSection>

        <FormSection title="Description">
          <p class="text-[13px] text-foreground whitespace-pre-line">{{ current.description }}</p>
        </FormSection>

        <FormSection title="Budget" :recaps="[`${formatMga(current.budgetUsed)} / ${formatMga(current.budgetAllocated)}`]">
          <div class="flex items-center gap-2 mb-2">
            <Coins class="w-4 h-4 text-muted-foreground" />
            <span class="text-[13px] font-medium text-foreground">{{ formatMga(current.budgetUsed) }} sur {{ formatMga(current.budgetAllocated) }}</span>
            <span class="text-[11px] text-muted-foreground">({{ budgetPct }}%)</span>
          </div>
          <div class="h-2 rounded-full bg-neutral-bg overflow-hidden">
            <div class="h-full bg-primary rounded-full" :style="{ width: `${budgetPct}%` }" />
          </div>
        </FormSection>

        <FormSection title="Sessions" :recaps="[`${courseSessions.length} session(s)`]">
          <p v-if="courseSessions.length === 0" class="text-[12px] text-muted-foreground">Aucune session planifiée pour cette formation.</p>
          <div v-else class="flex flex-col gap-1.5">
            <div v-for="s in courseSessions" :key="s.id" class="flex items-center justify-between gap-3 px-2.5 py-2 rounded-md border border-border bg-background">
              <div class="min-w-0 flex items-center gap-2">
                <CalendarDays class="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <div class="min-w-0">
                  <div class="text-[13px] font-medium text-foreground truncate">{{ formatDate(s.scheduledAt) }} · {{ s.trainerName }}</div>
                  <div class="text-[11px] text-muted-foreground truncate">{{ s.enrolledCount }}/{{ s.capacity }} inscrits</div>
                </div>
              </div>
              <StatusPill :status="s.status" />
            </div>
          </div>
        </FormSection>
      </div>
    </template>
  </CardModalShell>
</template>
