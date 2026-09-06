<template>
  <div class="px-7 py-6 flex flex-col gap-4">

        <!-- En-tête -->
        <div class="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 class="text-xl font-bold text-foreground">Configuration des missions</h1>
            <p class="text-[13px] text-muted-foreground mt-0.5">Définissez les types de frais et leurs règles par catégorie d'employé</p>
          </div>
        </div>

        <SkeletonLoader v-if="initialLoading" type="table" :lines="6" />
        <template v-else>

        <!-- Types de frais (taux + plafond dans la meme grille) -->
        <div :class="L.tableCard">
          <div class="flex items-start justify-between px-5 pt-4 gap-3 flex-wrap">
            <h2 class="text-[15px] font-semibold text-foreground">Types de frais</h2>
            <button :class="[L.btnOutline, '!px-3 !py-1.5 !text-xs']" @click="openAddFee">
              <Plus class="w-3.5 h-3.5" /> Ajouter un type de frais
            </button>
          </div>

          <div class="flex items-center gap-2 px-5 pt-3">
            <span class="text-[12px] font-medium text-muted-foreground">Catégorie de mission :</span>
            <div class="flex rounded-md border border-border overflow-hidden">
              <button
                v-for="mc in MISSION_CATEGORIES"
                :key="mc"
                :class="[
                  'px-3 py-1.5 text-[12px] font-medium transition-colors',
                  selectedMissionCategory === mc ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-background',
                ]"
                @click="selectedMissionCategory = mc"
              >{{ MISSION_CATEGORY_LABELS[mc] }}</button>
            </div>
          </div>

          <div class="overflow-x-auto pb-1">
            <table class="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  <th :class="thUpper">Catégorie</th>
                  <th :class="thUpper">Montant</th>
                  <th :class="thUpper">Plafond</th>
                  <th :class="thUpper">Actions</th>
                </tr>
              </thead>
              <tbody>
                <template v-for="ft in visibleExpenseTypes" :key="ft.id">
                  <tr class="bg-background">
                    <td :class="tdCell" colspan="3">
                      <div class="flex items-baseline gap-1.5">
                        <span class="font-medium text-foreground">{{ ft.name }}</span>
                        <span class="text-[11px] text-muted-foreground">{{ unitLabel(ft.unit) }}</span>
                      </div>
                    </td>
                    <td :class="tdCell">
                      <div class="flex gap-1 justify-center">
                        <button :class="iconBtn" @click="openEditFee(ft.id)">
                          <Pencil class="w-3.5 h-3.5" />
                        </button>
                        <button :class="[iconBtn, 'hover:!bg-danger-bg hover:!text-danger']" @click="deleteFee(ft.id, ft.name)">
                          <Trash2 class="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  <tr v-for="cat in store.categories" :key="cat.id" class="hover:bg-background">
                    <td :class="tdCell">{{ cat.name }}</td>
                    <td :class="tdCell">
                      <div class="flex items-center gap-1.5">
                        <template v-if="editing?.feeId === ft.id && editing?.catId === cat.id">
                          <input
                            type="number"
                            min="0"
                            class="w-[90px] h-7 px-1.5 border border-primary rounded text-[13px] bg-card outline-none"
                            :value="getAmount(ft.id, cat.id)"
                            @change="onAmountChange(ft.id, cat.id, $event)"
                            @blur="editing = null"
                            ref="amountInputRef"
                          />
                        </template>
                        <template v-else>
                          <span
                            v-if="getAmount(ft.id, cat.id) === 0"
                            class="text-[11px] font-semibold bg-info-bg text-info rounded px-[7px] py-0.5 cursor-pointer whitespace-nowrap hover:opacity-75"
                            @click="startEdit(ft.id, cat.id)"
                          >Au réel</span>
                          <span
                            v-else
                            class="text-[13px] font-medium text-foreground cursor-pointer whitespace-nowrap hover:text-primary"
                            @click="startEdit(ft.id, cat.id)"
                          >{{ fmt(getAmount(ft.id, cat.id)) }}<span class="text-[10px] text-muted-foreground ml-0.5">{{ getCurrency(ft.id, cat.id) }}</span></span>
                        </template>
                      </div>
                    </td>
                    <td :class="tdCell">
                      <template v-if="editingCeiling?.feeId === ft.id && editingCeiling?.catId === cat.id">
                        <input
                          type="number"
                          min="0"
                          class="w-[90px] h-7 px-1.5 border border-primary rounded text-[13px] bg-card outline-none"
                          :value="getCeilingAmount(ft.id, cat.id)"
                          @change="onCeilingAmountChange(ft.id, cat.id, $event)"
                          @blur="editingCeiling = null"
                          ref="ceilingInputRef"
                        />
                      </template>
                      <template v-else>
                        <span
                          v-if="getCeilingAmount(ft.id, cat.id) === 0"
                          class="text-[11px] font-semibold bg-info-bg text-info rounded px-[7px] py-0.5 cursor-pointer whitespace-nowrap hover:opacity-75"
                          @click="startEditCeiling(ft.id, cat.id)"
                        >Aucun plafond</span>
                        <span
                          v-else
                          class="text-[13px] font-medium text-foreground cursor-pointer whitespace-nowrap hover:text-primary"
                          @click="startEditCeiling(ft.id, cat.id)"
                        >{{ fmt(getCeilingAmount(ft.id, cat.id)) }}<span class="text-[10px] text-muted-foreground ml-0.5">{{ getCeilingCurrency(ft.id, cat.id) }}</span></span>
                      </template>
                    </td>
                    <td :class="tdCell"></td>
                  </tr>
                </template>
                <tr v-if="visibleExpenseTypes.length === 0">
                  <td colspan="4" class="text-center p-6 text-muted-foreground italic">Aucun type de frais configuré</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="text-[11px] text-muted-foreground px-4 pt-2 pb-3">
            Cliquez sur un montant ou un plafond pour le modifier. "Au réel" signifie remboursement sur justificatif ;
            "Aucun plafond" signifie pas de limite.
          </p>
        </div>

        </template>

  </div>

  <!-- Modal type de frais -->
  <CreateModalShell
    v-if="showFeeModal"
    :title="editingFeeId ? 'Modifier le type de frais' : 'Nouveau type de frais'"
    :banner-label="editingFeeId ? 'Modifier le type de frais' : 'Nouveau type de frais'"
    :create-label="editingFeeId ? 'Enregistrer' : 'Ajouter'"
    :save-error="feeError"
    @close="showFeeModal = false"
    @create="saveFee"
  >
    <template #form>
      <div class="flex-1 overflow-auto px-6 py-5">
        <div class="max-w-md mx-auto">
          <FormSection title="Informations générales">
            <div class="flex flex-col gap-3.5">
              <div :class="cls.field">
                <label :class="cls.fieldLabel">Nom *</label>
                <input v-model="feeForm.name" :class="cls.fieldInput" placeholder="ex: Repas" @input="onFeeNameInput" />
              </div>
              <div :class="cls.field">
                <label :class="cls.fieldLabel">Code</label>
                <input v-model="feeForm.code" :class="cls.fieldInput" placeholder="ex: REPA-001" @input="feeCodeTouched = true" />
              </div>
              <div :class="cls.field">
                <label :class="cls.fieldLabel">Unité</label>
                <select v-model="feeForm.unit" :class="cls.fieldSelect">
                  <option value="PerDay">Par jour</option>
                  <option value="PerTrip">Forfait (par mission)</option>
                  <option value="PerItem">Par unité</option>
                </select>
              </div>
            </div>
          </FormSection>
          <p class="text-[11px] text-muted-foreground mt-3">
            Le taux et le justificatif requis se configurent ensuite directement dans la grille, pour chaque catégorie d'employé et chaque catégorie de mission.
          </p>
        </div>
      </div>
    </template>
  </CreateModalShell>
