<template>
  <div class="px-7 py-6 flex flex-col gap-4">

    <!-- En-tête -->
    <div>
      <h1 class="text-xl font-bold text-foreground">Classification</h1>
      <p class="text-[13px] text-muted-foreground mt-0.5">Catégories, métiers et postes : la structure qui classe chaque employé et détermine ses permissions et son taux de frais</p>
    </div>

    <!-- Onglets -->
    <div class="flex gap-1.5 border-b border-border">
      <button
        v-for="tb in TABS" :key="tb.key"
        class="px-3.5 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors"
        :class="activeTab === tb.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'"
        @click="activeTab = tb.key"
      >{{ tb.label }}</button>
    </div>

    <!-- ═══════════ Onglet Catégorie ═══════════ -->
    <template v-if="activeTab === 'category'">
      <div class="flex items-start justify-between gap-4 flex-wrap">
        <p class="text-[13px] text-muted-foreground">Classent les employés, déterminent leur taux de frais/perdiem et le paquet de permissions de leur compte utilisateur</p>
        <div class="flex gap-2">
          <button :class="L.btnOutline" @click="showCatImport = true">
            <Upload class="w-4 h-4" /> Importer
          </button>
          <button :class="L.btnPrimary" @click="openAddCat">
            <Plus class="w-4 h-4" /> Ajouter une catégorie
          </button>
        </div>
      </div>

      <SkeletonLoader v-if="catStore.loading" type="table" :lines="5" />
      <div v-else :class="L.tableCard">
        <DataTable :columns="catColumns" :rows="catStore.categories" row-key="id">
          <template #cell-permissions="{ row }">{{ row.permissions.length }} permission(s)</template>
          <template #cell-employeeCount="{ row }">{{ row.employeeCount }} employé(s)</template>
          <template #cell-isActive="{ row }">
            <span :class="row.isActive ? 'text-success' : 'text-muted-foreground'">{{ row.isActive ? 'Actif' : 'Inactif' }}</span>
          </template>
          <template #cell-actions="{ row }">
            <div class="flex gap-1 justify-center">
              <button :class="iconBtn" title="Permissions" @click="openPermissions(row)">
                <ShieldCheck class="w-3.5 h-3.5" />
              </button>
              <button :class="iconBtn" title="Modifier" @click="openEditCat(row)">
                <Pencil class="w-3.5 h-3.5" />
              </button>
              <button :class="[iconBtn, 'hover:!bg-danger-bg hover:!text-danger']" title="Supprimer" @click="removeCat(row)">
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>
          </template>
        </DataTable>
        <p v-if="catStore.categories.length === 0" class="text-center p-6 text-muted-foreground italic text-sm">Aucune catégorie configurée</p>
      </div>
    </template>

    <!-- ═══════════ Onglet Métier ═══════════ -->
    <template v-else-if="activeTab === 'job'">
      <div class="flex items-start justify-between gap-4 flex-wrap">
        <p class="text-[13px] text-muted-foreground">Catalogue des métiers utilisés pour définir les postes</p>
        <div class="flex gap-2">
          <button :class="L.btnOutline" @click="showJobImport = true">
            <Upload class="w-4 h-4" /> Importer
          </button>
          <button :class="L.btnPrimary" @click="openAddJob">
            <Plus class="w-4 h-4" /> Ajouter un métier
          </button>
        </div>
      </div>

      <SkeletonLoader v-if="jobStore.jobs.length === 0 && jobStore.loading" type="table" :lines="5" />
      <div v-else :class="L.tableCard">
        <DataTable :columns="jobColumns" :rows="jobStore.jobs" row-key="id">
          <template #cell-isActive="{ row }">
            <span :class="row.isActive ? 'text-success' : 'text-muted-foreground'">{{ row.isActive ? 'Actif' : 'Inactif' }}</span>
          </template>
          <template #cell-actions="{ row }">
            <div class="flex gap-1 justify-center">
              <button :class="iconBtn" title="Modifier" @click="openEditJob(row)">
                <Pencil class="w-3.5 h-3.5" />
              </button>
              <button :class="[iconBtn, 'hover:!bg-danger-bg hover:!text-danger']" title="Supprimer" @click="removeJob(row)">
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>
          </template>
        </DataTable>
        <p v-if="jobStore.jobs.length === 0 && !jobStore.loading" class="text-center p-6 text-muted-foreground italic text-sm">Aucun métier configuré</p>
      </div>
    </template>

    <!-- ═══════════ Onglet Poste ═══════════ -->
    <template v-else>
      <div class="flex items-start justify-between gap-4 flex-wrap">
        <p class="text-[13px] text-muted-foreground">Postes rattachés à un métier et à une entité, utilisés pour affecter les employés</p>
        <div class="flex gap-2">
          <button :class="L.btnOutline" @click="showPosImport = true">
            <Upload class="w-4 h-4" /> Importer
          </button>
          <button :class="L.btnPrimary" @click="openAddPos">
            <Plus class="w-4 h-4" /> Ajouter un poste
          </button>
        </div>
      </div>

      <SkeletonLoader v-if="posStore.positions.length === 0 && posStore.loading" type="table" :lines="5" />
      <div v-else :class="L.tableCard">
        <DataTable :columns="posColumns" :rows="posStore.positions" row-key="id">
          <template #cell-job="{ row }">{{ jobTitle(row.jobId) }}</template>
          <template #cell-entity="{ row }">{{ entityName(row.organizationUnitId) }}</template>
          <template #cell-occupancy="{ row }">
            <span :class="row.occupiedCount >= row.capacity ? 'text-warning' : 'text-success'">
              {{ row.occupiedCount }}/{{ row.capacity }} places
            </span>
          </template>
          <template #cell-actions="{ row }">
            <div class="flex gap-1 justify-center">
              <button :class="iconBtn" title="Modifier" @click="openEditPos(row)">
                <Pencil class="w-3.5 h-3.5" />
              </button>
              <button :class="[iconBtn, 'hover:!bg-danger-bg hover:!text-danger']" title="Supprimer" @click="removePos(row)">
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>
          </template>
        </DataTable>
        <p v-if="posStore.positions.length === 0 && !posStore.loading" class="text-center p-6 text-muted-foreground italic text-sm">Aucun poste configuré</p>
      </div>
    </template>

  </div>

  <!-- ── Modal Catégorie (Code/Libellé) ── -->
  <CreateModalShell
    v-if="showCatModal"
    :title="editingCatId ? 'Modifier la catégorie' : 'Nouvelle catégorie'"
    :banner-label="editingCatId ? 'Modifier la catégorie' : 'Nouvelle catégorie'"
    :create-label="editingCatId ? 'Enregistrer' : 'Ajouter'"
    :save-error="catError"
    @close="showCatModal = false"
    @create="saveCat"
  >
    <template #form>
      <div class="flex-1 overflow-auto px-6 py-5">
        <div class="max-w-md mx-auto">
          <FormSection title="Informations générales">
            <div class="flex flex-col gap-3.5">
              <div :class="cls.field">
                <label :class="cls.fieldLabel">Libellé *</label>
                <input v-model="catForm.name" :class="cls.fieldInput" placeholder="ex : Cadre supérieur" @input="onCatNameInput" />
              </div>
              <div :class="cls.field">
                <label :class="cls.fieldLabel">Code *</label>
                <input v-model="catForm.code" :class="cls.fieldInput" placeholder="ex : CADR-SUP-001" @input="onCatCodeInput" />
              </div>
              <div :class="cls.field">
                <label :class="cls.fieldLabel">Description</label>
                <textarea v-model="catForm.description" :class="cls.fieldTextarea" rows="3" placeholder="Description de la catégorie (optionnel)…"></textarea>
              </div>
              <div class="flex items-center justify-between">
                <span :class="cls.fieldLabel">Actif</span>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" class="sr-only peer" v-model="catForm.isActive" />
                  <span class="w-9 h-5 rounded-full bg-foreground/20 transition-colors peer-checked:bg-primary relative after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:w-3.5 after:h-3.5 after:bg-white after:rounded-full after:transition-all peer-checked:after:left-[19px]"></span>
                </label>
              </div>
            </div>
          </FormSection>
        </div>
      </div>
    </template>
  </CreateModalShell>

  <!-- ── Modal Permissions de catégorie — même coquille que les autres formulaires ── -->
  <CreateModalShell
    v-if="showPermModal && permCategory"
    :title="`Permissions · ${permCategory.name}`"
    :banner-label="`Permissions · ${permCategory.name}`"
    create-label="Fermer"
    @close="showPermModal = false"
    @create="showPermModal = false"
  >
    <template #form>
      <div class="flex-1 overflow-auto px-6 py-5">
        <div class="max-w-2xl mx-auto">
          <div class="flex items-start gap-2.5 bg-warning-bg border-l-4 border-warning px-4 py-3 text-[12.5px] text-foreground leading-relaxed rounded-md mb-4">
            <TriangleAlert class="w-4 h-4 text-warning shrink-0 mt-px" />
            <span>
              Ces modifications s'appliquent <strong>uniquement aux prochains comptes créés</strong> dans cette catégorie.
              Les comptes déjà créés ne sont <strong>jamais</strong> modifiés automatiquement. Retirez ou ajoutez un droit individuellement depuis la fiche de l'employé concerné.
            </span>
          </div>

          <FormSection
            v-for="mod in permissionsByModule" :key="mod.module"
            :title="mod.module"
            :recaps="[grantedCountLabel(mod.items)]"
          >
            <div class="flex flex-col gap-0.5">
              <label
                v-for="p in mod.items"
                :key="p.id"
                class="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md hover:bg-background cursor-pointer"
              >
                <input
                  type="checkbox"
                  class="accent-primary"
                  :checked="hasPermission(p.id)"
                  @change="togglePermission(p.id, ($event.target as HTMLInputElement).checked)"
                />
                <span class="text-[13px] text-foreground">{{ p.label }}</span>
              </label>
            </div>
          </FormSection>
        </div>
      </div>
    </template>
  </CreateModalShell>

  <!-- ── Modal Métier ── -->
  <CreateModalShell
    v-if="showJobModal"
    :title="editingJobId ? 'Modifier le métier' : 'Nouveau métier'"
    :banner-label="editingJobId ? 'Modifier le métier' : 'Nouveau métier'"
    :create-label="editingJobId ? 'Enregistrer' : 'Ajouter'"
    :save-error="jobError"
    @close="showJobModal = false"
    @create="saveJob"
  >
    <template #form>
      <div class="flex-1 overflow-auto px-6 py-5">
        <div class="max-w-md mx-auto">
          <FormSection title="Informations générales">
            <div class="flex flex-col gap-3.5">
              <div :class="cls.field">
                <label :class="cls.fieldLabel">Titre *</label>
                <input v-model="jobForm.title" :class="cls.fieldInput" placeholder="ex : Développeur" @input="onJobTitleInput" />
              </div>
              <div :class="cls.field">
                <label :class="cls.fieldLabel">Code *</label>
                <input v-model="jobForm.code" :class="cls.fieldInput" placeholder="ex : DEV-001" @input="onJobCodeInput" />
              </div>
              <div :class="cls.field">
                <label :class="cls.fieldLabel">Description</label>
                <textarea v-model="jobForm.description" :class="cls.fieldTextarea" rows="2"></textarea>
              </div>
              <div class="flex items-center justify-between">
                <span :class="cls.fieldLabel">Actif</span>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" class="sr-only peer" v-model="jobForm.isActive" />
                  <span class="w-9 h-5 rounded-full bg-foreground/20 transition-colors peer-checked:bg-primary relative after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:w-3.5 after:h-3.5 after:bg-white after:rounded-full after:transition-all peer-checked:after:left-[19px]"></span>
                </label>
              </div>
            </div>
          </FormSection>
        </div>
      </div>
    </template>
  </CreateModalShell>

  <!-- ── Modal Poste ── -->
  <CreateModalShell
    v-if="showPosModal"
    :title="editingPosId ? 'Modifier le poste' : 'Nouveau poste'"
    :banner-label="editingPosId ? 'Modifier le poste' : 'Nouveau poste'"
    :create-label="editingPosId ? 'Enregistrer' : 'Ajouter'"
    :save-error="posError"
    @close="showPosModal = false"
    @create="savePos"
  >
    <template #form>
      <div class="flex-1 overflow-auto px-6 py-5">
        <div class="max-w-md mx-auto">
          <FormSection title="Informations générales">
            <div class="flex flex-col gap-3.5">
              <div :class="cls.field">
                <label :class="cls.fieldLabel">Titre *</label>
                <input v-model="posForm.title" :class="cls.fieldInput" placeholder="ex : Comptable Senior" @input="onPosTitleInput" />
              </div>
              <div :class="cls.field">
                <label :class="cls.fieldLabel">Code *</label>
                <input v-model="posForm.code" :class="cls.fieldInput" placeholder="ex : COMP-001" @input="onPosCodeInput" />
              </div>
              <div :class="cls.field">
                <label :class="cls.fieldLabel">Métier *</label>
                <select v-model="posForm.jobId" :class="cls.fieldSelect">
                  <option value="">-- Choisir --</option>
                  <option v-for="j in jobStore.jobs" :key="j.id" :value="j.id">{{ j.code }} · {{ j.title }}</option>
                </select>
              </div>
              <div :class="cls.field">
                <label :class="cls.fieldLabel">Entité *</label>
                <TableLookupField
                  :code="entityCode" :name="posForm.entityName"
                  value-key="code" name-key="name"
                  :columns="entityColumns" :fetch-fn="fetchEntities"
                  modal-title="Sélectionner une entité" placeholder="Code entité"
                  @update:code="entityCode = $event" @update:name="posForm.entityName = $event" @select="onEntitySelect"
                />
              </div>
              <div :class="cls.field">
                <label :class="cls.fieldLabel">Nombre de places *</label>
                <input v-model.number="posForm.capacity" type="number" min="1" :class="cls.fieldInput" placeholder="1" />
                <p class="text-[11.5px] text-muted-foreground mt-1">Nombre d'employés pouvant occuper ce poste en même temps dans cette entité.</p>
              </div>
            </div>
          </FormSection>
        </div>
      </div>
    </template>
  </CreateModalShell>

  <!-- ── Import CSV: catégories, métiers, postes ── -->
  <ImportWizardModal v-if="showCatImport" :open="showCatImport" :config="categoryImportConfig" @close="showCatImport = false" @imported="catStore.fetchAll()" />
  <ImportWizardModal v-if="showJobImport" :open="showJobImport" :config="jobImportConfig" @close="showJobImport = false" @imported="jobStore.fetchAll()" />
  <ImportWizardModal v-if="showPosImport" :open="showPosImport" :config="posImportConfig" @close="showPosImport = false" @imported="posStore.fetchAll()" />
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { Plus, Upload, Pencil, Trash2, ShieldCheck, TriangleAlert } from 'lucide-vue-next'
import DataTable  from '../../components/ui/DataTable.vue'
import CreateModalShell from '../../components/shared/CreateModalShell.vue'
import FormSection from '../../components/ui/form-field/FormSection.vue'
import TableLookupField from '../../components/ui/table-lookup/TableLookupField.vue'
import type { LookupFetchParams } from '../../components/ui/table-lookup/TableLookupField.vue'
import { SkeletonLoader } from '../../components'
import ImportWizardModal from '../../components/shared/import/ImportWizardModal.vue'
import { buildCategoryImportConfig } from '../../components/shared/import/configs/categoryImportConfig'
import { buildJobImportConfig } from '../../components/shared/import/configs/jobImportConfig'
import { buildPositionImportConfig } from '../../components/shared/import/configs/positionImportConfig'
import * as cls from '../../lib/formClasses'
import * as L from '../../lib/listClasses'
import { suggestCode } from '../../lib/codeGen'
import { useEmployeeCategoryStore } from '../../stores/employeeCategories'
import type { EmployeeCategory } from '../../stores/employeeCategories'
import { usePermissionStore } from '../../stores/permissions'
import { useJobStore } from '../../stores/jobs'
import type { Job } from '../../stores/jobs'
import { usePositionStore } from '../../stores/positions'
import type { Position } from '../../stores/positions'
import { useEntityStore } from '../../stores/entities'
import { confirmDialog } from '../../lib/confirm'
import { MISSIONS_EXPENSES_ENABLED } from '../../config/features'

