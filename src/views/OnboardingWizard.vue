<template>
  <div class="min-h-screen flex flex-col transition-opacity duration-[250ms]" :class="{ 'opacity-0': leaving }" :style="bgStyle">

    <!-- ── En-tête minimal ── -->
    <header class="h-[60px] shrink-0 bg-card border-b border-border shadow-[0_1px_4px_rgba(0,0,0,0.06)] px-10 flex items-center justify-between max-[480px]:px-4">
      <div class="flex items-center">
        <img src="/hv-logo.png" alt="HV" class="h-[34px] block" />
      </div>
      <span class="bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-full text-[11px] font-semibold">Configuration initiale</span>
    </header>

    <!-- id="below-topbar" : cible du <Teleport> de CreateModalShell -->
    <div id="below-topbar" class="relative flex-1 flex flex-col min-h-0">

    <!-- ── Zone centrale ── -->
    <div class="flex-1 flex flex-col items-center max-w-[860px] w-full mx-auto px-6 py-10 max-md:px-4 max-md:py-6 overflow-y-auto">

      <!-- Titre principal -->
      <div class="text-center mb-8">
        <h1 class="text-[28px] font-extrabold text-foreground m-0 max-md:text-[22px]">Bienvenue sur Productive 247 HRM</h1>
        <p class="text-[15px] text-muted-foreground mt-2">Configurez votre espace en 3 étapes. Tout reste modifiable ensuite dans le menu Configuration</p>
      </div>

      <!-- Barre de progression -->
      <div class="flex items-start max-w-[600px] w-full mx-auto mb-8">
        <template v-for="(label, i) in STEP_LABELS" :key="label">
          <div class="flex flex-col items-center shrink-0" :class="{ 'cursor-pointer': i + 1 < currentStep }" @click="i + 1 < currentStep && (currentStep = i + 1)">
            <div class="w-11 h-11 rounded-full flex items-center justify-center font-bold text-base transition-all shrink-0" :class="stepCircleClass(i + 1)">
              <Check v-if="i + 1 < currentStep" class="w-[18px] h-[18px]" />
              <span v-else>{{ i + 1 }}</span>
            </div>
            <span class="text-xs font-medium mt-2 text-center max-md:hidden" :class="i + 1 === currentStep ? 'text-primary' : 'text-muted-foreground'">{{ label }}</span>
          </div>
          <div v-if="i < STEP_LABELS.length - 1" class="flex-1 h-[3px] rounded-sm self-center mb-5 transition-colors max-md:mb-0" :class="i + 1 < currentStep ? 'bg-primary' : 'bg-border'"></div>
        </template>
      </div>

      <!-- Card contenu -->
      <div class="max-w-[860px] w-full bg-card rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.10)] border border-border overflow-hidden">
        <Transition name="step" mode="out-in">
          <div :key="currentStep">

            <!-- ══ ÉTAPE 1 : Entreprise + Calendrier ══ -->
            <template v-if="currentStep === 1">
              <div class="px-7 py-5 border-b border-border bg-background flex items-center gap-3.5 max-md:px-4">
                <div class="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><CalendarDays class="w-6 h-6 text-primary" /></div>
                <div>
                  <div class="text-lg font-bold text-foreground">Entreprise et calendrier</div>
                  <div class="text-[13px] text-muted-foreground mt-1">Nom, devise, fuseau horaire, et les jours/horaires de travail par défaut</div>
                </div>
              </div>
              <div :class="cardBody">
                <div class="grid grid-cols-3 gap-3 max-md:grid-cols-1">
                  <div :class="cls.field">
                    <label :class="cls.fieldLabel">Nom de l'entreprise *</label>
                    <input v-model="companyForm.companyName" :class="cls.fieldInput" placeholder="ex : HV" />
                  </div>
                  <div :class="cls.field">
                    <label :class="cls.fieldLabel">Devise *</label>
                    <select v-model="companyForm.currency" :class="cls.fieldSelect">
                      <option value="MGA">Ariary (MGA)</option>
                      <option value="MUR">Roupie mauricienne (MUR)</option>
                      <option value="EUR">Euro (EUR)</option>
                      <option value="USD">Dollar US (USD)</option>
                    </select>
                  </div>
                  <div :class="cls.field">
                    <label :class="cls.fieldLabel">Fuseau horaire *</label>
                    <select v-model="companyForm.timezone" :class="cls.fieldSelect">
                      <option value="Indian/Antananarivo">Madagascar (UTC+3)</option>
                      <option value="Indian/Mauritius">Île Maurice (UTC+4)</option>
                    </select>
                  </div>
                </div>
                <WorkingDaysConfig hide-summary />
                <div v-if="calendarStore.daysPerWeek > 0" class="bg-success-bg border border-success rounded-lg px-4 py-2.5 flex items-center gap-2 text-[13px] text-success">
                  <CircleCheck class="w-4 h-4" />
                  {{ calendarStore.daysPerWeek }} jour{{ calendarStore.daysPerWeek > 1 ? 's' : '' }} configuré{{ calendarStore.daysPerWeek > 1 ? 's' : '' }}
                  · {{ calendarStore.formatMinutes(calendarStore.weeklyMinutes) }} par semaine
                </div>
                <p class="text-[12px] text-muted-foreground -mt-1">
                  Vous pourrez définir un calendrier différent par catégorie d'employés plus tard, dans Configuration &gt; Calendrier.
                </p>
              </div>
              <p v-if="companyError" class="px-7 text-xs text-danger">{{ companyError }}</p>
              <div :class="[cardFoot, 'justify-end']">
                <button :class="btnPrimary" :disabled="calendarStore.daysPerWeek === 0 || !companyForm.companyName.trim() || saving" @click="saveStep1AndContinue">
                  {{ saving ? 'Enregistrement…' : 'Continuer →' }}
                </button>
              </div>
            </template>

            <!-- ══ ÉTAPE 2 : Jours fériés ══ -->
            <template v-else-if="currentStep === 2">
              <div class="px-7 py-5 border-b border-border bg-background flex items-center gap-3.5 max-md:px-4">
                <div class="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><CalendarOff class="w-6 h-6 text-primary" /></div>
                <div>
                  <div class="text-lg font-bold text-foreground">Jours fériés</div>
                  <div class="text-[13px] text-muted-foreground mt-1">Les fériés annuels et ponctuels de l'entreprise (optionnel, vous pouvez les ajouter plus tard)</div>
                </div>
              </div>
              <div :class="cardBody">
                <div class="flex gap-2">
                  <button :class="btnOutline" class="!px-3 !py-1.5 !text-xs" @click="openHolidayModal('annual')"><Plus class="w-3.5 h-3.5" /> Férié annuel</button>
                  <button :class="btnOutline" class="!px-3 !py-1.5 !text-xs" @click="openHolidayModal('ponctual')"><Plus class="w-3.5 h-3.5" /> Férié ponctuel</button>
                </div>
                <div v-if="calendarStore.holidays.length === 0" class="flex flex-col items-center gap-1.5 px-4 py-7 text-center">
                  <CalendarOff class="w-10 h-10 text-muted-foreground" />
                  <div class="text-sm font-semibold text-foreground">Aucun jour férié</div>
                  <div class="text-xs text-muted-foreground">Ajoutez les fêtes légales de votre pays, ou passez cette étape</div>
                </div>
                <div v-else class="flex flex-col gap-1">
                  <div v-for="h in calendarStore.holidays" :key="h.id" class="flex items-center gap-2.5 px-2.5 py-2 bg-background border border-border rounded-lg">
                    <span class="text-[10px] font-bold px-2 py-[3px] rounded whitespace-nowrap shrink-0" :class="h.isRecurring ? 'bg-success text-white' : 'bg-danger text-white'">{{ h.isRecurring ? 'Annuel' : 'Ponctuel' }}</span>
                    <span class="flex-1 text-[13px] font-medium text-foreground">{{ h.name }}</span>
                    <span class="text-xs text-muted-foreground shrink-0">{{ h.date }}</span>
                    <button class="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:bg-danger-bg hover:text-danger shrink-0" @click="deleteHoliday(h.id)"><Trash2 class="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </div>
              <div :class="[cardFoot, 'justify-between max-[480px]:flex-col max-[480px]:gap-2.5 max-[480px]:items-stretch']">
                <button :class="btnOutline" @click="currentStep = 1">← Précédent</button>
                <button :class="btnPrimary" @click="currentStep = 3">Continuer →</button>
              </div>
            </template>

            <!-- ══ ÉTAPE 3 : Types de congé ══ -->
            <template v-else>
              <div class="px-7 py-5 border-b border-border bg-background flex items-center gap-3.5 max-md:px-4">
                <div class="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><ListChecks class="w-6 h-6 text-primary" /></div>
                <div>
                  <div class="text-lg font-bold text-foreground">Types de congé</div>
                  <div class="text-[13px] text-muted-foreground mt-1">Au moins un type (ex: Congé annuel) est nécessaire pour que vos employés puissent soumettre une demande</div>
                </div>
              </div>
              <div :class="cardBody">
                <div v-if="leaveTypesStore.leaveTypes.length === 0" class="flex flex-col items-center gap-1.5 px-4 py-7 text-center">
                  <ListChecks class="w-10 h-10 text-muted-foreground" />
                  <div class="text-sm font-semibold text-foreground">Aucun type de congé créé</div>
                  <div class="text-xs text-muted-foreground">Commencez par ajouter "Congé annuel"</div>
                </div>
                <div v-else class="flex flex-col gap-1">
                  <div v-for="lt in leaveTypesStore.leaveTypes" :key="lt.id" class="flex items-center gap-2.5 px-2.5 py-2 bg-background border border-border rounded-lg">
                    <span class="w-6 h-6 rounded-md shrink-0" :style="{ background: lt.color }"></span>
                    <span class="flex-1 text-[13px] font-medium text-foreground">{{ lt.name }}</span>
                    <span class="text-[10px] font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary whitespace-nowrap shrink-0">{{ lt.workflowType === 'Medical' ? 'Médical' : 'Standard' }}</span>
                    <span class="text-xs text-muted-foreground shrink-0">{{ lt.daysPerYear }} j/an</span>
                  </div>
                </div>
                <button :class="btnOutline" @click="showLTModal = true">
                  <Plus class="w-4 h-4" /> Ajouter un type de congé
                </button>
              </div>
              <div :class="[cardFoot, 'justify-between max-[480px]:flex-col max-[480px]:gap-2.5 max-[480px]:items-stretch']">
                <button :class="btnOutline" @click="currentStep = 2">← Précédent</button>
                <div class="flex items-center max-[480px]:flex-col max-[480px]:gap-2.5">
                  <button v-if="leaveTypesStore.leaveTypes.length === 0" class="bg-transparent border-0 cursor-pointer text-xs text-muted-foreground mr-3 py-1 transition-colors hover:text-foreground max-[480px]:mr-0" @click="finish">Passer et accéder →</button>
                  <button v-else :class="btnPrimary" :disabled="finishing" @click="finish">{{ finishing ? 'Enregistrement…' : "Terminer et accéder à l'application →" }}</button>
                </div>
              </div>
            </template>

          </div>
        </Transition>
      </div>

    </div>

    <!-- ── Pied de page ── -->
    <footer class="h-12 shrink-0 bg-card border-t border-border flex items-center justify-center text-[11px] text-muted-foreground">
      Vous pourrez modifier ces configurations à tout moment dans le menu Configuration
    </footer>

    <!-- ── Modal type de congé (composant existant réutilisé) ── -->
    <LeaveTypeFormModal v-if="showLTModal" @close="showLTModal = false" @saved="showLTModal = false" />

    <!-- ── Modals férié (mêmes formulaires que CalendarView.vue) ── -->
    <CreateModalShell
      v-if="holidayModal === 'annual'"
      title="Ajouter un férié annuel" banner-label="Ajouter un férié annuel" create-label="Ajouter"
      :save-error="holidayError" @close="holidayModal = null" @create="saveAnnualHoliday"
    >
      <template #form>
        <div class="flex-1 overflow-auto px-6 py-5">
          <div class="max-w-md mx-auto">
            <FormSection title="Informations générales">
              <div class="flex flex-col gap-3.5">
                <label :class="cls.field">
                  <span :class="cls.fieldLabel">Nom *</span>
                  <input type="text" :class="cls.fieldInput" v-model="hForm.name" placeholder="Ex : Fête du Travail" />
                </label>
                <div :class="cls.field">
                  <span :class="cls.fieldLabel">Date (mois/jour)</span>
                  <div class="flex gap-2">
                    <select :class="cls.fieldSelect" v-model="hForm.month">
                      <option v-for="m in MONTHS" :key="m.v" :value="m.v">{{ m.l }}</option>
                    </select>
                    <select :class="cls.fieldSelect" v-model="hForm.day">
                      <option v-for="d in DAYS" :key="d" :value="d">{{ d }}</option>
                    </select>
                  </div>
                </div>
              </div>
            </FormSection>
          </div>
        </div>
      </template>
    </CreateModalShell>

    <CreateModalShell
      v-if="holidayModal === 'ponctual'"
      title="Ajouter un férié ponctuel" banner-label="Ajouter un férié ponctuel" create-label="Ajouter"
      :save-error="holidayError" @close="holidayModal = null" @create="savePonctualHoliday"
    >
      <template #form>
        <div class="flex-1 overflow-auto px-6 py-5">
          <div class="max-w-md mx-auto">
            <FormSection title="Informations générales">
              <div class="flex flex-col gap-3.5">
                <label :class="cls.field">
                  <span :class="cls.fieldLabel">Nom *</span>
                  <input type="text" :class="cls.fieldInput" v-model="hForm.name" placeholder="Ex : Aïd el-Fitr 2026" />
                </label>
                <label :class="cls.field">
                  <span :class="cls.fieldLabel">Date complète</span>
                  <input type="date" :class="cls.fieldInput" v-model="hForm.fullDate" />
                </label>
              </div>
            </FormSection>
          </div>
        </div>
      </template>
    </CreateModalShell>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Check, CalendarDays, CalendarOff, ListChecks, CircleCheck, Plus, Trash2 } from 'lucide-vue-next'
