<script setup lang="ts">
import { reactive, computed, watch, ref } from 'vue'
import { Check, Pipette } from 'lucide-vue-next'
import CreateModalShell from '../shared/CreateModalShell.vue'
import FormSection from '../ui/form-field/FormSection.vue'
import EligibilityFields from '../ui/form-field/EligibilityFields.vue'
import * as cls from '../../lib/formClasses'
import { useLeaveTypesStore } from '../../stores/leaveTypes'
import type { LeaveTypeConfig } from '../../stores/leaveTypes'
import { useEntityStore } from '../../stores/entities'

const props = defineProps<{
  editId?: string
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const store  = useLeaveTypesStore()
const entityStore = useEntityStore()
if (entityStore.entities.length === 0) entityStore.fetchAll()
const isEdit = computed(() => !!props.editId)
const error  = ref('')

const COLOR_OPTIONS = [
  '#EF463B','#C8102E','#993556','#185FA5',
  '#854F0B','#8A5A0A','#2D7A3F','#5C3B8A',
]

const form = reactive({
  name:             '',
  code:             '',
  daysPerYear:      0,
  monthlyAccrual:   false,
  noticeDays:       0,
  documentRequired: false,
  documentDeadlineDays: undefined as number | undefined,
  workflowType:     'Standard' as 'Standard' | 'Medical',
  isActive:         true,
  isSystem:         false,
  color:            '#EF463B',
})
// Ciblage d'eligibilite (voir EligibilityFields.vue) : champs texte ('',
// 'M'/'F', 'true'/'false', id d'entite) comme tout autre select optionnel de
// l'appli, convertis en valeurs typees au moment de construire le payload.
const appliesToGenderText = ref('')
const appliesToExpatriateText = ref('')
const organizationUnitIdText = ref('')
// Uniquement à la création — n'a pas de sens sur un type déjà existant.
// Pré-cochée par défaut (décision du 31/07) : le cas courant est de vouloir
// que les employés déjà présents en bénéficient tout de suite plutôt que
// d'attendre la prochaine génération automatique.
const creditExisting = ref(true)

const errors = reactive({ name: '', code: '' })

// Calculee, jamais saisie : evite qu'une valeur incoherente avec Jours
// alloues / an ne soit renseignee a la main, et evite aussi le champ nombre
// vide (chaine vide via v-model.number) qui faisait echouer la validation
// backend (DaysPerMonth optionnel mais pas accepte comme chaine vide).
const monthlyAccrualDays = computed(() => Math.round((form.daysPerYear / 12) * 100) / 100)

function autoCode() {
  if (!isEdit.value) {
    form.code = form.name
      .toUpperCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Z0-9]/g, '_')
      .slice(0, 12)
  }
}

function populate() {
  if (isEdit.value && props.editId) {
    const lt = store.leaveTypes.find(l => l.id === props.editId)
    if (lt) {
      form.name             = lt.name
      form.code             = lt.code
      form.daysPerYear      = lt.daysPerYear
      form.monthlyAccrual   = lt.monthlyAccrual ?? false
      form.noticeDays       = lt.noticeDays
      form.documentRequired = lt.documentRequired
      form.documentDeadlineDays = lt.documentDeadlineDays
      form.workflowType     = lt.workflowType
      form.isActive         = lt.isActive
      form.isSystem         = lt.isSystem
      form.color            = lt.color
      appliesToGenderText.value = lt.appliesToGender ?? ''
      appliesToExpatriateText.value = lt.appliesToExpatriate === undefined || lt.appliesToExpatriate === null ? '' : String(lt.appliesToExpatriate)
      organizationUnitIdText.value = lt.organizationUnitId ?? ''
    }
  } else {
    Object.assign(form, {
      name:'', code:'', daysPerYear:0, monthlyAccrual:false,
      noticeDays:0, documentRequired:false, documentDeadlineDays:undefined, workflowType:'Standard',
      isActive:true, isSystem:false, color:'#EF463B',
    })
    appliesToGenderText.value = ''
    appliesToExpatriateText.value = ''
    organizationUnitIdText.value = ''
  }
  errors.name = ''
  errors.code = ''
  error.value = ''
}
populate()
watch(() => props.editId, populate)

function validate(): boolean {
  errors.name = ''
  errors.code = ''
  let ok = true
  if (!form.name.trim()) { errors.name = 'Nom requis'; ok = false }
  if (!form.code.trim()) { errors.code = 'Code requis'; ok = false }
  return ok
}