const iconBtn = 'w-7 h-7 flex items-center justify-center border-0 rounded-md bg-background text-muted-foreground cursor-pointer transition-colors hover:bg-primary/10 hover:text-primary'

// ── Onglets — Catégorie d'abord, puis Métier, puis Poste (voir decision du 29/07) ──
const TABS = [
  { key: 'category' as const, label: 'Catégorie' },
  { key: 'job' as const, label: 'Métier' },
  { key: 'position' as const, label: 'Poste' },
]
const activeTab = ref<'category' | 'job' | 'position'>('category')

const showCatImport = ref(false)
const showJobImport = ref(false)
const showPosImport = ref(false)
const categoryImportConfig = computed(() => buildCategoryImportConfig())
const jobImportConfig = computed(() => buildJobImportConfig())
const posImportConfig = computed(() => buildPositionImportConfig())

// ═══════════════════════ Catégorie ═══════════════════════
const catStore = useEmployeeCategoryStore()
const permStore = usePermissionStore()
if (catStore.categories.length === 0) catStore.fetchAll()
if (permStore.permissions.length === 0) permStore.fetchAll()

const catColumns = [
  { key: 'code',          label: 'Code',         width: '100px' },
  { key: 'name',          label: 'Libellé' },
  { key: 'permissions',   label: 'Permissions',  width: '130px' },
  { key: 'employeeCount', label: 'Employés',     width: '100px' },
  { key: 'isActive',      label: 'Statut',       width: '90px', align: 'center' as const },
  { key: 'actions',       label: 'Actions',      width: '110px', align: 'center' as const },
]

