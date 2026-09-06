<script setup lang="ts">
/**
 * Fiche de création d'un ordre de mission — sur CreateModalShell (pattern
 * frontdesk). Reprend la logique métier de l'ancien MissionFormModal :
 * bénéficiaire (self / pour un employé), calcul du per diem via l'API réelle
 * (missionStore.estimate — matrice ExpenseConfig côté backend), acompte.
 */
import { ref, reactive, computed, watch } from 'vue'
import { Plus, Trash2 } from 'lucide-vue-next'
import UserAvatar from '../ui/UserAvatar.vue'
import ForWhomSelector from '../ui/ForWhomSelector.vue'
import type { BeneficiaryValue } from '../ui/ForWhomSelector.vue'
import CreateModalShell from '../shared/CreateModalShell.vue'
import FormSection from '../ui/form-field/FormSection.vue'
import * as cls from '../../lib/formClasses'
import { useMissionStore } from '../../stores/missions'
import type { EstimateResult, MissionExpenseLinePayload } from '../../stores/missions'
import { useMissionConfigStore } from '../../stores/missionConfig'
import { useEmployeeStore } from '../../stores/employees'
import { useEmployeeCategoryStore } from '../../stores/employeeCategories'
import { useAuthStore } from '../../stores/auth'
import type { MissionCategory, TransportMode } from '../../types'

const props = withDefaults(defineProps<{ mode?: 'self' | 'for-employee' }>(), { mode: 'self' })
const emit = defineEmits<{ close: []; created: [] }>()

const missionStore = useMissionStore()
const missionConfigStore = useMissionConfigStore()
const employeeStore = useEmployeeStore()
const categoryStore = useEmployeeCategoryStore()
const auth = useAuthStore()
if (categoryStore.categories.length === 0) categoryStore.fetchAll()
if (missionConfigStore.expenseTypes.length === 0) missionConfigStore.fetchExpenseTypes()
// N'importe qui peut soumettre pour n'importe qui (decision du 01/08) — voir
// AbsenceCreate.vue pour le detail (fetchAll echouerait en 403 sans
// EMPLOYE_VOIR_TOUT/EQUIPE).
if (employeeStore.directory.length === 0) employeeStore.fetchDirectory()

const TRANSPORT_MODES: { value: TransportMode; label: string }[] = [
  { value: 'PersonalCar', label: 'Voiture personnelle' },
  { value: 'CompanyCar', label: 'Voiture société' },
  { value: 'PublicTransport', label: 'Transport en commun' },
  { value: 'Plane', label: 'Avion' },
  { value: 'Other', label: 'Autre' },
]
const MISSION_CATEGORIES: { value: MissionCategory; label: string }[] = [
  { value: 'National', label: 'Nationale' },
  { value: 'International', label: 'Internationale' },
]

const forWhom = ref<BeneficiaryValue>({ mode: props.mode, employeeId: '' })

// On exclut soi-même : "Pour moi-même" est déjà l'option dédiée à ce cas,
// pas besoin de se retrouver aussi dans la liste "Pour un employé".
const employeeItems = computed(() =>
  employeeStore.directory
    .filter(e => e.id !== auth.user?.id)
    .map(e => ({ id: e.id, label: e.name, sublabel: e.entityName, code: e.code, initials: e.avatarText, avatarColor: e.avatarBg, status: e.status })),
)

const beneficiaryId = computed(() => forWhom.value.mode === 'for-employee' ? forWhom.value.employeeId : (auth.user?.id ?? ''))

const selectedEmployee = computed(() => {
  if (forWhom.value.mode === 'self') {
    const u = auth.user
    return u ? { id: u.id, name: u.name, initials: u.initials, categoryName: auth.categoryName ?? '' } : null
  }
  const emp = employeeStore.getById(forWhom.value.employeeId)
  if (!emp) return null
  const categoryName = categoryStore.categories.find(c => c.id === emp.employeeCategoryId)?.name ?? ''
  return { id: emp.id, name: emp.name, initials: emp.initials, categoryName }
})

