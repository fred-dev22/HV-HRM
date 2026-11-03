<template>
  <CardModalShell
    v-if="current"
    :page-title="pageTitle"
    :page-number="entryNo(current)"
    banner-label="Fiche saisie de temps"
    :is-edit-mode="isEditMode"
    :is-saving="saving"
    :save-error="saveError"
    :show-edit="canEdit"
    :show-title-new-button="false"
    :sidebar-items="sidebarItems"
    :current-no="entryNo(current)"
    :has-prev="currentIndex > 0"
    :has-next="currentIndex >= 0 && currentIndex < entries.length - 1"
    :has-unsaved-changes="isEditMode"
    @close="emit('close')"
    @enter-edit="enterEdit"
    @cancel-edit="isEditMode = false"
    @save="save"
    @go-prev="go(currentIndex - 1)"
    @go-next="go(currentIndex + 1)"
    @select-sidebar="selectSidebar"
  >
    <template #title-badges>
      <StatusPill :status="current.status" />
    </template>

    <!-- Actions metier (mode lecture) -->
    <template v-if="!isEditMode" #action-buttons>
      <div class="flex items-center gap-2 flex-wrap">
        <template v-if="allowDecision && current.status === 'Pending'">
          <button :class="L.actApprove" :disabled="busy" @click="approve"><Check class="w-3.5 h-3.5" /> Approuver</button>
          <button :class="L.actReject" :disabled="busy" @click="rejecting = true"><X class="w-3.5 h-3.5" /> Rejeter</button>
        </template>
        <button v-if="canCancel" :class="L.actReject" :disabled="busy" @click="cancel">Annuler la saisie</button>
      </div>
    </template>

    <template #form>
      <div class="px-6 py-5 max-w-4xl">
        <FormSection title="Général" :recaps="[current.employeeName, current.entryType ? ENTRY_TYPE_LABELS[current.entryType] : '', formatHours(current.hours)]">
          <div class="grid grid-cols-2 gap-x-6 gap-y-4 max-sm:grid-cols-1">
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Employé</label>
              <div class="flex items-center gap-2 h-[38px]">
                <UserAvatar :name="current.employeeName" size="sm" />
                <span class="text-[13px] font-medium text-foreground">{{ current.employeeName }}</span>
                <span class="text-[11px] text-muted-foreground">{{ current.employeeNumber }}</span>
              </div>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Type de saisie</label>
              <select v-if="isEditMode" v-model="form.entryType" :class="cls.fieldSelect">
                <option v-for="(label, key) in ENTRY_TYPE_LABELS" :key="key" :value="key">{{ label }}</option>
              </select>
              <div v-else :class="readBox">{{ current.entryType ? ENTRY_TYPE_LABELS[current.entryType] : '-' }}</div>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Date</label>
              <input v-if="isEditMode" v-model="form.date" type="date" :class="cls.fieldInput" />
              <div v-else :class="readBox">{{ formatDate(current.date) }}</div>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Durée</label>
              <div :class="readBox">{{ formatHours(isEditMode && needsTimes && formDuration > 0 ? formDuration : current.hours) }}</div>
            </div>
          </div>
        </FormSection>

        <FormSection title="Horaires">
          <div class="grid grid-cols-2 gap-x-6 gap-y-4 max-sm:grid-cols-1">
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Entrée</label>
              <input v-if="isEditMode && needsTimes" v-model="form.start" type="time" :class="cls.fieldInput" />
              <div v-else :class="readBox">{{ clock(current.clockIn) }}</div>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Sortie</label>
              <input v-if="isEditMode && needsTimes" v-model="form.end" type="time" :class="cls.fieldInput" />
              <div v-else :class="readBox">{{ clock(current.clockOut) }}</div>
            </div>
          </div>
          <p v-if="isEditMode && !needsTimes" class="text-[12px] text-muted-foreground mt-2">Un {{ ENTRY_TYPE_LABELS[form.entryType].toLowerCase() }} compte pour 1 par jour : aucun horaire.</p>
        </FormSection>

        <FormSection title="Suivi">
          <div class="grid grid-cols-2 gap-x-6 gap-y-4 max-sm:grid-cols-1">
            <div :class="cls.field"><label :class="cls.fieldLabel">Saisie le</label><div :class="readBox">{{ new Date(current.createdAt).toLocaleString('fr-FR') }}</div></div>
            <div :class="cls.field"><label :class="cls.fieldLabel">Saisie par</label><div :class="readBox">{{ current.submittedByName || '-' }}</div></div>
            <div :class="cls.field"><label :class="cls.fieldLabel">Décision de</label><div :class="readBox">{{ current.validatedByName || '-' }}</div></div>
            <div v-if="current.status === 'Rejected' && current.rejectionReason" :class="cls.field">
              <label :class="cls.fieldLabel">Motif du refus</label><div :class="readBox" class="!text-danger">{{ current.rejectionReason }}</div>
            </div>
          </div>
          <div :class="cls.field" class="mt-4">
            <label :class="cls.fieldLabel">Commentaire</label>
            <textarea v-if="isEditMode" v-model="form.comments" :class="cls.fieldTextarea" rows="3" maxlength="500"></textarea>
            <div v-else :class="readBox" class="!h-auto min-h-[38px] py-2">{{ current.comments || '-' }}</div>
          </div>
        </FormSection>

        <FormSection title="Historique" :default-open="false">
          <div v-if="loadingHistory" class="text-[12px] text-muted-foreground">Chargement...</div>
          <ul v-else class="flex flex-col gap-2">
            <li v-for="h in history" :key="h.id" class="flex items-start gap-2 text-[12px]">
              <span class="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0"></span>
              <span class="flex-1"><strong>{{ HISTORY_LABELS[h.action] ?? h.action }}</strong><span v-if="h.comment" class="text-muted-foreground"> : {{ h.comment }}</span></span>
              <span class="text-muted-foreground whitespace-nowrap">{{ new Date(h.createdAt).toLocaleString('fr-FR') }}</span>
            </li>
            <li v-if="history.length === 0" class="text-[12px] text-muted-foreground">Aucun événement.</li>
          </ul>
        </FormSection>
      </div>
    </template>
  </CardModalShell>

  <TimeRejectModal :open="rejecting" @close="rejecting = false" @confirm="reject" />