const showCatModal = ref(false)
const editingCatId = ref<string | null>(null)
const catError = ref('')
const catForm = reactive({ code: '', name: '', description: '', isActive: true })

const catCodeTouched = ref(false)
function onCatNameInput() {
  if (!catCodeTouched.value) catForm.code = suggestCode(catForm.name, catStore.categories.length)
}
function onCatCodeInput() { catCodeTouched.value = true }

function openAddCat() {
  editingCatId.value = null
  catError.value = ''
  catCodeTouched.value = false
  Object.assign(catForm, { code: '', name: '', description: '', isActive: true })
  showCatModal.value = true
}
function openEditCat(category: EmployeeCategory) {
  editingCatId.value = category.id
  catError.value = ''
  catCodeTouched.value = true
  Object.assign(catForm, { code: category.code, name: category.name, description: category.description, isActive: category.isActive })
  showCatModal.value = true
}
async function saveCat() {
  if (!catForm.code.trim() || !catForm.name.trim()) { catError.value = 'Code et libellé sont obligatoires'; return }
  catError.value = ''
  try {
    if (editingCatId.value) {
      await catStore.updateCategory(editingCatId.value, catForm)
    } else {
      await catStore.createCategory(catForm)
    }
    showCatModal.value = false
  } catch {
    catError.value = catStore.error ?? "L'enregistrement a échoué. Veuillez réessayer."
  }
}
async function removeCat(category: EmployeeCategory) {
  if (!(await confirmDialog(`Supprimer la catégorie « ${category.name} » ?`))) return
  try {
    await catStore.deleteCategory(category.id)
  } catch {
    // catStore.error porte le message pour l'UI (toast)
  }
}