</template>

<script setup lang="ts">
import { ref, reactive, computed, nextTick } from 'vue'
import { Plus, Pencil, Trash2 } from 'lucide-vue-next'
import CreateModalShell from '../../components/shared/CreateModalShell.vue'
import FormSection from '../../components/ui/form-field/FormSection.vue'
import { SkeletonLoader } from '../../components'
import * as cls from '../../lib/formClasses'
import * as L from '../../lib/listClasses'
import { suggestCode } from '../../lib/codeGen'
import { confirmDialog } from '../../lib/confirm'
import { useMissionConfigStore } from '../../stores/missionConfig'
import type { ExpenseUnit, MissionCategory } from '../../stores/missionConfig'

const store = useMissionConfigStore()

// Le type systeme "Autre" (secours toujours dispo dans la fiche de note de
// frais) n'a pas sa place dans cette grille de config — il n'a ni taux ni
// plafond a definir, voir decision du 12/08.
const visibleExpenseTypes = computed(() => store.expenseTypes.filter(t => !t.isSystem))

const initialLoading = ref(true)
;(async () => {
  await Promise.all([
    store.categories.length === 0 ? store.fetchCategories() : Promise.resolve(),
    store.expenseTypes.length === 0 ? store.fetchExpenseTypes() : Promise.resolve(),
    store.configs.length === 0 ? store.fetchConfigs() : Promise.resolve(),
    store.ceilings.length === 0 ? store.fetchCeilings() : Promise.resolve(),
  ])
  initialLoading.value = false
})()

