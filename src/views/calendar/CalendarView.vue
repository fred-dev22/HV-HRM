<template>
  <div class="px-7 py-6">

        <!-- ── En-tête ── -->
        <div class="flex items-start justify-between gap-4 mb-5 flex-wrap">
          <div>
            <h1 class="text-xl font-bold text-foreground">Calendrier de l'entreprise</h1>
            <p class="text-[13px] text-muted-foreground mt-0.5">Configuration des jours ouvrables, fériés et règles de congés</p>
            <span class="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-card border border-border rounded-full px-2.5 py-[3px] mt-2">
              <ClockArrowDown class="w-3 h-3" />
              Dernière mise à jour : {{ calendar.updatedAt }} par {{ calendar.updatedBy }}
            </span>
          </div>
        </div>

        <!-- ── Chargement ── -->
        <SkeletonLoader v-if="pageLoading" type="table" :lines="6" />

        <template v-else>
        <!-- ── Tabs ── -->
        <div class="flex gap-1 border-b-[1.5px] border-border mb-5 overflow-x-auto">
          <button
            v-for="tab in TABS" :key="tab.id"
            :class="[tabBtn, activeTab === tab.id && tabActive]"
            @click="activeTab = tab.id"
          >
            <component :is="tab.icon" class="w-4 h-4" />
            {{ tab.label }}
          </button>
        </div>

        <!-- ══════════ Onglet 1 : Jours de travail ══════════ -->
        <div v-if="activeTab === 'working-days'">
          <div :class="sectionCard">
            <div :class="sectionHeader">
              <h2 class="text-[15px] font-semibold text-foreground">Jours ouvrables</h2>
              <button
                :class="[L.btnPrimary, '!px-3.5 !py-2 !text-xs']"
                class="disabled:opacity-40 disabled:cursor-not-allowed"
                :disabled="savingWorkingDays || !calendarStore.isDirty || calendarStore.hasWorkingDaysError"
                :title="calendarStore.hasWorkingDaysError ? 'Corrigez les horaires en erreur avant d\'enregistrer' : (!calendarStore.isDirty && !savingWorkingDays ? 'Aucune modification à enregistrer' : '')"
                @click="saveWorkingDays"
              >
                <Save class="w-3.5 h-3.5" /> {{ savingWorkingDays ? 'Enregistrement…' : 'Enregistrer les modifications' }}
              </button>
            </div>

            <!-- ── Portée du calendrier ── -->
            <div class="mb-4">
              <span class="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.06em] block mb-1.5">Portée du calendrier</span>
              <div class="flex gap-1.5 flex-wrap items-center">
                <button :class="[scopeBtn, scope === 'global' && scopeActive]" @click="selectGlobalScope">
                  <Globe class="w-3.5 h-3.5" /> Global (par défaut)
                </button>
                <button :class="[scopeBtn, scope === 'category' && scopeActive]" @click="selectCategoryScope">
                  <Tag class="w-3.5 h-3.5" /> Par catégorie
                </button>
                <select
                  v-if="scope === 'category'"
                  v-model="selectedCategoryId"
                  :class="cls.fieldSelect"
                  class="!w-auto !h-9"
                  :disabled="categoryStore.loading"
                  @change="onCategoryChange"
                >
                  <option v-if="categoryStore.loading" value="" disabled>Chargement des catégories…</option>
                  <option v-for="c in categoryStore.categories" :key="c.id" :value="c.id">
                    {{ c.name }} {{ categoryHasDedicatedCalendar(c.id) ? '(calendrier dédié)' : '(suit le calendrier global)' }}
                  </option>
                </select>
              </div>

              <!-- Portée actuelle — mise en évidence explicite du choix actif -->
              <div class="flex items-center gap-2 mt-2.5 px-3.5 py-2 rounded-lg text-[12.5px] font-medium"
                   :class="scope === 'global' ? 'bg-success-bg text-success border border-success/30' : 'bg-primary/10 text-primary border border-primary/30'">
                <component :is="scope === 'global' ? Globe : Tag" class="w-4 h-4 shrink-0" />
                <span v-if="scope === 'global'">Portée actuelle : <strong>Calendrier global</strong> (s'applique à tous les employés sans calendrier dédié)</span>
                <span v-else-if="selectedCategoryId">Portée actuelle : catégorie <strong>{{ selectedCategoryName }}</strong> ({{ currentCategoryDedicatedId ? 'calendrier dédié' : 'suit encore le calendrier global' }})</span>
                <span v-else-if="categoryStore.loading">Chargement des catégories…</span>
                <span v-else>Aucune catégorie configurée. Créez-en une dans Classification pour lui définir un calendrier dédié.</span>
              </div>

              <div v-if="scope === 'category' && selectedCategoryId" class="flex items-center gap-2 mt-2 px-3.5 py-2.5 rounded-lg bg-background border border-border text-[12.5px] text-foreground">
                <Info class="w-4 h-4 text-muted-foreground shrink-0" />
                <template v-if="currentCategoryDedicatedId">
                  <span class="flex-1">Ce calendrier s'applique uniquement aux employés de la catégorie <strong>{{ selectedCategoryName }}</strong>.</span>
                  <button class="text-[12px] font-medium text-danger underline shrink-0 bg-transparent border-0 cursor-pointer" @click="deleteDedicatedCalendar">
                    Supprimer ce calendrier dédié
                  </button>
                </template>
                <span v-else class="flex-1">
                  Aucun calendrier dédié pour <strong>{{ selectedCategoryName }}</strong>, ces employés suivent le calendrier global.
                  Modifiez les jours ci-dessous puis enregistrez pour créer un calendrier spécifique à cette catégorie.
                </span>
              </div>
            </div>

            <!-- Source unique : composant réutilisé dans l'onboarding -->
            <WorkingDaysConfig />
          </div>
        </div>

        <!-- ══════════ Onglet 2 : Jours fériés ══════════ -->
        <div v-if="activeTab === 'holidays'">

          <div :class="sectionCard">
            <div :class="sectionHeader">
              <h2 class="text-[15px] font-semibold text-foreground">Fériés annuels</h2>
              <div class="flex gap-2 items-center">
                <button :class="[L.btnOutline, '!px-3 !py-1.5 !text-xs']" @click="showHolidayImport = true">
                  <Upload class="w-3.5 h-3.5" /> Importer CSV
                </button>
                <button :class="[L.btnOutline, '!px-3 !py-1.5 !text-xs']" @click="openAddModal('annual')">
                  <Plus class="w-3.5 h-3.5" /> Ajouter
                </button>
              </div>
            </div>
            <div class="overflow-x-auto">
              <table :class="dataTable">
                <thead><tr><th :class="th">Nom</th><th :class="th">Date</th><th :class="th">Actions</th></tr></thead>
                <tbody>
                  <tr v-for="h in annualHolidays" :key="h.id" class="hover:bg-background">
                    <td :class="td">{{ h.name }}</td>
                    <td :class="td"><span :class="dateBadge">{{ formatAnnualDate(h.date) }}</span></td>
                    <td :class="[td, 'flex gap-1']">
                      <button :class="iconBtn" @click="openEditModal(h)"><Pencil class="w-3.5 h-3.5" /></button>
                      <button :class="[iconBtn, 'hover:!bg-danger-bg hover:!text-danger']" @click="deleteHoliday(h.id)"><Trash2 class="w-3.5 h-3.5" /></button>
                    </td>
                  </tr>
                  <tr v-if="annualHolidays.length === 0"><td colspan="3" class="text-center text-muted-foreground p-5">Aucun férié annuel</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div :class="sectionCard">
            <div :class="sectionHeader">
              <h2 class="text-[15px] font-semibold text-foreground">Fériés ponctuels</h2>
              <div class="flex gap-2 items-center">
                <button :class="[L.btnOutline, '!px-3 !py-1.5 !text-xs']" @click="openAddModal('ponctual')">
                  <Plus class="w-3.5 h-3.5" /> Ajouter
                </button>
              </div>
            </div>
            <div class="overflow-x-auto">
              <table :class="dataTable">
                <thead><tr><th :class="th">Nom</th><th :class="th">Date</th><th :class="th">Actions</th></tr></thead>
                <tbody>
                  <tr v-for="h in ponctualHolidays" :key="h.id" class="hover:bg-background">
                    <td :class="td">{{ h.name }}</td>
                    <td :class="td">
                      <span :class="dateBadge">{{ h.date }}</span>
                      <span class="text-[10px] font-bold text-white bg-danger rounded px-1.5 py-px ml-1">{{ h.date.slice(0, 4) }}</span>
                    </td>
                    <td :class="[td, 'flex gap-1']">
                      <button :class="iconBtn" @click="openEditModal(h)"><Pencil class="w-3.5 h-3.5" /></button>
                      <button :class="[iconBtn, 'hover:!bg-danger-bg hover:!text-danger']" @click="deleteHoliday(h.id)"><Trash2 class="w-3.5 h-3.5" /></button>
                    </td>
                  </tr>
                  <tr v-if="ponctualHolidays.length === 0"><td colspan="3" class="text-center text-muted-foreground p-5">Aucun férié ponctuel</td></tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>

        <!-- ══════════ Onglet 3 : Types & Règles de congés ══════════ -->
        <div v-if="activeTab === 'leave-rules'">
          <div :class="sectionCard">
            <div :class="sectionHeader">
              <h2 class="text-[15px] font-semibold text-foreground">Types & Règles de congés</h2>
              <div class="flex gap-2 items-center">
                <button :class="[L.btnOutline, '!px-3 !py-1.5 !text-xs']" @click="showLeaveTypeImport = true">
                  <Upload class="w-3.5 h-3.5" /> Importer CSV
                </button>
                <button :class="[L.btnOutline, '!px-3 !py-1.5 !text-xs']" @click="openAddLT">
                  <Plus class="w-3.5 h-3.5" /> Ajouter un type
                </button>
              </div>
            </div>
            <div class="overflow-x-auto">
              <table :class="dataTable">
                <thead>
                  <tr>
                    <th :class="th" style="width:36px"></th>
                    <th :class="th">Nom</th>
                    <th :class="[th, 'text-center']" style="width:80px">Jours/an</th>
                    <th :class="[th, 'text-center']" style="width:90px">Accum./mois</th>
                    <th :class="[th, 'text-center']" style="width:70px">Préavis</th>
                    <th :class="[th, 'text-center']" style="width:70px">Justif.</th>
                    <th :class="[th, 'text-center']" style="width:60px">Actif</th>
                    <th :class="[th, 'text-center']" style="width:60px">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="lt in leaveTypesStore.leaveTypes" :key="lt.id" class="hover:bg-background">
                    <td :class="td">
                      <div class="w-7 h-7 rounded-md flex items-center justify-center text-white text-[13px]" :style="{ background: lt.color }">
                        <i :class="`ti ${lt.icon}`" aria-hidden="true"></i>
                      </div>
                    </td>
                    <td :class="td">
                      <span class="text-[13px] font-medium text-foreground mr-1">{{ lt.name }}</span>
                      <Lock v-if="lt.isSystem" class="w-3 h-3 text-muted-foreground inline-block align-middle" title="Type système" />
                    </td>
                    <td :class="[td, 'text-center']">
                      <input type="number" min="0" :class="ruleInput" :value="lt.daysPerYear"
                        @change="leaveTypesStore.updateLeaveType(lt.id, { daysPerYear: +($event.target as HTMLInputElement).value })" />
                    </td>
                    <td :class="[td, 'text-center']">
                      <div class="flex flex-col items-center gap-0.5">
                        <label class="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" class="sr-only peer" :checked="lt.monthlyAccrual"
                            @change="leaveTypesStore.updateLeaveType(lt.id, {
                              monthlyAccrual: ($event.target as HTMLInputElement).checked,
                              daysPerMonth: ($event.target as HTMLInputElement).checked ? monthlyAccrualDays(lt.daysPerYear) : undefined,
                            })" />
                          <span :class="toggleTrack"></span>
                        </label>
                        <span v-if="lt.monthlyAccrual" class="text-[10px] text-muted-foreground whitespace-nowrap">{{ monthlyAccrualDays(lt.daysPerYear) }} j</span>
                      </div>
                    </td>
                    <td :class="[td, 'text-center']">
                      <input type="number" min="0" :class="ruleInput" :value="lt.noticeDays"
                        @change="leaveTypesStore.updateLeaveType(lt.id, { noticeDays: +($event.target as HTMLInputElement).value })" />
                    </td>
                    <td :class="[td, 'text-center']">
                      <label class="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" class="sr-only peer" :checked="lt.documentRequired"
                          @change="leaveTypesStore.updateLeaveType(lt.id, { documentRequired: ($event.target as HTMLInputElement).checked })" />
                        <span :class="toggleTrack"></span>
                      </label>
                    </td>
                    <td :class="[td, 'text-center']">
                      <label class="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" class="sr-only peer" :checked="lt.isActive"
                          @change="leaveTypesStore.toggleLeaveType(lt.id)" />
                        <span :class="toggleTrack"></span>
                      </label>
                    </td>
                    <td :class="[td, 'text-center']">
                      <div class="flex gap-1 items-center justify-center">
                        <button :class="iconBtn" title="Modifier" @click="openEditLT(lt.id)">
                          <Pencil class="w-3.5 h-3.5" />
                        </button>
                        <button
                          :class="[iconBtn, 'disabled:opacity-40 disabled:cursor-not-allowed']"
                          :disabled="lt.isSystem"
                          :title="lt.isSystem ? 'Type système : désactivez-le plutôt que de le supprimer' : 'Supprimer'"
                          @click="deleteLT(lt.id)"
                        >
                          <Trash2 class="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div :class="sectionCard">
            <h2 class="text-[15px] font-semibold text-foreground mb-1">Génération des acquisitions</h2>
            <p class="text-[13px] text-muted-foreground mb-4">Crédite automatiquement les jours de congé (mensuels ou annuels) sur le solde de chaque employé.</p>
            <div class="grid grid-cols-3 gap-3.5 items-end max-md:grid-cols-1">
              <div :class="cls.field">
                <label :class="cls.fieldLabel">Jour du mois d'exécution</label>
                <select :class="cls.fieldSelect" :value="accrualRunDay ?? ''" @change="accrualRunDay = ($event.target as HTMLSelectElement).value ? +($event.target as HTMLSelectElement).value : null">
                  <option value="">Manuel uniquement</option>
                  <option v-for="d in 28" :key="d" :value="d">{{ d }}</option>
                </select>
              </div>
              <div :class="cls.field">
                <span :class="cls.fieldLabel">Dernière exécution</span>
                <div class="h-9 flex items-center text-[13px] text-foreground">{{ lastAccrualRun }}</div>
              </div>
              <button :class="L.btnOutline" class="disabled:opacity-45 disabled:cursor-not-allowed" :disabled="generateDisabled" :title="accrualStatusMessage ?? ''" @click="generateAccrualsNow">
                <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': generatingAccruals }" /> Générer maintenant
              </button>
            </div>
            <p v-if="accrualStatusMessage" class="text-[11px] text-muted-foreground mt-2.5">{{ accrualStatusMessage }}</p>
          </div>
        </div>
        </template>

  </div>

  <!-- ── Modal types d'absence ── -->
  <LeaveTypeFormModal v-if="showLTModal" :edit-id="editLTId" @close="showLTModal = false" />

  <!-- ── Import CSV: fériés + types d'absence ── -->
  <ImportWizardModal v-if="showHolidayImport" :open="showHolidayImport" :config="holidayImportConfig" @close="showHolidayImport = false" @imported="calendarStore.fetchHolidays(new Date().getFullYear())" />
  <ImportWizardModal v-if="showLeaveTypeImport" :open="showLeaveTypeImport" :config="leaveTypeImportConfig" @close="showLeaveTypeImport = false" @imported="leaveTypesStore.fetchAll()" />

  <!-- ── Modal férié annuel ── -->
  <CreateModalShell
    v-if="showModal === 'annual'"
    :title="editingHoliday ? 'Modifier le férié annuel' : 'Ajouter un férié annuel'"
    :banner-label="editingHoliday ? 'Modifier le férié annuel' : 'Ajouter un férié annuel'"
    :create-label="editingHoliday ? 'Enregistrer' : 'Ajouter'"
    :save-error="holidayError"
    @close="closeModal"
    @create="saveAnnualHoliday"
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
          <FormSection title="Éligibilité">
            <p class="text-[11px] text-muted-foreground -mt-0.5 mb-3">
              Restreint ce jour férié à une partie des employés. Laissez sur "Tous" pour qu'il s'applique à tout le monde, comme aujourd'hui.
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

  <!-- ── Modal férié ponctuel ── -->
  <CreateModalShell
    v-if="showModal === 'ponctual'"
    :title="editingHoliday ? 'Modifier le férié ponctuel' : 'Ajouter un férié ponctuel'"
    :banner-label="editingHoliday ? 'Modifier le férié ponctuel' : 'Ajouter un férié ponctuel'"
    :create-label="editingHoliday ? 'Enregistrer' : 'Ajouter'"
    :save-error="holidayError"
    @close="closeModal"
    @create="savePonctualHoliday"
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
          <FormSection title="Éligibilité">
            <p class="text-[11px] text-muted-foreground -mt-0.5 mb-3">
              Restreint ce jour férié à une partie des employés. Laissez sur "Tous" pour qu'il s'applique à tout le monde, comme aujourd'hui.
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