const showPermModal = ref(false)
const permCategory = ref<EmployeeCategory | null>(null)
function openPermissions(category: EmployeeCategory) {
  permCategory.value = category
  showPermModal.value = true
}
// Missions et notes de frais sont masquées de toute l'app (nav, routes —
// voir config/features.ts) tant que MISSIONS_EXPENSES_ENABLED est faux,
// mais leurs permissions restaient visibles ici : un RH pouvait les
// cocher/décocher pour une catégorie sans que ça ait le moindre effet
// visible ailleurs, ce qui prêtait à confusion. Masquées ici aussi, pas
// supprimées — réapparaissent automatiquement si le flag est réactivé.
const HIDDEN_MODULES = MISSIONS_EXPENSES_ENABLED ? [] : ['Missions', 'Notes de frais']
// RAPPORT_EXPORTER existe dans le catalogue par anticipation (voir
// prisma/seed.ts) mais n'est raccordee a aucun bouton reel pour l'instant
// (le bouton "Exporter" de LeaveBalancesView.vue est un no-op) — la cocher
// n'a donc aucun effet visible. Masquee ici jusqu'a ce que la fonctionnalite
// d'export existe vraiment, meme logique que HIDDEN_MODULES ci-dessus.
const HIDDEN_PERMISSION_CODES = ['RAPPORT_EXPORTER']
const permissionsByModule = computed(() => {
  const groups = new Map<string, typeof permStore.permissions>()
  for (const p of permStore.permissions) {
    if (HIDDEN_MODULES.includes(p.module) || HIDDEN_PERMISSION_CODES.includes(p.code)) continue
    if (!groups.has(p.module)) groups.set(p.module, [])
    groups.get(p.module)!.push(p)
  }
  return [...groups.entries()].map(([module, items]) => ({ module, items }))
})
function hasPermission(permissionId: string): boolean {
  return !!permCategory.value?.permissions.some(p => p.permissionId === permissionId)
}
function grantedCountLabel(items: { id: string }[]): string {
  const granted = items.filter(p => hasPermission(p.id)).length
  return `${granted}/${items.length}`
}
async function togglePermission(permissionId: string, checked: boolean) {
  if (!permCategory.value) return
  try {
    const updated = checked
      ? await catStore.addPermission(permCategory.value.id, permissionId)
      : await catStore.removePermission(permCategory.value.id, permissionId)
    permCategory.value = updated
  } catch {
    // catStore.error porte le message pour l'UI (toast)
  }
}

