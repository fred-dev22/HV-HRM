<template>
  <CreateModalShell
    v-if="open"
    title="Planifier un entretien"
    banner-label="Nouvel entretien"
    create-label="Planifier"
    :is-saving="submitting"
    :save-error="error"
    @close="emit('close')"
    @create="create"
  >
    <template #form>
      <div class="flex-1 overflow-auto px-6 py-5">
        <div class="max-w-3xl mx-auto">

          <FormSection title="Candidature">
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Candidature <span class="text-danger">*</span></label>
              <!-- Verrouillée quand ouvert depuis "Planifier" sur la fiche
                   candidature (ApplicationCard.vue) : pas besoin de la
                   rechercher, on sait déjà de laquelle il s'agit. -->
              <div v-if="preselectedApplication" :class="cls.fieldInput" class="flex items-center bg-background">
                {{ preselectedApplication.candidateName }} · {{ preselectedApplication.jobOfferTitle ?? 'Candidature spontanée' }}
              </div>
              <select v-else v-model="form.applicationId" :class="cls.fieldSelect">
                <option value="">Sélectionnez une candidature</option>
                <option v-for="a in eligibleApplications" :key="a.id" :value="a.id">{{ a.candidateName }} · {{ a.jobOfferTitle ?? 'Candidature spontanée' }}</option>
              </select>
            </div>
          </FormSection>

          <FormSection title="Entretien">
            <div class="grid grid-cols-2 gap-x-6 gap-y-4 max-sm:grid-cols-1">
              <div :class="cls.field">
                <label :class="cls.fieldLabel">Date et heure <span class="text-danger">*</span></label>
                <input type="datetime-local" v-model="form.scheduledAt" :class="cls.fieldInput" />
              </div>
              <div :class="cls.field">
                <label :class="cls.fieldLabel">Modalité <span class="text-danger">*</span></label>
                <div class="flex gap-1.5">
                  <button type="button" :class="[modeBtn, form.mode === 'InPerson' ? modeBtnActive : '']" @click="form.mode = 'InPerson'">
                    <MapPin class="w-3.5 h-3.5" /> Présentiel
                  </button>
                  <button type="button" :class="[modeBtn, form.mode === 'VideoCall' ? modeBtnActive : '']" @click="form.mode = 'VideoCall'">
                    <Video class="w-3.5 h-3.5" /> Visioconférence
                  </button>
                </div>
              </div>
              <div v-if="form.mode === 'InPerson'" :class="cls.field" class="col-span-2">
                <label :class="cls.fieldLabel">Lieu <span class="text-danger">*</span></label>
                <input v-model="form.location" :class="cls.fieldInput" placeholder="ex : Salle de réunion 2, Direction Générale…" />
              </div>
              <div v-else :class="cls.field" class="col-span-2">
                <label :class="cls.fieldLabel">Lien de la réunion <span class="text-danger">*</span></label>
                <input v-model="form.meetingLink" :class="cls.fieldInput" placeholder="ex : https://meet.google.com/xxx-xxxx-xxx ou lien Teams" />
                <p class="text-[11px] text-muted-foreground mt-1">Collez le lien Google Meet, Microsoft Teams, Zoom…</p>
              </div>
              <div :class="cls.field" class="col-span-2">
                <label :class="cls.fieldLabel">Participants <span class="text-danger">*</span></label>
                <TableLookupField
                  :code="participantPickerCode" :name="participantPickerName"
                  :columns="employeeLookupColumns"
                  :fetch-fn="fetchEmployeesForPicker"
                  value-key="id" name-key="label"
                  modal-title="Ajouter un participant"
                  placeholder="Rechercher un employé (code, nom, entité)…"
                  :is-item-disabled="(item) => item.status && item.status !== 'active'"
                  :item-disabled-reason="() => 'compte désactivé'"
                  @update:code="participantPickerCode = $event"
                  @update:name="participantPickerName = $event"
                  @select="onAddParticipant"
                />
                <div v-if="form.participants.length" class="flex flex-col gap-1.5 mt-2">
                  <div v-for="(p, idx) in form.participants" :key="p.employeeId" class="flex items-center gap-2 bg-background border border-border rounded-md px-2.5 h-[34px]">
                    <span class="text-[13px] text-foreground flex-1 truncate">{{ p.name }}</span>
                    <button type="button" class="text-muted-foreground hover:text-danger cursor-pointer" title="Retirer" @click="form.participants.splice(idx, 1)">
                      <X class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <p class="text-[11px] text-muted-foreground mt-1">Recherchez et ajoutez un ou plusieurs employés déjà enregistrés dans le système.</p>
              </div>
            </div>
          </FormSection>

        </div>
      </div>
    </template>
  </CreateModalShell>
</template>

<script setup lang="ts">
/**
 * Formulaire de planification d'un entretien, extrait de InterviewsView.vue
 * (retour client du 19/09) pour être réutilisable depuis la fiche
 * candidature (ApplicationCard.vue, bouton "Planifier") en plus de l'écran
 * "Entretiens" : même logique, la seule différence est la candidature
 * pré-sélectionnée/verrouillée ou choisie dans une liste.
 */