<script setup lang="ts">
import { ref, reactive, computed, type Component } from 'vue'
import { storeToRefs } from 'pinia'
import {
  ClockArrowDown, Clock, CalendarDays, ListChecks, Upload, Plus,
  Pencil, Trash2, Lock, Info, RefreshCw, Save, Globe, Tag,
} from 'lucide-vue-next'
import LeaveTypeFormModal from '../../components/configuration/LeaveTypeFormModal.vue'
import WorkingDaysConfig  from '../../components/calendar/WorkingDaysConfig.vue'
import CreateModalShell from '../../components/shared/CreateModalShell.vue'
import FormSection from '../../components/ui/form-field/FormSection.vue'
import EligibilityFields from '../../components/ui/form-field/EligibilityFields.vue'
import { SkeletonLoader } from '../../components'
import ImportWizardModal from '../../components/shared/import/ImportWizardModal.vue'
import { buildHolidayImportConfig } from '../../components/shared/import/configs/holidayImportConfig'
import { buildLeaveTypeImportConfig } from '../../components/shared/import/configs/leaveTypeImportConfig'
import * as cls from '../../lib/formClasses'
import * as L from '../../lib/listClasses'
import { confirmDialog } from '../../lib/confirm'
import { useCalendarStore }   from '../../stores/calendar'
import { useLeaveTypesStore } from '../../stores/leaveTypes'
import { useLeaveTransactionStore } from '../../stores/leaveTransactions'
import { useCompanySettingsStore }  from '../../stores/companySettings'
import { useEmployeeCategoryStore } from '../../stores/employeeCategories'
import { useEntityStore } from '../../stores/entities'
import type { Holiday } from '../../types'