// ═══════════════════════ Métier ═══════════════════════
const jobStore = useJobStore()
if (jobStore.jobs.length === 0) jobStore.fetchAll()

const jobColumns = [
  { key: 'code',     label: 'Code',      width: '100px' },
  { key: 'title',    label: 'Titre' },
  { key: 'isActive', label: 'Statut',    width: '90px', align: 'center' as const },
  { key: 'actions',  label: 'Actions',   width: '90px', align: 'center' as const },
]

const showJobModal = ref(false)
const editingJobId = ref<string | null>(null)
const jobError = ref('')
const jobForm = reactive({ code: '', title: '', description: '', isActive: true })

const jobCodeTouched = ref(false)
function onJobTitleInput() {
  if (!jobCodeTouched.value) jobForm.code = suggestCode(jobForm.title, jobStore.jobs.length)
}
function onJobCodeInput() { jobCodeTouched.value = true }

function openAddJob() {
  editingJobId.value = null
  jobError.value = ''
  jobCodeTouched.value = false
  Object.assign(jobForm, { code: '', title: '', description: '', isActive: true })
  showJobModal.value = true
}
function openEditJob(job: Job) {
  editingJobId.value = job.id
  jobError.value = ''
  jobCodeTouched.value = true
  Object.assign(jobForm, { code: job.code, title: job.title, description: job.description ?? '', isActive: job.isActive })
  showJobModal.value = true
}
async function saveJob() {
  if (!jobForm.code.trim() || !jobForm.title.trim()) { jobError.value = 'Code et titre sont obligatoires'; return }
  jobError.value = ''
  try {
    if (editingJobId.value) {
      await jobStore.updateJob(editingJobId.value, { ...jobForm, description: jobForm.description || undefined })
    } else {
      await jobStore.createJob({ ...jobForm, description: jobForm.description || undefined })
    }
    showJobModal.value = false
  } catch {
    jobError.value = jobStore.error ?? "L'enregistrement a échoué. Veuillez réessayer."
  }
}
async function removeJob(job: Job) {
  if (!(await confirmDialog(`Supprimer le métier « ${job.title} » ?`))) return
  try {
    await jobStore.deleteJob(job.id)
  } catch {
    // jobStore.error porte le message pour l'UI (toast)
  }
}