import { useAuthStore }       from '../stores/auth'
import { useCalendarStore }   from '../stores/calendar'
import { useLeaveTypesStore } from '../stores/leaveTypes'
import { useCompanySettingsStore } from '../stores/companySettings'
import WorkingDaysConfig  from '../components/calendar/WorkingDaysConfig.vue'
import LeaveTypeFormModal from '../components/configuration/LeaveTypeFormModal.vue'
import CreateModalShell   from '../components/shared/CreateModalShell.vue'
import FormSection        from '../components/ui/form-field/FormSection.vue'
import * as cls from '../lib/formClasses'
import { confirmDialog } from '../lib/confirm'

const auth          = useAuthStore()
const calendarStore = useCalendarStore()
const leaveTypesStore = useLeaveTypesStore()
const companySettingsStore = useCompanySettingsStore()
const router        = useRouter()

const companyForm = reactive({ companyName: 'HV', currency: 'MUR', timezone: 'Indian/Mauritius' })
const companyError = ref('')
const saving        = ref(false)
const finishing      = ref(false)
const leaving        = ref(false)

// ── Classes du design system ─────────────────────────────────
const cardBody = 'px-7 py-6 flex flex-col gap-4 max-md:px-4 max-md:py-5'
const cardFoot = 'px-7 py-4 border-t border-border flex items-center max-md:px-4'
const btnPrimary = 'inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-[13px] font-semibold cursor-pointer border-0 bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap max-[480px]:w-full max-[480px]:justify-center'
const btnOutline = 'inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-[13px] font-semibold cursor-pointer bg-card text-foreground border border-border transition-colors hover:bg-background whitespace-nowrap max-[480px]:w-full max-[480px]:justify-center'