const calendarStore   = useCalendarStore()
const leaveTypesStore = useLeaveTypesStore()
const leaveTransactionStore = useLeaveTransactionStore()
const companySettingsStore  = useCompanySettingsStore()
const categoryStore    = useEmployeeCategoryStore()
const entityStore      = useEntityStore()
if (entityStore.entities.length === 0) entityStore.fetchAll()
const { calendar, annualHolidays, ponctualHolidays } = storeToRefs(calendarStore)

const pageLoading = computed(() => calendarStore.loading || leaveTypesStore.loading)

const showHolidayImport = ref(false)
const showLeaveTypeImport = ref(false)
const holidayImportConfig = computed(() => buildHolidayImportConfig())
const leaveTypeImportConfig = computed(() => buildLeaveTypeImportConfig())

// ── Portée du calendrier : global (par défaut) ou par catégorie d'employés
// (décision du 04/08 — catégorie uniquement, pas de surcharge par employé) ──
// Le choix est persisté côté serveur (CompanySettings.CalendarConfigScope),
// pas en localStorage — un réglage de config doit survivre au changement de
// navigateur/poste, pas rester coincé sur le poste de l'admin qui l'a fait.
const scope = ref<'global' | 'category'>('global')
const selectedCategoryId = ref('')
const configuredCategoryCalendars = ref<{ id: string; employeeCategoryId: string }[]>([])