// ═══════════════════════ Poste ═══════════════════════
const posStore = usePositionStore()
const entityStore = useEntityStore()
// Toujours rafraichir (pas de garde sur .length) — l'occupation change a
// chaque creation/suppression d'employe ailleurs dans l'app (meme raison
// que EmployeeCreate.vue / EmployeeFormView.vue, voir decision du 30/07).
posStore.fetchAll()
if (entityStore.entities.length === 0) entityStore.fetchAll()

const posColumns = [
  { key: 'code',             label: 'Code',    width: '100px' },
  { key: 'title',            label: 'Titre' },
  { key: 'job',               label: 'Métier',  width: '160px' },
  { key: 'entity',            label: 'Entité',  width: '160px' },
  { key: 'occupancy', label: 'Places',  width: '100px', align: 'center' as const },
  { key: 'actions',          label: 'Actions', width: '90px', align: 'center' as const },
]

function jobTitle(jobId: string): string {
  return jobStore.jobs.find(j => j.id === jobId)?.title ?? '—'
}
function entityName(entityId?: string): string {
  if (!entityId) return '—'
  return entityStore.getEntityById(entityId)?.name ?? '—'
}

const entityColumns = [{ key: 'code', label: 'Code', width: '90px' }, { key: 'name', label: 'Nom' }]
function fetchEntities({ searchQuery }: LookupFetchParams) {
  let items = entityStore.approvedEntities
  if (searchQuery) {
    const q = searchQuery.toLowerCase()
    items = items.filter(e => e.name.toLowerCase().includes(q) || e.code.toLowerCase().includes(q))
  }
  return { items, total: items.length }
}

