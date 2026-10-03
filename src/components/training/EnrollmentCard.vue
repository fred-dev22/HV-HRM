<script setup lang="ts">
/**
 * Fiche d'une inscription / demande de formation, sur CardModalShell.
 * Module Formation (backend /training, voir src/stores/training).
 */
import { ref, computed, watch } from 'vue'
import CardModalShell from '../shared/CardModalShell.vue'
import StatusPill from '../ui/StatusPill.vue'
import FormSection from '../ui/form-field/FormSection.vue'
import * as cls from '../../lib/formClasses'
import { formatDate } from '../../lib/date'
import { runAction } from '../../lib/runAction'
import { useEnrollmentStore } from '../../stores/training'
import type { Enrollment } from '../../stores/training'

const props = defineProps<{
  items: Enrollment[]
  itemId: string
}>()

const emit = defineEmits<{ close: [] }>()

const enrollmentStore = useEnrollmentStore()

const readBox = 'text-[13px] text-foreground bg-background border border-border rounded-md px-2.5 h-[38px] flex items-center'

const currentId = ref(props.itemId)
watch(() => props.itemId, (v) => { currentId.value = v })

const current = computed<Enrollment | null>(() => props.items.find(e => e.id === currentId.value) ?? null)
const currentIndex = computed(() => props.items.findIndex(e => e.id === currentId.value))
const hasPrev = computed(() => currentIndex.value > 0)
const hasNext = computed(() => currentIndex.value >= 0 && currentIndex.value < props.items.length - 1)

const sidebarItems = computed(() => props.items.map((e, i) => ({ no: String(i + 1), label: e.employeeName })))
const currentNo = computed(() => (currentIndex.value >= 0 ? String(currentIndex.value + 1) : null))

function goPrev() { if (hasPrev.value) currentId.value = props.items[currentIndex.value - 1]!.id }
function goNext() { if (hasNext.value) currentId.value = props.items[currentIndex.value + 1]!.id }
function selectSidebar(no: string) {
  const e = props.items[Number(no) - 1]
  if (e) currentId.value = e.id
}

function approve() {
  if (!current.value) return
  const id = current.value.id
  return runAction('Approbation…', () => enrollmentStore.approve(id), 'Approbation impossible')
}
function reject() {
  if (!current.value) return
  const id = current.value.id
  return runAction('Refus…', () => enrollmentStore.reject(id), 'Refus impossible')
}
function markAttended() {
  if (!current.value) return
  const id = current.value.id
  return runAction('Enregistrement…', () => enrollmentStore.markAttended(id), 'Enregistrement impossible')
}
</script>

<template>
  <CardModalShell
    v-if="current"
    :page-title="current.employeeName"
    banner-label="Inscription"
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
      <button v-if="current.status === 'Requested'" type="button" :class="cls.btnPrimary" @click="approve">Approuver</button>
      <button v-if="current.status === 'Requested'" type="button" :class="cls.btnOutline" @click="reject">Refuser</button>
      <button v-if="current.status === 'Approved'" type="button" :class="cls.btnPrimary" @click="markAttended">Marquer présent</button>
    </template>

    <template #form>
      <div class="px-6 py-5 max-w-4xl">
        <FormSection title="Inscription" :recaps="[current.courseTitle]">
          <div class="grid grid-cols-2 gap-x-6 gap-y-4 max-sm:grid-cols-1">
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Employé</label>
              <div :class="readBox">{{ current.employeeName }}</div>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Entité</label>
              <div :class="readBox">{{ current.entityName }}</div>
            </div>
            <div :class="cls.field" class="col-span-2">
              <label :class="cls.fieldLabel">Formation</label>
              <div :class="readBox">{{ current.courseTitle }}</div>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Session</label>
              <div :class="readBox">{{ formatDate(current.sessionScheduledAt) }}</div>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Demandée par</label>
              <div :class="readBox">{{ current.requestedByName }}</div>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Demandée le</label>
              <div :class="readBox">{{ formatDate(current.requestedAt) }}</div>
            </div>
          </div>
        </FormSection>

        <FormSection v-if="current.hotEvaluation" title="Évaluation à chaud" :recaps="[`${current.hotEvaluation.score}/5`]">
          <div class="grid grid-cols-2 gap-x-6 gap-y-4 max-sm:grid-cols-1">
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Note</label>
              <div :class="readBox">{{ current.hotEvaluation.score }}/5</div>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Date</label>
              <div :class="readBox">{{ formatDate(current.hotEvaluation.date) }}</div>
            </div>
            <div :class="cls.field" class="col-span-2">
              <label :class="cls.fieldLabel">Commentaire</label>
              <p class="text-[13px] text-foreground whitespace-pre-line">{{ current.hotEvaluation.comment }}</p>
            </div>
          </div>
        </FormSection>

        <FormSection v-if="current.coldEvaluation" title="Évaluation à froid" :recaps="[`${current.coldEvaluation.score}/5`]">
          <div class="grid grid-cols-2 gap-x-6 gap-y-4 max-sm:grid-cols-1">
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Note</label>
              <div :class="readBox">{{ current.coldEvaluation.score }}/5</div>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Date</label>
              <div :class="readBox">{{ formatDate(current.coldEvaluation.date) }}</div>
            </div>
            <div :class="cls.field" class="col-span-2">
              <label :class="cls.fieldLabel">Commentaire</label>
              <p class="text-[13px] text-foreground whitespace-pre-line">{{ current.coldEvaluation.comment }}</p>
            </div>
          </div>
        </FormSection>
      </div>
    </template>
  </CardModalShell>
</template>