function persistScope() {
  companySettingsStore.updateCalendarScope(
    scope.value === 'category' ? 'Category' : 'Global',
    scope.value === 'category' ? selectedCategoryId.value || null : null,
  )
}

function refreshConfiguredCategoryCalendars() {
  calendarStore.fetchConfiguredCategoryCalendars().then((list) => { configuredCategoryCalendars.value = list })
}
refreshConfiguredCategoryCalendars()

// v-model a deja pousse la nouvelle valeur dans selectedCategoryId au
// moment ou @change se declenche — si l'utilisateur annule (modifications
// non enregistrees), il faut restaurer explicitement l'ancienne valeur,
// sinon le select affiche la nouvelle categorie alors que les jours
// affiches sont toujours ceux de l'ancienne. Déclaré avant l'IIFE
// ci-dessous (qui l'assigne dès le chargement initial si une portée par
// catégorie était persistée).
let lastConfirmedCategoryId = ''

// Restaure la portée choisie à la dernière visite (onglet Jours de travail)
// — sans ça, la page revenait toujours sur "Global" au rechargement, même
// si l'admin était en train de configurer une catégorie précise. Lue depuis
// CompanySettings (pas localStorage) : ce réglage doit être le même pour
// n'importe quel admin, sur n'importe quel poste. Attend que les catégories
// soient chargées pour valider que celle stockée existe toujours (ex :
// supprimée depuis) avant de basculer dessus.
;(async () => {
  const [, ] = await Promise.all([
    categoryStore.categories.length === 0 ? categoryStore.fetchAll().catch(() => {}) : Promise.resolve(),
    companySettingsStore.settings ? Promise.resolve() : companySettingsStore.fetchSettings().catch(() => {}),
  ])
  const storedScope = companySettingsStore.settings?.calendarConfigScope
  const storedCategoryId = companySettingsStore.settings?.calendarConfigCategoryId
  if (
    storedScope === 'Category' &&
    storedCategoryId &&
    categoryStore.categories.some(c => c.id === storedCategoryId)
  ) {
    scope.value = 'category'
    selectedCategoryId.value = storedCategoryId
    lastConfirmedCategoryId = storedCategoryId
    await calendarStore.fetchCalendarByCategory(storedCategoryId)
  } else {
    await calendarStore.fetchDefaultCalendar()
  }
})()