async function handleSave() {
  if (!validate()) return
  const payload: Omit<LeaveTypeConfig, 'id' | 'icon'> = {
    name:             form.name,
    code:             form.code.toUpperCase(),
    daysPerYear:      form.daysPerYear,
    monthlyAccrual:   form.monthlyAccrual,
    daysPerMonth:     form.monthlyAccrual ? monthlyAccrualDays.value : undefined,
    noticeDays:       form.noticeDays,
    documentRequired: form.documentRequired,
    documentDeadlineDays: form.documentRequired ? form.documentDeadlineDays : undefined,
    workflowType:     form.workflowType,
    isActive:         form.isActive,
    isSystem:         form.isSystem,
    color:            form.color,
    appliesToGender:     appliesToGenderText.value ? (appliesToGenderText.value as 'M' | 'F') : undefined,
    appliesToExpatriate: appliesToExpatriateText.value === '' ? undefined : appliesToExpatriateText.value === 'true',
    organizationUnitId:  organizationUnitIdText.value || undefined,
  }
  try {
    if (isEdit.value && props.editId) {
      await store.updateLeaveType(props.editId, payload)
    } else {
      await store.addLeaveType(payload, creditExisting.value)
    }
    emit('saved')
    emit('close')
  } catch {
    error.value = store.error ?? "L'enregistrement a échoué. Veuillez réessayer."
  }
}
</script>