// Dégradé de fond (rouge clair → blanc → bordeaux clair HV)
const bgStyle = {
  background: 'linear-gradient(135deg, var(--hv-red-light) 0%, #ffffff 50%, var(--hv-maroon-light) 100%)',
}

// ── Étapes (suivent exactement les 3 onglets de l'écran Calendrier) ──
const STEP_LABELS = ['Entreprise', 'Jours fériés', 'Types de congé'] as const
const currentStep = ref(1)
function stepCircleClass(step: number): string {
  if (step > currentStep.value) return 'bg-card text-muted-foreground border-2 border-border'
  return 'bg-primary text-white shadow-[0_0_0_4px_var(--color-primary-light)]' + (step === currentStep.value ? ' ob-pulse' : '')
}

// Vérification auth manuelle (la route n'a pas requiresAuth pour éviter les boucles)
onMounted(() => {
  if (!auth.isLoggedIn)          router.replace({ path: '/' })
  else if (auth.isEmployeeSpace) router.replace({ path: '/employee' })
  else {
    calendarStore.fetchCalendar()
    calendarStore.fetchHolidays(new Date().getFullYear())
    leaveTypesStore.fetchAll()
  }
})

async function saveStep1AndContinue() {
  saving.value = true
  companyError.value = ''
  try {
    await calendarStore.updateWorkingDays(calendarStore.calendar.workingDays)
  } catch {
    companyError.value = calendarStore.error ?? "L'enregistrement du calendrier a échoué. Veuillez réessayer."
    saving.value = false
    return
  }
  saving.value = false
  currentStep.value = 2
}