function categoryHasDedicatedCalendar(categoryId: string): boolean {
  return configuredCategoryCalendars.value.some(c => c.employeeCategoryId === categoryId)
}
const currentCategoryDedicatedId = computed(() =>
  configuredCategoryCalendars.value.find(c => c.employeeCategoryId === selectedCategoryId.value)?.id ?? null,
)
const selectedCategoryName = computed(() =>
  categoryStore.categories.find(c => c.id === selectedCategoryId.value)?.name ?? '',
)

// Change de portée sans confirmation efface les modifications non
// enregistrées (WorkingDaysConfig n'a pas de brouillon séparé, voir
// stores/calendar.ts) — on prévient avant d'écraser un travail en cours.
async function confirmDiscardIfDirty(): Promise<boolean> {
  if (!calendarStore.isDirty) return true
  return confirmDialog('Des modifications non enregistrées seront perdues. Continuer ?')
}

async function selectGlobalScope() {
  if (scope.value === 'global') return
  if (!(await confirmDiscardIfDirty())) return
  scope.value = 'global'
  persistScope()
  await calendarStore.fetchDefaultCalendar()
}
async function selectCategoryScope() {
  if (scope.value === 'category') return
  if (!(await confirmDiscardIfDirty())) return
  scope.value = 'category'
  if (!selectedCategoryId.value && categoryStore.categories[0]) {
    selectedCategoryId.value = categoryStore.categories[0].id
  }
  lastConfirmedCategoryId = selectedCategoryId.value
  persistScope()
  if (selectedCategoryId.value) await calendarStore.fetchCalendarByCategory(selectedCategoryId.value)
}
async function onCategoryChange() {
  if (!(await confirmDiscardIfDirty())) {
    selectedCategoryId.value = lastConfirmedCategoryId
    return
  }
  lastConfirmedCategoryId = selectedCategoryId.value
  persistScope()
  if (selectedCategoryId.value) await calendarStore.fetchCalendarByCategory(selectedCategoryId.value)
}