const form = reactive({
  destination: '', purpose: '', missionCategory: 'National' as MissionCategory,
  departureDate: '', returnDate: '',
  transportModeGo: 'Plane' as TransportMode, transportModeReturn: 'Plane' as TransportMode,
  advance: 0,
})
const error = ref('')

// Mission accompagnant (plan de test #22, ex: le chauffeur d'un directeur)
// — cree automatiquement un second ordre de mission, memes dates/
// destination/categorie, pour la personne associee. Exclut le beneficiaire
// courant de la liste (ne peut pas s'associer lui-meme).
const associatedEmployeeId = ref('')
const associableEmployeeItems = computed(() => employeeItems.value.filter(e => e.id !== beneficiaryId.value))
watch(beneficiaryId, () => { if (associatedEmployeeId.value === beneficiaryId.value) associatedEmployeeId.value = '' })

function fmt(n: number) { return n.toLocaleString('fr-FR') }

// Estimation du per diem — appel réel à /mission-orders/estimate (matrice
// ExpenseConfig côté backend), redéclenché à chaque changement pertinent.
const estimateResult = ref<EstimateResult | null>(null)
const estimating = ref(false)
watch(
  () => [beneficiaryId.value, form.missionCategory, form.departureDate, form.returnDate] as const,
  async ([empId, missionCategory, departureDate, returnDate]) => {
    if (!empId || !departureDate || !returnDate || returnDate < departureDate) { estimateResult.value = null; return }
    estimating.value = true
    try {
      estimateResult.value = await missionStore.estimate(empId, missionCategory, departureDate, returnDate)
    } catch {
      estimateResult.value = null
    } finally {
      estimating.value = false
    }
  },
  { immediate: true },
)
const perdiemTotal = computed(() => estimateResult.value?.total ?? 0)

// Frais supplémentaires — memes ExpenseType que les notes de frais (Lot
// #18), persistes sur MissionExpenseLine pour justifier l'acompte demande.
function firstExpenseTypeId() { return missionConfigStore.expenseTypes[0]?.id ?? '' }
const expenseLines = reactive<MissionExpenseLinePayload[]>([])
function addLine() { expenseLines.push({ expenseTypeId: firstExpenseTypeId(), description: '', amount: 0 }) }
function removeLine(i: number) { expenseLines.splice(i, 1) }
const expenseTotal = computed(() => expenseLines.reduce((s, l) => s + (l.amount || 0), 0))
const grandTotal = computed(() => perdiemTotal.value + expenseTotal.value)

watch(() => forWhom.value.mode, () => { if (forWhom.value.mode === 'self') forWhom.value.employeeId = '' })

function validate(): boolean {
  if (forWhom.value.mode === 'for-employee' && !forWhom.value.employeeId) { error.value = 'Sélectionnez un employé'; return false }
  if (!form.destination.trim()) { error.value = 'Destination requise'; return false }
  if (!form.purpose.trim()) { error.value = 'Motif requis'; return false }
  if (!form.departureDate || !form.returnDate) { error.value = 'Dates de départ et de retour requises'; return false }
  if (form.returnDate < form.departureDate) { error.value = 'Le retour doit être après le départ'; return false }
  error.value = ''
  return true
}

function buildPayload() {
  return {
    employeeId: forWhom.value.mode === 'for-employee' ? forWhom.value.employeeId : undefined,
    destination: form.destination, purpose: form.purpose, missionCategory: form.missionCategory,
    departureDate: form.departureDate, returnDate: form.returnDate,
    transportModeGo: form.transportModeGo, transportModeReturn: form.transportModeReturn,
    advanceRequested: form.advance,
    expenseLines: expenseLines.filter(l => l.amount > 0),
    associatedEmployeeId: associatedEmployeeId.value || undefined,
  }
}

async function create() {
  if (!validate()) return
  try {
    await missionStore.createAndSubmit(buildPayload())
    emit('created'); emit('close')
  } catch {
    error.value = missionStore.error ?? "La soumission a échoué."
  }
}
async function saveDraft() {
  if (!validate()) return
  try {
    await missionStore.saveDraft(buildPayload())
    emit('created'); emit('close')
  } catch {
    error.value = missionStore.error ?? "L'enregistrement a échoué."
  }
}
</script>