<template>
  <CreateModalShell
    :title="isEdit ? 'Modifier le type de congé' : 'Nouveau type de congé'"
    :banner-label="isEdit ? 'Modifier le type de congé' : 'Nouveau type de congé'"
    :create-label="isEdit ? 'Enregistrer' : 'Ajouter'"
    :save-error="error"
    @close="emit('close')"
    @create="handleSave"
  >
    <template #form>
      <div class="flex-1 overflow-auto px-6 py-5">
        <div class="max-w-3xl mx-auto">

          <FormSection title="Informations générales">
            <div class="grid grid-cols-2 gap-x-6 gap-y-4 max-sm:grid-cols-1">
              <div :class="cls.field">
                <label :class="cls.fieldLabel">Nom <span class="text-danger">*</span></label>
                <input v-model="form.name" :class="[cls.fieldInput, errors.name && cls.inputError]" placeholder="ex: Congé sans solde" @input="autoCode" />
                <div v-if="errors.name" :class="cls.fieldError">{{ errors.name }}</div>
              </div>
              <div :class="cls.field">
                <label :class="cls.fieldLabel">Code <span class="text-danger">*</span></label>
                <input v-model="form.code" :class="[cls.fieldInput, 'uppercase', errors.code && cls.inputError]" placeholder="ex: UNPAID" />
                <div v-if="errors.code" :class="cls.fieldError">{{ errors.code }}</div>
              </div>
              <div :class="cls.field">
                <label :class="cls.fieldLabel">Workflow</label>
                <select v-model="form.workflowType" :class="cls.fieldSelect">
                  <option value="Standard">Standard (approbation)</option>
                  <option value="Medical">Médical (enregistrement)</option>
                </select>
              </div>
              <div :class="[cls.field, 'col-span-2 max-sm:col-span-1']">
                <label :class="cls.fieldLabel">Couleur dans le calendrier</label>
                <p class="text-[11px] text-muted-foreground -mt-0.5 mb-1.5">
                  Cette couleur identifie ce type de congé dans le planning d'équipe et les calendriers des employés.
                </p>
                <div class="flex items-start gap-3 flex-wrap">
                  <div class="flex flex-col items-center gap-1">
                    <label
                      class="relative w-9 h-9 rounded-md border-2 border-border cursor-pointer overflow-hidden shrink-0 hover:border-primary transition-colors"
                      :style="{ background: form.color }"
                      title="Choisir une couleur personnalisée"
                    >
                      <input type="color" v-model="form.color" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                      <span class="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-card border border-border flex items-center justify-center pointer-events-none">
                        <Pipette class="w-2.5 h-2.5 text-foreground" />
                      </span>
                    </label>
                    <span class="text-[10px] text-muted-foreground whitespace-nowrap">Personnalisée</span>
                  </div>

                  <div class="w-px self-stretch bg-border"></div>

                  <div class="flex flex-wrap gap-2 self-center">
                    <button
                      v-for="c in COLOR_OPTIONS" :key="c"
                      type="button"
                      class="w-7 h-7 rounded-md border-2 cursor-pointer flex items-center justify-center transition-transform"
                      :class="form.color === c ? 'border-foreground scale-110' : 'border-transparent'"
                      :style="{ background: c }"
                      @click="form.color = c"
                    >
                      <Check v-if="form.color === c" class="w-3 h-3 text-white" />
                    </button>
                  </div>

                  <span class="text-[11px] text-muted-foreground font-mono uppercase self-center">{{ form.color }}</span>
                </div>
              </div>
            </div>
          </FormSection>

          <FormSection title="Règles d'acquisition">
            <div class="grid grid-cols-2 gap-x-6 gap-y-4 max-sm:grid-cols-1">
              <div :class="cls.field">
                <label :class="cls.fieldLabel">Jours alloués / an</label>
                <input type="number" min="0" v-model.number="form.daysPerYear" :class="cls.fieldInput" />
              </div>
              <div class="flex flex-col gap-1.5">
                <div class="flex items-center justify-between">
                  <span :class="cls.fieldLabel">Accumulation mensuelle</span>
                  <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" class="sr-only peer" v-model="form.monthlyAccrual" />
                    <span class="w-9 h-5 rounded-full bg-foreground/20 transition-colors peer-checked:bg-primary relative after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:w-3.5 after:h-3.5 after:bg-white after:rounded-full after:shadow after:transition-all peer-checked:after:left-[19px]"></span>
                  </label>
                </div>
                <p class="text-[11px] text-muted-foreground">
                  <template v-if="form.monthlyAccrual">{{ monthlyAccrualDays }} j crédités chaque mois ({{ form.daysPerYear }} j/an ÷ 12).</template>
                  <template v-else>Sans cette option, les {{ form.daysPerYear }} j/an sont crédités en une fois (dotation annuelle).</template>
                </p>
              </div>
              <div :class="cls.field">
                <label :class="cls.fieldLabel">Préavis minimum (jours)</label>
                <input type="number" min="0" v-model.number="form.noticeDays" :class="cls.fieldInput" />
              </div>
              <div class="flex items-center justify-between">
                <span :class="cls.fieldLabel">Justificatif obligatoire</span>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" class="sr-only peer" v-model="form.documentRequired" />
                  <span class="w-9 h-5 rounded-full bg-foreground/20 transition-colors peer-checked:bg-primary relative after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:w-3.5 after:h-3.5 after:bg-white after:rounded-full after:shadow after:transition-all peer-checked:after:left-[19px]"></span>
                </label>
              </div>
              <div v-if="form.documentRequired" :class="cls.field">
                <label :class="cls.fieldLabel">Délai de soumission du justificatif (jours)</label>
                <input type="number" min="1" v-model.number="form.documentDeadlineDays" :class="cls.fieldInput" placeholder="ex: 2" />
              </div>
              <div v-if="!isEdit" class="col-span-2 flex items-start gap-2.5 bg-info-bg rounded-md px-3 py-2.5">
                <input id="credit-existing" type="checkbox" class="accent-primary mt-0.5" v-model="creditExisting" />
                <label for="credit-existing" class="text-[13px] text-foreground cursor-pointer">
                  Créditer les employés déjà actifs dès la création
                  <span class="block text-[11px] text-muted-foreground mt-0.5">
                    Mois en cours pour un type à accumulation mensuelle, année complète pour un type à dotation annuelle.
                    Sinon, ils n'en bénéficieront qu'à la prochaine génération (automatique ou manuelle).
                  </span>
                </label>
              </div>
            </div>
          </FormSection>

          <FormSection title="Éligibilité">
            <p class="text-[11px] text-muted-foreground -mt-0.5 mb-3">
              Restreint ce type de congé à une partie des employés. Laissez sur "Tous" pour qu'il s'applique à tout le monde, comme aujourd'hui.
            </p>
            <EligibilityFields v-model:gender="appliesToGenderText" v-model:expatriate="appliesToExpatriateText" />
            <div :class="cls.field" class="mt-4">
              <label :class="cls.fieldLabel">Entité concernée</label>
              <select v-model="organizationUnitIdText" :class="cls.fieldSelect">
                <option value="">Toutes les entités</option>
                <option v-for="e in entityStore.approvedEntities" :key="e.id" :value="e.id">{{ e.code }} · {{ e.name }}</option>
              </select>
            </div>
          </FormSection>

        </div>
      </div>
    </template>
  </CreateModalShell>
</template>