async function deleteDedicatedCalendar() {
  const id = currentCategoryDedicatedId.value
  if (!id || !selectedCategoryId.value) return
  if (!(await confirmDialog(`Supprimer le calendrier dédié à "${selectedCategoryName.value}" ? Ces employés suivront de nouveau le calendrier global.`))) return
  try {
    await calendarStore.deleteCategoryCalendar(id, selectedCategoryId.value)
    refreshConfiguredCategoryCalendars()
  } catch {
    // calendarStore.error porte le message pour l'UI (toast)
  }
}

// ── Génération des acquisitions (cron) ─────────────────────────
// dayJustChanged : changer le jour d'exécution réactive le bouton manuel
// même si une génération a déjà eu lieu ce mois-ci (voir generateDisabled
// ci-dessous) — modifier la date ne déclenche rien tout de suite (le cron
// ne tourne qu'au jour configuré, à 1h), c'est juste un déverrouillage.
const dayJustChanged = ref(false)
const accrualRunDay = computed({
  get: () => companySettingsStore.settings?.leaveAccrualRunDay ?? null,
  set: (value: number | null) => {
    dayJustChanged.value = true
    companySettingsStore.update({ leaveAccrualRunDay: value })
  },
})
const lastAccrualRun = computed(() => {
  const raw = companySettingsStore.settings?.lastLeaveAccrualRunAt
  return raw ? new Date(raw).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : 'Jamais exécuté'
})
const alreadyRanThisMonth = computed(() => {
  const raw = companySettingsStore.settings?.lastLeaveAccrualRunAt
  if (!raw) return false
  const last = new Date(raw)
  const now = new Date()
  return last.getFullYear() === now.getFullYear() && last.getMonth() === now.getMonth()
})
// En mode "Manuel uniquement" (pas de jour configuré), le bouton est le seul
// moyen de générer — pas de verrou mensuel, sinon on prive l'entreprise de
// son unique outil pendant un mois entier.
const generateDisabled = computed(() =>
  generatingAccruals.value || (accrualRunDay.value !== null && alreadyRanThisMonth.value && !dayJustChanged.value),
)
const accrualStatusMessage = computed(() => {
  if (dayJustChanged.value) {
    return "Date modifiée : ça ne déclenche rien immédiatement, la prochaine génération automatique aura lieu au jour configuré, à 1h du matin."
  }
  if (accrualRunDay.value !== null && alreadyRanThisMonth.value) {
    return `Déjà généré ce mois-ci (${lastAccrualRun.value}). Prochaine génération automatique le ${accrualRunDay.value} du mois, à 1h.`
  }
  return null
})
const generatingAccruals = ref(false)
async function generateAccrualsNow() {
  generatingAccruals.value = true
  try {
    await leaveTransactionStore.generateAccruals()
    await companySettingsStore.fetchSettings()
    dayJustChanged.value = false
  } finally {
    generatingAccruals.value = false
  }
}
calendarStore.fetchHolidays(new Date().getFullYear())
leaveTypesStore.fetchAll()

// ── Jours ouvrables : enregistrement explicite (pas d'auto-save par edit,
// voir WorkingDaysConfig.vue) ───────────────────────────────────
const savingWorkingDays = ref(false)
async function saveWorkingDays() {
  if (calendarStore.hasWorkingDaysError) return
  savingWorkingDays.value = true
  try {
    const newName = scope.value === 'category' && !currentCategoryDedicatedId.value
      ? `Calendrier · ${selectedCategoryName.value}`
      : undefined
    await calendarStore.updateWorkingDays(calendarStore.calendar.workingDays, newName)
    if (scope.value === 'category') refreshConfiguredCategoryCalendars()
  } catch {
    // calendarStore.error porte le message pour l'UI (toast)
  } finally {
    savingWorkingDays.value = false
  }
}

