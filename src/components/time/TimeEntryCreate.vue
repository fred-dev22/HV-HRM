<template>
  <CreateModalShell
    title="Nouvelle saisie de temps"
    banner-label="Nouvelle saisie de temps"
    create-label="Soumettre la saisie"
    :save-error="error"
    :is-saving="saving"
    @close="emit('close')"
    @create="submit"
  >
    <template #form>
      <div class="flex-1 overflow-auto px-6 py-5">
        <div class="max-w-3xl mx-auto">
          <FormSection v-if="canCreateForOthers" title="Bénéficiaire">
            <ForWhomSelector v-model="forWhom" :available-employees="employeeItems" :can-create-for-others="canCreateForOthers" />
          </FormSection>

          <FormSection title="Détails de la saisie">
            <div class="flex flex-col gap-4">
              <div :class="cls.field">
                <label :class="cls.fieldLabel">Type de saisie <span class="text-danger">*</span></label>
                <select v-model="form.entryType" :class="cls.fieldSelect">
                  <option v-for="(label, key) in ENTRY_TYPE_LABELS" :key="key" :value="key">{{ label }}</option>
                </select>
              </div>

              <div :class="cls.field">
                <label :class="cls.fieldLabel">Date <span class="text-danger">*</span></label>
                <input v-model="form.date" type="date" :class="cls.fieldInput" />
              </div>

              <template v-if="needsTimes">
                <div :class="cls.fieldRow">
                  <div :class="cls.field">
                    <label :class="cls.fieldLabel">Heure de début</label>
                    <input v-model="form.start" type="time" :class="cls.fieldInput" />
                  </div>
                  <div :class="cls.field">
                    <label :class="cls.fieldLabel">Heure de fin</label>
                    <input v-model="form.end" type="time" :class="cls.fieldInput" />
                  </div>
                </div>
                <div v-if="duration > 0" class="flex"><span :class="cls.hintChipInfo">Durée : {{ formatHours(duration) }}</span></div>
                <div v-else-if="!!form.start !== !!form.end" class="flex"><span :class="cls.hintChipNeutral">Saisie incomplète : à compléter avant validation.</span></div>
              </template>
              <div v-else class="flex"><span :class="cls.hintChipNeutral">Compte pour 1 par jour : aucun horaire à saisir.</span></div>

              <div :class="cls.field">
                <label :class="cls.fieldLabel">Commentaire <span :class="cls.fieldOptional">(facultatif)</span></label>
                <textarea v-model="form.comments" :class="cls.fieldTextarea" rows="3" maxlength="500" placeholder="Ex. intervention sur site, correction oubli de pointage..."></textarea>
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
 * Creation d'une saisie de temps, sur CreateModalShell comme les autres
 * creations du HRM (absences, missions...). Le RH peut saisir pour un autre
 * employe, un manager pour son equipe ; la duree se deduit de l'heure de debut et
 * de fin (l'une des deux peut manquer, a completer ensuite) ; un panier ou une
 * permanence compte 1 par jour, sans horaire.
 */
import { computed, reactive, ref } from 'vue'
import CreateModalShell from '../shared/CreateModalShell.vue'
import FormSection from '../ui/form-field/FormSection.vue'
import ForWhomSelector from '../ui/ForWhomSelector.vue'
import type { BeneficiaryValue } from '../ui/ForWhomSelector.vue'
import * as cls from '../../lib/formClasses'
import { getApiErrorMessage } from '../../lib/api'
import { todayIso } from '../../lib/date'
import { useAuthStore } from '../../stores/auth'
import { useToastStore } from '../../stores/toast'
import { useTimeStore, ENTRY_TYPE_LABELS, type TimeEntryType, type TimeEntryEmployee } from '../../stores/time'
import { formatHours, hoursBetween } from './timeFormat'

const emit = defineEmits<{ close: []; saved: [] }>()

const auth = useAuthStore()
const store = useTimeStore()
const toast = useToastStore()

// Le RH saisit pour tout le monde, un manager pour son equipe ; les autres pour eux-memes.
const canCreateForOthers = computed(() => auth.hasAnyPermission(['TEMPS_ACCES', 'TEMPS_VALIDER']))
const canCreateForSelf = auth.hasAnyPermission(['TEMPS_ACCES', 'TEMPS_SAISIR'])
const forWhom = ref<BeneficiaryValue>({ mode: auth.user?.isSystem || !canCreateForSelf ? 'for-employee' : 'self', employeeId: '' })
// Liste chargee seulement a l'ouverture de cette fenetre (jamais a la connexion).
const employees = ref<TimeEntryEmployee[]>([])
if (canCreateForOthers.value) store.fetchEntryEmployees().then(list => (employees.value = list)).catch(() => {})
const employeeItems = computed(() =>
  employees.value
    .filter(e => e.id !== auth.user?.id)
    .map(e => ({ id: e.id, label: e.name, sublabel: e.entityName, code: e.code })),
)

const form = reactive({ entryType: 'travail_sur_site' as TimeEntryType, date: todayIso(), start: '', end: '', comments: '' })
const error = ref('')
const saving = ref(false)

const needsTimes = computed(() => form.entryType !== 'panier' && form.entryType !== 'permanence')
const duration = computed(() => hoursBetween(form.start, form.end))

async function submit() {
  error.value = ''
  if (forWhom.value.mode === 'for-employee' && !forWhom.value.employeeId) { error.value = 'Choisissez l\'employé concerné.'; return }
  if (!form.date) { error.value = 'La date est obligatoire.'; return }
  const payload: Parameters<typeof store.create>[0] = { Date: form.date, EntryType: form.entryType, Comments: form.comments || undefined }
  if (!needsTimes.value) {
    payload.Hours = 1
  } else {
    if (!form.start && !form.end) { error.value = 'Renseignez au moins l\'heure de début ou de fin.'; return }
    if (form.start && form.end && duration.value <= 0) { error.value = 'L\'heure de fin doit être après l\'heure de début.'; return }
    if (form.start) payload.StartTime = form.start
    if (form.end) payload.EndTime = form.end
  }
  if (forWhom.value.mode === 'for-employee') payload.EmployeeId = forWhom.value.employeeId
  saving.value = true
  toast.loading('Enregistrement...')
  try {
    await store.create(payload)
    toast.success('Effectué avec succès')
    emit('saved')
    emit('close')
  } catch (e) {
    error.value = getApiErrorMessage(e, 'Enregistrement impossible')
    toast.error(error.value)
  } finally {
    saving.value = false
  }
}
</script>