import { ref, reactive, computed, watch } from 'vue'
import { MapPin, Video, X } from 'lucide-vue-next'
import CreateModalShell from '../shared/CreateModalShell.vue'
import FormSection from '../ui/form-field/FormSection.vue'
import TableLookupField from '../ui/table-lookup/TableLookupField.vue'
import type { LookupColumn, LookupFetchParams } from '../ui/table-lookup/TableLookupField.vue'
import * as cls from '../../lib/formClasses'
import { getApiErrorMessage } from '../../lib/api'
import { withToast } from '../../lib/withToast'
import { useSubmitGuard } from '../../lib/submitGuard'
import { useInterviewStore, useApplicationStore } from '../../stores/recruitment'
import type { InterviewMode, InterviewParticipant } from '../../stores/recruitment'
import { useEmployeeStore } from '../../stores/employees'

const props = defineProps<{
  open: boolean
  /** Verrouille la candidature (ouvert depuis "Planifier" sur ApplicationCard.vue). */
  preselectedApplicationId?: string
}>()
const emit = defineEmits<{ close: []; created: [] }>()

const interviewStore = useInterviewStore()
const applicationStore = useApplicationStore()
const employeeStore = useEmployeeStore()
if (employeeStore.directory.length === 0) employeeStore.fetchDirectory()
if (applicationStore.items.length === 0) applicationStore.fetchAll()

const modeBtn = 'flex-1 h-[38px] px-2.5 rounded-md border border-border bg-background text-muted-foreground text-[13px] font-medium cursor-pointer inline-flex items-center justify-center gap-1.5 transition-colors hover:text-foreground'
const modeBtnActive = '!bg-primary/10 !text-primary !border-primary/30'

// Non filtree par statut (contrairement au selecteur libre ci-dessous) : un
// candidat deja "InterviewScheduled" peut tres bien avoir besoin d'un
// deuxieme entretien (technique, culture...), voir retour client du 19/09.
const preselectedApplication = computed(() =>
  props.preselectedApplicationId ? applicationStore.items.find(a => a.id === props.preselectedApplicationId) : undefined)

const eligibleApplications = computed(() => applicationStore.items.filter(a => a.status === 'New' || a.status === 'InReview'))

const employeeLookupColumns: LookupColumn[] = [
  { key: 'code', label: 'Code', width: '90px' },
  { key: 'label', label: 'Nom' },
  { key: 'sublabel', label: 'Entité' },
]
function fetchEmployeesForPicker(params: LookupFetchParams) {
  const q = (params.searchQuery ?? '').toLowerCase()
  let rows = employeeStore.directory.map(e => ({ id: e.id, code: e.code, label: e.name, sublabel: e.entityName, status: e.status }))
  if (q) {
    rows = rows.filter(e =>
      e.label.toLowerCase().includes(q) || (e.sublabel ?? '').toLowerCase().includes(q) || (e.code ?? '').toLowerCase().includes(q),
    )
  }
  const total = rows.length
  const start = (params.page - 1) * params.pageSize
  return { items: rows.slice(start, start + params.pageSize), total }
}
const participantPickerCode = ref('')
const participantPickerName = ref('')
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function onAddParticipant(item: any) {
  const employeeId = String(item.id)
  if (!form.participants.some(p => p.employeeId === employeeId)) {
    form.participants.push({ employeeId, name: String(item.label) })
  }
  participantPickerCode.value = ''
  participantPickerName.value = ''
}

const error = ref<string | null>(null)
const form = reactive({
  applicationId: '', scheduledAt: '', mode: 'InPerson' as InterviewMode, location: '', meetingLink: '',
  participants: [] as InterviewParticipant[],
})

function resetForm() {
  Object.assign(form, {
    applicationId: props.preselectedApplicationId ?? '',
    scheduledAt: '', mode: 'InPerson', location: '', meetingLink: '', participants: [],
  })
  participantPickerCode.value = ''
  participantPickerName.value = ''
  error.value = null
}
watch(() => props.open, (o) => { if (o) resetForm() }, { immediate: true })

function validate(): boolean {
  if (!form.applicationId) { error.value = 'Sélectionnez une candidature'; return false }
  if (!form.scheduledAt) { error.value = 'La date et l\'heure sont requises'; return false }
  if (form.mode === 'InPerson' && !form.location.trim()) { error.value = 'Le lieu est requis'; return false }
  if (form.mode === 'VideoCall' && !form.meetingLink.trim()) { error.value = 'Le lien de la réunion est requis'; return false }
  if (!form.participants.length) { error.value = 'Au moins un participant est requis'; return false }
  error.value = null
  return true
}

function buildPayload() {
  return {
    applicationId: form.applicationId,
    scheduledAt: form.scheduledAt,
    mode: form.mode,
    location: form.mode === 'InPerson' ? form.location.trim() : undefined,
    meetingLink: form.mode === 'VideoCall' ? form.meetingLink.trim() : undefined,
    participants: form.participants,
  }
}

const { submitting, guard } = useSubmitGuard()
async function create() {
  if (!validate()) return
  try {
    await guard(() => withToast('Planification...', () => interviewStore.schedule(buildPayload()), () => 'Planification impossible'))
    emit('created')
    emit('close')
  } catch (e) {
    error.value = getApiErrorMessage(e, 'Planification impossible')
  }
}
</script>