// ── Étape 2 : jours fériés (mêmes actions que CalendarView.vue) ──────
const holidayModal = ref<'annual' | 'ponctual' | null>(null)
const holidayError = ref('')
const MONTHS = [
  {v:'01',l:'Janvier'},{v:'02',l:'Février'},{v:'03',l:'Mars'},{v:'04',l:'Avril'},
  {v:'05',l:'Mai'},{v:'06',l:'Juin'},{v:'07',l:'Juillet'},{v:'08',l:'Août'},
  {v:'09',l:'Septembre'},{v:'10',l:'Octobre'},{v:'11',l:'Novembre'},{v:'12',l:'Décembre'},
]
const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2,'0'))
const hForm = reactive({ name: '', month: '01', day: '01', fullDate: '' })

function openHolidayModal(type: 'annual' | 'ponctual') {
  hForm.name = ''; hForm.month = '01'; hForm.day = '01'; hForm.fullDate = ''
  holidayError.value = ''
  holidayModal.value = type
}

async function saveAnnualHoliday() {
  if (!hForm.name.trim()) { holidayError.value = 'Le nom est obligatoire'; return }
  const date = `2000-${hForm.month}-${hForm.day}`
  holidayError.value = ''
  try {
    await calendarStore.addHoliday({ name: hForm.name, date, isRecurring: true, holidayType: 'National' })
    holidayModal.value = null
  } catch {
    holidayError.value = calendarStore.error ?? "L'enregistrement a échoué. Veuillez réessayer."
  }
}

