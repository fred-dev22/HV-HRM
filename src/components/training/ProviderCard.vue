<script setup lang="ts">
/**
 * Fiche d'un prestataire de formation, sur CardModalShell. Module Formation
 * (backend /training, voir src/stores/training).
 */
import { ref, computed, watch } from 'vue'
import { Mail, Phone, CalendarClock } from 'lucide-vue-next'
import CardModalShell from '../shared/CardModalShell.vue'
import StatusPill from '../ui/StatusPill.vue'
import FormSection from '../ui/form-field/FormSection.vue'
import ModalShell from '../ui/ModalShell.vue'
import * as cls from '../../lib/formClasses'
import { formatDate } from '../../lib/date'
import { runAction } from '../../lib/runAction'
import { useProviderStore } from '../../stores/training'
import type { Provider } from '../../stores/training'

const props = defineProps<{
  items: Provider[]
  itemId: string
}>()

const emit = defineEmits<{ close: [] }>()

const providerStore = useProviderStore()

const readBox = 'text-[13px] text-foreground bg-background border border-border rounded-md px-2.5 h-[38px] flex items-center'

const currentId = ref(props.itemId)
watch(() => props.itemId, (v) => { currentId.value = v })

const current = computed<Provider | null>(() => props.items.find(p => p.id === currentId.value) ?? null)
const currentIndex = computed(() => props.items.findIndex(p => p.id === currentId.value))
const hasPrev = computed(() => currentIndex.value > 0)
const hasNext = computed(() => currentIndex.value >= 0 && currentIndex.value < props.items.length - 1)

const sidebarItems = computed(() => props.items.map((p, i) => ({ no: String(i + 1), label: p.name })))
const currentNo = computed(() => (currentIndex.value >= 0 ? String(currentIndex.value + 1) : null))

function goPrev() { if (hasPrev.value) currentId.value = props.items[currentIndex.value - 1]!.id }
function goNext() { if (hasNext.value) currentId.value = props.items[currentIndex.value + 1]!.id }
function selectSidebar(no: string) {
  const p = props.items[Number(no) - 1]
  if (p) currentId.value = p.id
}

function toggleStatus() {
  if (!current.value) return
  const id = current.value.id
  const next = current.value.status === 'active' ? 'inactive' : 'active'
  return runAction('Mise à jour…', () => providerStore.setStatus(id, next), 'Mise à jour impossible')
}

const evalOpen = ref(false)
const evalScore = ref(5)
async function submitEvaluation() {
  if (!current.value) return
  const id = current.value.id
  const done = await runAction('Enregistrement…', () => providerStore.submitEvaluation(id, evalScore.value), 'Enregistrement impossible')
  if (done) evalOpen.value = false
}
</script>

<template>
  <CardModalShell
    v-if="current"
    :page-title="current.name"
    banner-label="Prestataire"
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
      <button type="button" :class="cls.btnPrimary" @click="evalOpen = true">Évaluer</button>
      <button type="button" :class="cls.btnOutline" @click="toggleStatus">{{ current.status === 'active' ? 'Désactiver' : 'Réactiver' }}</button>
    </template>

    <template #form>
      <div class="px-6 py-5 max-w-4xl">
        <FormSection title="Prestataire" :recaps="[current.specialties]">
          <div class="grid grid-cols-2 gap-x-6 gap-y-4 max-sm:grid-cols-1">
            <div :class="cls.field" class="col-span-2">
              <label :class="cls.fieldLabel">Nom</label>
              <div :class="readBox">{{ current.name }}</div>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Contact</label>
              <div :class="readBox">{{ current.contactName }}</div>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Téléphone</label>
              <div :class="readBox"><Phone class="w-3.5 h-3.5 text-muted-foreground mr-1.5 shrink-0" /> {{ current.phone }}</div>
            </div>
            <div :class="cls.field" class="col-span-2">
              <label :class="cls.fieldLabel">E-mail</label>
              <div :class="readBox"><Mail class="w-3.5 h-3.5 text-muted-foreground mr-1.5 shrink-0" /> {{ current.email }}</div>
            </div>
            <div :class="cls.field" class="col-span-2">
              <label :class="cls.fieldLabel">Spécialités</label>
              <div :class="readBox">{{ current.specialties }}</div>
            </div>
          </div>
        </FormSection>

        <FormSection title="Évaluation annuelle" :recaps="[current.lastEvaluationScore ? `${current.lastEvaluationScore}/5` : 'Aucune']">
          <div class="grid grid-cols-2 gap-x-6 gap-y-4 max-sm:grid-cols-1">
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Dernière note</label>
              <div :class="readBox">{{ current.lastEvaluationScore ? `${current.lastEvaluationScore}/5` : 'Aucune évaluation' }}</div>
            </div>
            <div :class="cls.field" v-if="current.lastEvaluationDate">
              <label :class="cls.fieldLabel">Évaluée le</label>
              <div :class="readBox">{{ formatDate(current.lastEvaluationDate) }}</div>
            </div>
            <div :class="cls.field" class="col-span-2">
              <label :class="cls.fieldLabel">Prochaine évaluation</label>
              <div :class="readBox"><CalendarClock class="w-3.5 h-3.5 text-primary mr-1.5 shrink-0" /> {{ formatDate(current.nextEvaluationDueAt) }}</div>
            </div>
          </div>
        </FormSection>
      </div>
    </template>
  </CardModalShell>

  <ModalShell :open="evalOpen" title="Évaluer le prestataire" @close="evalOpen = false">
    <div :class="cls.field">
      <label :class="cls.fieldLabel">Note (sur 5)</label>
      <select v-model.number="evalScore" :class="cls.fieldSelect">
        <option v-for="n in [5,4,3,2,1]" :key="n" :value="n">{{ n }}/5</option>
      </select>
    </div>
    <template #footer>
      <button :class="cls.btnOutline" @click="evalOpen = false">Annuler</button>
      <button :class="cls.btnPrimary" @click="submitEvaluation">Enregistrer</button>
    </template>
  </ModalShell>
</template>