</template>

<script setup lang="ts">
/**
 * Fiche d'une saisie de temps, sur CardModalShell comme les autres fiches du
 * HRM : navigation dans la liste a gauche, mode lecture par defaut, edition
 * possible pour une saisie en attente ou refusee, historique des decisions.
 * Dans l'onglet Validation, le validateur approuve ou rejette depuis la fiche.
 */
import { ref, computed, reactive, watch } from 'vue'
import { Check, X } from 'lucide-vue-next'
import CardModalShell from '../shared/CardModalShell.vue'
import FormSection from '../ui/form-field/FormSection.vue'
import StatusPill from '../ui/StatusPill.vue'
import UserAvatar from '../ui/UserAvatar.vue'
import TimeRejectModal from './TimeRejectModal.vue'
import * as cls from '../../lib/formClasses'
import * as L from '../../lib/listClasses'
import { formatDate } from '../../lib/date'
import { getApiErrorMessage } from '../../lib/api'
import { confirmDialog } from '../../lib/confirm'
import { useToastStore } from '../../stores/toast'
import { useTimeStore, ENTRY_TYPE_LABELS, type TimeEntry, type TimeEntryHistoryItem } from '../../stores/time'
import { clock, formatHours, hoursBetween, toTimeInput, HISTORY_LABELS } from './timeFormat'

const props = defineProps<{
  /** Saisies de la liste courante (navigation entre fiches) */
  entries: TimeEntry[]
  entryId: string
  /** Le compte est RH (TEMPS_ACCES) : peut modifier et annuler toute saisie */
  isHr: boolean
  /** Affiche Approuver / Rejeter (onglet Validation) */
  allowDecision?: boolean
  /** Ouvre directement en mode edition */
  startInEdit?: boolean
}>()
const emit = defineEmits<{ close: []; changed: [] }>()

const store = useTimeStore()
const toast = useToastStore()

const currentId = ref(props.entryId)
watch(() => props.entryId, (v) => { currentId.value = v; isEditMode.value = false })

const current = computed<TimeEntry | null>(() => props.entries.find(e => e.id === currentId.value) ?? null)
const currentIndex = computed(() => props.entries.findIndex(e => e.id === currentId.value))

// Pas de reference metier sur une saisie : un N° court tire de son identifiant.
const entryNo = (e: TimeEntry) => `S-${e.id.slice(0, 8).toUpperCase()}`
const sidebarItems = computed(() => props.entries.map(e => ({ no: entryNo(e), label: `${e.employeeName} · ${formatDate(e.date)}` })))
const pageTitle = computed(() => (current.value ? `${current.value.employeeName} · ${formatDate(current.value.date)}` : ''))
const readBox = 'text-[13px] text-foreground bg-background border border-border rounded-md px-2.5 h-[38px] flex items-center'