async function savePonctualHoliday() {
  if (!hForm.name.trim()) { holidayError.value = 'Le nom est obligatoire'; return }
  if (!hForm.fullDate) { holidayError.value = 'La date est obligatoire'; return }
  holidayError.value = ''
  try {
    await calendarStore.addHoliday({ name: hForm.name, date: hForm.fullDate, isRecurring: false, holidayType: 'National' })
    holidayModal.value = null
  } catch {
    holidayError.value = calendarStore.error ?? "L'enregistrement a échoué. Veuillez réessayer."
  }
}

async function deleteHoliday(id: string) {
  if (!(await confirmDialog('Supprimer ce jour férié ?'))) return
  try {
    await calendarStore.removeHoliday(id)
  } catch {
    // calendarStore.error porte le message pour l'UI
  }
}

// ── Étape 3 : types de congé ──────────────────────────────────────
const showLTModal = ref(false)

// ── Fin du wizard ────────────────────────────────────────────────────
async function finish() {
  finishing.value = true
  companyError.value = ''
  try {
    await companySettingsStore.completeOnboarding(companyForm)
  } catch {
    companyError.value = companySettingsStore.error ?? "La finalisation a échoué. Veuillez réessayer."
    finishing.value = false
    currentStep.value = 1
    return
  }
  leaving.value = true
  setTimeout(() => {
    // Lance le tour guidé au premier chargement du tableau de bord (voir
    // DashboardHR.vue) — evite d'ouvrir directement sur Employés/Entités.
    router.push({ name: 'hr-dashboard', query: { tour: '1' } })
  }, 250)
}
</script>

<style scoped>
/* Animation pulse du cercle d'étape courante + transition entre étapes
   (non exprimables en utilitaires Tailwind) */
.ob-pulse { animation: pulse 2s infinite; }
@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 4px var(--color-primary-light); }
  50%      { box-shadow: 0 0 0 10px transparent; }
}

.step-enter-active,
.step-leave-active { transition: all 0.25s ease; }
.step-enter-from { opacity: 0; transform: translateX(16px); }
.step-leave-to   { opacity: 0; transform: translateX(-16px); }
</style>