const showPosModal = ref(false)
const editingPosId = ref<string | null>(null)
const posError = ref('')
const entityCode = ref('')
const posForm = reactive({ code: '', title: '', jobId: '', entityId: '' as string | null, entityName: '', capacity: 1 })

const posCodeTouched = ref(false)
function onPosTitleInput() {
  if (!posCodeTouched.value) posForm.code = suggestCode(posForm.title, posStore.positions.length)
}
function onPosCodeInput() { posCodeTouched.value = true }

function onEntitySelect(item: Record<string, unknown>) {
  posForm.entityId = String(item.id); posForm.entityName = String(item.name); entityCode.value = String(item.code)
}

function openAddPos() {
  editingPosId.value = null
  posError.value = ''
  posCodeTouched.value = false
  Object.assign(posForm, { code: '', title: '', jobId: '', entityId: '', entityName: '', capacity: 1 })
  entityCode.value = ''
  showPosModal.value = true
}
function openEditPos(position: Position) {
  editingPosId.value = position.id
  posError.value = ''
  posCodeTouched.value = true
  const entity = position.organizationUnitId ? entityStore.getEntityById(position.organizationUnitId) : undefined
  Object.assign(posForm, {
    code: position.code, title: position.title, jobId: position.jobId,
    entityId: position.organizationUnitId ?? '', entityName: entity?.name ?? '',
    capacity: position.capacity,
  })
  entityCode.value = entity?.code ?? ''
  showPosModal.value = true
}
async function savePos() {
  if (!posForm.code.trim() || !posForm.title.trim()) { posError.value = 'Code et titre sont obligatoires'; return }
  if (!posForm.jobId) { posError.value = 'Le métier est obligatoire'; return }
  if (!posForm.entityId) { posError.value = "L'entité est obligatoire"; return }
  if (!posForm.capacity || posForm.capacity < 1) { posError.value = 'Le nombre de places doit être au moins 1'; return }
  posError.value = ''
  const payload = { code: posForm.code, title: posForm.title, jobId: posForm.jobId, organizationUnitId: posForm.entityId, capacity: posForm.capacity }
  try {
    if (editingPosId.value) {
      await posStore.updatePosition(editingPosId.value, payload)
    } else {
      await posStore.createPosition(payload)
    }
    showPosModal.value = false
  } catch {
    posError.value = posStore.error ?? "L'enregistrement a échoué. Veuillez réessayer."
  }
}
async function removePos(position: Position) {
  if (!(await confirmDialog(`Supprimer le poste « ${position.title} » ?`))) return
  try {
    await posStore.deletePosition(position.id)
  } catch {
    // posStore.error porte le message pour l'UI (toast)
  }
}
</script>