function go(i: number) {
  const e = props.entries[i]
  if (e) { currentId.value = e.id; isEditMode.value = false }
}
function selectSidebar(no: string) {
  const e = props.entries.find(x => entryNo(x) === no)
  if (e) { currentId.value = e.id; isEditMode.value = false }
}

// Une saisie en attente ou refusee reste modifiable ; seule une saisie en attente s'annule.
const editable = computed(() => !!current.value && (current.value.status === 'Pending' || current.value.status === 'Rejected'))
const canEdit = computed(() => editable.value && (props.isHr || !props.allowDecision))
const canCancel = computed(() => !!current.value && current.value.status === 'Pending' && (props.isHr || !props.allowDecision))

// ── Historique ──
const history = ref<TimeEntryHistoryItem[]>([])
const loadingHistory = ref(false)
watch(() => [currentId.value, current.value?.status] as const, async ([id]) => {
  history.value = []
  if (!id) return
  loadingHistory.value = true
  try { history.value = await store.fetchHistory(id) } catch { history.value = [] } finally { loadingHistory.value = false }
}, { immediate: true })

// ── Edition ──
const isEditMode = ref(false)
const saving = ref(false)
const saveError = ref<string | null>(null)
const form = reactive({ entryType: 'travail_sur_site' as keyof typeof ENTRY_TYPE_LABELS, date: '', start: '', end: '', hours: 0, comments: '' })
const needsTimes = computed(() => form.entryType !== 'panier' && form.entryType !== 'permanence')
const formDuration = computed(() => hoursBetween(form.start, form.end))

function enterEdit() {
  const e = current.value
  if (!e) return
  Object.assign(form, { entryType: e.entryType ?? 'travail_sur_site', date: e.date, start: toTimeInput(e.clockIn), end: toTimeInput(e.clockOut), hours: e.hours, comments: e.comments ?? '' })
  saveError.value = null
  isEditMode.value = true
}
watch(() => props.startInEdit, (v) => { if (v && current.value && canEdit.value) enterEdit() }, { immediate: true })

async function save() {
  const e = current.value
  if (!e) return
  saveError.value = null
  const payload: Parameters<typeof store.updateEntry>[1] = { Date: form.date, EntryType: form.entryType, Comments: form.comments }
  if (!needsTimes.value) {
    payload.Hours = 1
  } else if (!e.clockIn && !form.start && !form.end) {
    payload.Hours = e.hours // saisie ancienne sans horaires : la duree est conservee
  } else {
    if (!form.start || !form.end) { saveError.value = 'Renseignez l\'heure de début et l\'heure de fin.'; return }
    if (formDuration.value <= 0) { saveError.value = 'L\'heure de fin doit être après l\'heure de début.'; return }
    payload.StartTime = form.start
    payload.EndTime = form.end
  }
  saving.value = true
  toast.loading('Enregistrement...')
  try {
    await store.updateEntry(e.id, payload)
    toast.success('Effectué avec succès')
    isEditMode.value = false
    emit('changed')
  } catch (err) {
    saveError.value = getApiErrorMessage(err, 'Enregistrement impossible')
    toast.error(saveError.value)
  } finally {
    saving.value = false
  }
}

// ── Decisions et annulation ──
const busy = ref(false)
const rejecting = ref(false)

async function act(label: string, action: () => Promise<unknown>, fallback: string) {
  busy.value = true
  toast.loading(label)
  try {
    await action()
    toast.success('Effectué avec succès')
    emit('changed')
  } catch (err) {
    toast.error(getApiErrorMessage(err, fallback))
  } finally {
    busy.value = false
  }
}
const approve = () => act('Approbation...', () => store.approve(current.value!.id), 'Approbation impossible')
async function reject(reason: string) {
  rejecting.value = false
  await act('Refus...', () => store.reject(current.value!.id, reason), 'Refus impossible')
}
async function cancel() {
  const e = current.value
  if (!e || !(await confirmDialog(`Annuler la saisie du ${formatDate(e.date)} (${e.employeeName}) ?`))) return
  await act('Annulation...', () => store.cancel(e.id), 'Annulation impossible')
}
</script>