<template>
  <CreateModalShell
    title="Nouvelle mission"
    banner-label="Nouvel ordre de mission"
    create-label="Soumettre"
    draft-label="Enregistrer le brouillon"
    :save-error="error"
    @close="emit('close')"
    @create="create"
    @save-draft="saveDraft"
  >
    <template #form>
      <div class="flex-1 overflow-auto px-6 py-5">
        <div class="max-w-3xl mx-auto">

          <!-- Bénéficiaire -->
          <FormSection title="Bénéficiaire">
          <ForWhomSelector v-model="forWhom" :available-employees="employeeItems" />
          <div v-if="selectedEmployee" class="flex items-center gap-2.5 mt-3 mb-4 px-3.5 py-2.5 bg-background border border-border rounded-lg">
            <UserAvatar :name="selectedEmployee.name" size="sm" />
            <div>
              <div class="text-[13px] font-medium text-foreground">{{ selectedEmployee.name }}</div>
              <div class="text-[11px] text-muted-foreground">{{ selectedEmployee.categoryName || 'Sans catégorie' }}</div>
            </div>
          </div>
          <div :class="cls.field" class="mb-3">
            <label :class="cls.fieldLabel">Associer un accompagnant <span class="font-normal text-muted-foreground">(optionnel)</span></label>
            <select v-model="associatedEmployeeId" :class="cls.fieldSelect">
              <option value="">Aucun</option>
              <option v-for="e in associableEmployeeItems" :key="e.id" :value="e.id">{{ e.label }}</option>
            </select>
            <p class="text-[11px] text-muted-foreground mt-1">
              Crée automatiquement un second ordre de mission, mêmes dates et destination, pour cette personne (ex : le chauffeur).
            </p>
          </div>
          </FormSection>

          <!-- Déplacement -->
          <FormSection title="Déplacement">
          <div class="grid grid-cols-2 gap-x-6 gap-y-4 max-sm:grid-cols-1">
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Destination <span class="text-danger">*</span></label>
              <input v-model="form.destination" :class="cls.fieldInput" placeholder="ex : Antananarivo, Toamasina…" />
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Portée</label>
              <select v-model="form.missionCategory" :class="cls.fieldSelect">
                <option v-for="c in MISSION_CATEGORIES" :key="c.value" :value="c.value">{{ c.label }}</option>
              </select>
            </div>
            <div :class="cls.field" class="col-span-2">
              <label :class="cls.fieldLabel">Objet / Motif <span class="text-danger">*</span></label>
              <textarea v-model="form.purpose" :class="cls.fieldTextarea" rows="2" placeholder="Décrivez l'objet de la mission…"></textarea>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Départ <span class="text-danger">*</span></label>
              <input type="date" v-model="form.departureDate" :class="cls.fieldInput" />
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Retour <span class="text-danger">*</span></label>
              <input type="date" v-model="form.returnDate" :min="form.departureDate" :class="cls.fieldInput" />
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Transport aller</label>
              <select v-model="form.transportModeGo" :class="cls.fieldSelect">
                <option v-for="m in TRANSPORT_MODES" :key="m.value" :value="m.value">{{ m.label }}</option>
              </select>
            </div>
            <div :class="cls.field">
              <label :class="cls.fieldLabel">Transport retour</label>
              <select v-model="form.transportModeReturn" :class="cls.fieldSelect">
                <option v-for="m in TRANSPORT_MODES" :key="m.value" :value="m.value">{{ m.label }}</option>
              </select>
            </div>
          </div>
          </FormSection>

          <!-- Per diem -->
          <FormSection title="Indemnité per diem">
          <div v-if="estimating" class="bg-background border border-border rounded-lg p-5 text-center text-xs text-muted-foreground">
            Calcul en cours…
          </div>
          <div v-else-if="estimateResult && estimateResult.lines.length > 0" class="bg-background border border-border rounded-lg p-3.5 flex flex-col gap-2">
            <div v-for="l in estimateResult.lines" :key="l.expenseTypeId" class="flex items-center justify-between text-[13px]">
              <span class="text-muted-foreground">{{ l.expenseTypeName }} <template v-if="l.unit === 'PerDay'">({{ l.days }}j)</template></span>
              <span class="font-medium text-foreground">{{ fmt(l.amount) }} {{ l.currency }}</span>
            </div>
            <div class="h-px bg-border"></div>
            <div class="flex items-center justify-between"><span class="font-bold text-foreground">Total per diem</span><span class="text-[15px] font-bold text-primary">{{ fmt(perdiemTotal) }} MGA</span></div>
          </div>
          <div v-else-if="estimateResult" class="bg-background border border-dashed border-border rounded-lg p-5 text-center text-xs text-muted-foreground">
            Aucun taux configuré pour cette catégorie d'employé et cette portée de mission.
          </div>
          <div v-else class="bg-background border border-dashed border-border rounded-lg p-5 text-center text-xs text-muted-foreground">
            Sélectionnez un employé et des dates pour calculer le per diem
          </div>

          </FormSection>

          <!-- Frais supplémentaires -->
          <FormSection title="Frais supplémentaires">
          <p class="text-xs text-muted-foreground -mt-2 mb-3">Optionnel : frais additionnels non couverts par le per diem.</p>
          <div v-if="expenseLines.length > 0" class="flex flex-col gap-1.5 mb-3">
            <div class="grid grid-cols-[1fr_1fr_120px_36px] gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.05em] px-0.5">
              <span>Catégorie</span><span>Description</span><span>Montant (MGA)</span><span></span>
            </div>
            <div v-for="(line, i) in expenseLines" :key="i" class="grid grid-cols-[1fr_1fr_120px_36px] gap-1.5 items-center">
              <select v-model="line.expenseTypeId" :class="cls.fieldInput" class="!h-8 !text-xs">
                <option v-for="t in missionConfigStore.expenseTypes" :key="t.id" :value="t.id">{{ t.name }}</option>
              </select>
              <input v-model="line.description" :class="cls.fieldInput" class="!h-8 !text-xs" placeholder="Description…" />
              <input v-model.number="line.amount" type="number" min="0" :class="cls.fieldInput" class="!h-8 !text-xs" placeholder="0" />
              <button class="w-8 h-8 rounded-md cursor-pointer flex items-center justify-center bg-danger-bg text-danger shrink-0 transition-opacity hover:opacity-75" @click="removeLine(i)" title="Supprimer">
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <button
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer border border-dashed border-border bg-transparent text-muted-foreground transition-colors hover:border-primary hover:text-primary hover:bg-primary/10"
            @click="addLine"
          >
            <Plus class="w-3.5 h-3.5" /> Ajouter un frais
          </button>
          </FormSection>

          <!-- Récapitulatif -->
          <FormSection title="Récapitulatif">
          <div class="bg-background border border-border rounded-lg p-3.5 flex flex-col gap-2">
            <div class="flex items-center justify-between text-[13px] text-muted-foreground">
              <span>Per diem estimé</span><span>{{ fmt(perdiemTotal) }} MGA</span>
            </div>
            <div v-if="expenseLines.length > 0" class="flex items-center justify-between text-[13px] text-muted-foreground">
              <span>Frais supplémentaires</span><span>{{ fmt(expenseTotal) }} MGA</span>
            </div>
            <div class="h-px bg-border"></div>
            <div class="flex items-center justify-between">
              <span class="font-bold text-foreground">TOTAL MISSION</span>
              <span class="text-[15px] font-bold text-primary">{{ fmt(grandTotal) }} MGA</span>
            </div>
            <div :class="cls.field" class="mt-3">
              <label :class="cls.fieldLabel">Acompte demandé (optionnel)</label>
              <input type="number" min="0" :max="grandTotal" v-model.number="form.advance" :class="cls.fieldInput" placeholder="0" />
            </div>
          </div>
          </FormSection>
        </div>
      </div>
    </template>
  </CreateModalShell>
</template>