// ── Classes du design system ─────────────────────────────────
const tabBtn = 'flex items-center gap-1.5 px-[18px] py-2.5 text-[13px] font-medium text-muted-foreground bg-transparent border-0 border-b-2 border-transparent cursor-pointer whitespace-nowrap transition-colors hover:text-foreground'
const tabActive = '!text-primary !border-primary'
const scopeBtn = 'inline-flex items-center gap-1.5 px-3.5 py-2 h-9 rounded-md text-[13px] font-medium border border-border bg-background text-muted-foreground cursor-pointer transition-colors hover:bg-card hover:text-foreground'
const scopeActive = '!bg-primary/10 !text-primary !border-primary'
const sectionCard = 'bg-card border border-border rounded-[10px] p-5 mb-4'
const sectionHeader = 'flex items-center justify-between mb-4 gap-3 flex-wrap'
const dataTable = 'w-full border-collapse text-[13px]'
const th = 'text-left px-3 py-2 text-[11px] font-bold text-muted-foreground uppercase tracking-[0.06em] bg-background border-b border-border'
const td = 'px-3 py-2.5 border-b border-border text-foreground'
const dateBadge = 'text-xs font-medium bg-background border border-border rounded px-2 py-0.5 mr-1.5'
const iconBtn = 'w-7 h-7 flex items-center justify-center border-0 rounded-md bg-background text-muted-foreground cursor-pointer transition-colors hover:bg-primary/10 hover:text-primary'
const ruleInput = 'w-[60px] h-7 px-1.5 text-center border border-border rounded bg-background text-xs text-foreground outline-none focus:border-primary'
const toggleTrack = "w-8 h-[18px] rounded-full bg-border transition-colors peer-checked:bg-primary relative after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-3.5 after:h-3.5 after:bg-white after:rounded-full after:shadow after:transition-all peer-checked:after:left-[16px]"

// ── Modal types d'absence ─────────────────────────────────────
const showLTModal = ref(false)
const editLTId    = ref<string | undefined>(undefined)
function openAddLT() { editLTId.value = undefined; showLTModal.value = true }
function openEditLT(id: string) { editLTId.value = id; showLTModal.value = true }
async function deleteLT(id: string) {
  if (!(await confirmDialog('Supprimer ce type de congé ?'))) return
  try {
    await leaveTypesStore.deleteLeaveType(id)
  } catch {
    // leaveTypesStore.error porte le message pour l'UI
  }
}

// ── Tabs ──────────────────────────────────────────────────────
const activeTab = ref<'working-days' | 'holidays' | 'leave-rules'>('working-days')
const TABS: { id: 'working-days' | 'holidays' | 'leave-rules'; label: string; icon: Component }[] = [
  { id: 'working-days', label: 'Jours de travail',          icon: Clock        },
  { id: 'holidays',     label: 'Jours fériés',              icon: CalendarDays },
  { id: 'leave-rules',  label: 'Types & Règles de congés',  icon: ListChecks   },
]

// ── Règles éditées ────────────────────────────────────────────
// Édite directement les champs du VRAI LeaveType (daysPerYear/daysPerMonth/
// noticeDays/documentRequired existent déjà sur leaveTypesStore.leaveTypes —
// pas de calque "LeaveRule" séparé qui ne persisterait nulle part). Chaque
// champ s'enregistre immédiatement au blur (@change) — leaveTypesStore
// affiche déjà son propre toast via withToast(), pas besoin d'un état local.
//
// Accum./mois n'est plus un nombre saisi ici non plus (voir
// LeaveTypeFormModal.vue) — juste une case a cocher, la valeur est toujours
// derivee de Jours/an. Formule dupliquee ici plutot que partagee avec le
// modal : deux composants independants, pas besoin d'un import croise pour
// un calcul aussi court.
function monthlyAccrualDays(daysPerYear: number): number {
  return Math.round((daysPerYear / 12) * 100) / 100
}

// ── Display helpers ───────────────────────────────────────────
// Holiday.date est toujours une date complete "YYYY-MM-DD" (backend) — pour
// un ferie recurrent, seuls le mois et le jour sont significatifs.
function formatAnnualDate(date: string): string {
  const M = ['','jan','fév','mar','avr','mai','jun','jul','aoû','sep','oct','nov','déc']
  const p = date.split('-')
  return `${p[2] ?? ''} ${M[parseInt(p[1] ?? '0')] ?? ''}`
}