// ── Classes du design system ─────────────────────────────────
const thUpper = 'px-3 py-2.5 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-[0.05em] bg-background border-b border-border whitespace-nowrap'
const tdCell = 'px-3 py-2.5 border-b border-border'
const iconBtn = 'w-7 h-7 flex items-center justify-center border-0 rounded-md bg-background text-muted-foreground cursor-pointer transition-colors hover:bg-primary/10 hover:text-primary'

const amountInputRef = ref<HTMLInputElement | null>(null)

function fmt(n: number): string { return n.toLocaleString('fr-FR') }
function unitLabel(unit: ExpenseUnit): string {
  return unit === 'PerDay' ? '/jour' : unit === 'PerTrip' ? 'forfait mission' : 'par unité'
}

// ── Catégorie de mission (3e dimension de la matrice ExpenseConfig) ──
const MISSION_CATEGORIES: MissionCategory[] = ['National', 'International']
const MISSION_CATEGORY_LABELS: Record<MissionCategory, string> = {
  National: 'Nationale', International: 'Internationale',
}
const selectedMissionCategory = ref<MissionCategory>('National')

// ── Montants + justificatif inline (grille 3D) ──
const editing = ref<{ feeId: string; catId: string } | null>(null)

function getAmount(feeId: string, catId: string): number {
  return store.getConfig(feeId, catId, selectedMissionCategory.value)?.dailyRate ?? 0
}
function getCurrency(feeId: string, catId: string): string {
  return store.getConfig(feeId, catId, selectedMissionCategory.value)?.currency ?? 'MGA'
}
function startEdit(feeId: string, catId: string) {
  editing.value = { feeId, catId }
  nextTick(() => amountInputRef.value?.focus())
}

function onAmountChange(feeId: string, catId: string, event: Event) {
  const val = Number((event.target as HTMLInputElement).value)
  store.upsertConfig(feeId, catId, selectedMissionCategory.value, { dailyRate: val })
}

// ── Plafonds des notes de frais (Categorie x Type, sans dimension mission) ──
const editingCeiling = ref<{ feeId: string; catId: string } | null>(null)
const ceilingInputRef = ref<HTMLInputElement | null>(null)

function getCeilingAmount(feeId: string, catId: string): number {
  return store.getCeiling(feeId, catId)?.maxAmount ?? 0
}
function getCeilingCurrency(feeId: string, catId: string): string {
  return store.getCeiling(feeId, catId)?.currency ?? 'MGA'
}
function startEditCeiling(feeId: string, catId: string) {
  editingCeiling.value = { feeId, catId }
  nextTick(() => ceilingInputRef.value?.focus())
}
function onCeilingAmountChange(feeId: string, catId: string, event: Event) {
  const val = Number((event.target as HTMLInputElement).value)
  store.upsertCeiling(feeId, catId, { maxAmount: val })
}

// ── Modal type de frais ──
const showFeeModal  = ref(false)
const editingFeeId  = ref<string | null>(null)
const feeError      = ref('')
const feeForm       = reactive({ name: '', code: '', unit: 'PerDay' as ExpenseUnit })

// Le code suit le nom tant que l'utilisateur ne l'a pas modifié à la main
// (voir décision du 25/07 : suggestion courte dérivée du nom, modifiable).
const feeCodeTouched = ref(false)
function onFeeNameInput() {
  if (!feeCodeTouched.value) feeForm.code = suggestCode(feeForm.name, store.expenseTypes.length)
}

function openAddFee() {
  editingFeeId.value  = null
  feeError.value      = ''
  feeCodeTouched.value = false
  feeForm.name        = ''
  feeForm.code        = ''
  feeForm.unit        = 'PerDay'
  showFeeModal.value  = true
}

function openEditFee(id: string) {
  const ft = store.expenseTypes.find(f => f.id === id)
  if (!ft) return
  editingFeeId.value = id
  feeError.value     = ''
  feeCodeTouched.value = true
  feeForm.name       = ft.name
  feeForm.code       = ft.code
  feeForm.unit       = ft.unit
  showFeeModal.value = true
}

async function saveFee() {
  if (!feeForm.name.trim()) { feeError.value = 'Le nom est obligatoire'; return }
  feeError.value = ''
  try {
    if (editingFeeId.value) {
      await store.updateExpenseType(editingFeeId.value, { name: feeForm.name, code: feeForm.code, unit: feeForm.unit })
    } else {
      await store.addExpenseType({ name: feeForm.name, code: feeForm.code, unit: feeForm.unit })
    }
    showFeeModal.value = false
  } catch {
    feeError.value = store.error ?? "L'enregistrement a échoué. Veuillez réessayer."
  }
}

async function deleteFee(id: string, name: string) {
  if (!(await confirmDialog(`Supprimer le type de frais « ${name} » ?`))) return
  try {
    await store.deleteExpenseType(id)
  } catch {
    // store.error porte le message pour l'UI (toast)
  }
}
</script>