// ── Modals fériés ─────────────────────────────────────────────
const showModal      = ref<'annual' | 'ponctual' | null>(null)
const editingHoliday = ref<Holiday | null>(null)
const MONTHS = [
  {v:'01',l:'Janvier'},{v:'02',l:'Février'},{v:'03',l:'Mars'},{v:'04',l:'Avril'},
  {v:'05',l:'Mai'},{v:'06',l:'Juin'},{v:'07',l:'Juillet'},{v:'08',l:'Août'},
  {v:'09',l:'Septembre'},{v:'10',l:'Octobre'},{v:'11',l:'Novembre'},{v:'12',l:'Décembre'},
]
const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2,'0'))
const hForm = reactive({ name: '', month: '01', day: '01', fullDate: '' })
const holidayError = ref('')
// Ciblage d'eligibilite (voir EligibilityFields.vue), partage par les deux
// modales (annuel/ponctuel) comme le reste de hForm.
const appliesToGenderText = ref('')
const appliesToExpatriateText = ref('')
// Entite concernee — vide = National (s'applique a toute l'entreprise, comme
// avant), une entite choisie => Local (voir saveAnnualHoliday/savePonctualHoliday).
const organizationUnitIdText = ref('')

function openAddModal(type: 'annual' | 'ponctual') {
  editingHoliday.value = null
  hForm.name = ''; hForm.month = '01'; hForm.day = '01'; hForm.fullDate = ''
  appliesToGenderText.value = ''
  appliesToExpatriateText.value = ''
  organizationUnitIdText.value = ''
  holidayError.value = ''
  showModal.value = type
}
function openEditModal(h: Holiday) {
  editingHoliday.value = h
  hForm.name = h.name
  appliesToGenderText.value = h.appliesToGender ?? ''
  appliesToExpatriateText.value = h.appliesToExpatriate === undefined || h.appliesToExpatriate === null ? '' : String(h.appliesToExpatriate)
  organizationUnitIdText.value = h.organizationUnitId ?? ''
  holidayError.value = ''
  if (h.isRecurring) {
    const p = h.date.split('-')
    hForm.month = p[1] ?? '01'
    hForm.day   = p[2] ?? '01'
    showModal.value = 'annual'
  } else {
    hForm.fullDate  = h.date
    showModal.value = 'ponctual'
  }
}
function closeModal() { showModal.value = null; editingHoliday.value = null; holidayError.value = '' }

async function saveAnnualHoliday() {
  if (!hForm.name.trim()) { holidayError.value = 'Le nom est obligatoire'; return }
  // Annee de reference arbitraire — seuls mois/jour comptent pour un ferie
  // recurrent (le backend remappe sur l'annee demandee via /holidays/year/:year).
  const date = `2000-${hForm.month}-${hForm.day}`
  const appliesToGender = appliesToGenderText.value ? (appliesToGenderText.value as 'M' | 'F') : undefined
  const appliesToExpatriate = appliesToExpatriateText.value === '' ? undefined : appliesToExpatriateText.value === 'true'
  const organizationUnitId = organizationUnitIdText.value || undefined
  const holidayType = organizationUnitId ? 'Local' : 'National'
  holidayError.value = ''
  try {
    if (editingHoliday.value) {
      await calendarStore.updateHoliday(editingHoliday.value.id, { name: hForm.name, date, holidayType, organizationUnitId, appliesToGender, appliesToExpatriate })
    } else {
      await calendarStore.addHoliday({ name: hForm.name, date, isRecurring: true, holidayType, organizationUnitId, appliesToGender, appliesToExpatriate })
    }
    closeModal()
  } catch {
    holidayError.value = calendarStore.error ?? "L'enregistrement a échoué. Veuillez réessayer."
  }
}

async function savePonctualHoliday() {
  if (!hForm.name.trim()) { holidayError.value = 'Le nom est obligatoire'; return }
  if (!hForm.fullDate) { holidayError.value = 'La date est obligatoire'; return }
  const appliesToGender = appliesToGenderText.value ? (appliesToGenderText.value as 'M' | 'F') : undefined
  const appliesToExpatriate = appliesToExpatriateText.value === '' ? undefined : appliesToExpatriateText.value === 'true'
  const organizationUnitId = organizationUnitIdText.value || undefined
  const holidayType = organizationUnitId ? 'Local' : 'National'
  holidayError.value = ''
  try {
    if (editingHoliday.value) {
      await calendarStore.updateHoliday(editingHoliday.value.id, { name: hForm.name, date: hForm.fullDate, holidayType, organizationUnitId, appliesToGender, appliesToExpatriate })
    } else {
      await calendarStore.addHoliday({ name: hForm.name, date: hForm.fullDate, isRecurring: false, holidayType, organizationUnitId, appliesToGender, appliesToExpatriate })
    }
    closeModal()
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

</script>
