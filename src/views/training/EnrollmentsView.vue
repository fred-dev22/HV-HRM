<template>
  <ListPageLayout
    title="Inscriptions"
    :subtitle="`${enrollmentStore.items.length} inscription(s)`"
    :columns="columns"
    :items="pageItems"
    :total="totalCount"
    :total-text="`${totalCount} inscription(s)`"
    search-placeholder="Rechercher un employé, une formation…"
    :page-size-options="[15, 25, 50]"
    scope-label="Inscriptions :"
    :scope-options="scopeOptions"
    v-model:scope="activeScope"
    v-model:search-query="searchQuery"
    v-model:sort-key="sortKey"
    v-model:sort-dir="sortDir"
    v-model:page="page"
    v-model:page-size="pageSize"
    @reset-filters="resetFilters"
    @open-card="openCard"
  >
    <template #header-actions>
      <button :class="L.btnPrimary" @click="showCreate = true">
        <Plus class="w-4 h-4" /> Nouvelle inscription
      </button>
    </template>

    <template #cell-employeeName="{ item }"><span class="font-medium text-foreground text-xs truncate">{{ item.employeeName }}</span></template>
    <template #cell-courseTitle="{ item }"><span class="text-muted-foreground text-xs truncate">{{ item.courseTitle }}</span></template>
    <template #cell-sessionScheduledAt="{ item }"><span class="text-xs text-foreground whitespace-nowrap">{{ formatDate(item.sessionScheduledAt) }}</span></template>
    <template #cell-requestedByName="{ item }"><span class="text-muted-foreground text-xs truncate">{{ item.requestedByName }}</span></template>
    <template #cell-status="{ item }"><StatusPill :status="item.status" /></template>

    <template #row-actions="{ item }">
      <button v-if="item.status === 'Requested'" type="button" :class="L.actApprove" @click.stop="enrollmentStore.approve(item.id)">Approuver</button>
      <button v-if="item.status === 'Requested'" type="button" :class="L.actReject" @click.stop="enrollmentStore.reject(item.id)">Refuser</button>
      <button v-if="item.status === 'Approved'" type="button" :class="L.actApprove" @click.stop="enrollmentStore.markAttended(item.id)">Marquer présent</button>
    </template>

    <template #details-panel="{ item }">
      <div class="flex flex-col gap-3.5">
        <div>
          <div class="text-sm font-semibold text-foreground truncate">{{ item.employeeName }}</div>
          <div class="text-[11px] text-muted-foreground truncate">{{ item.courseTitle }}</div>
        </div>
        <div><StatusPill :status="item.status" /></div>
        <div class="grid grid-cols-2 gap-2 text-[12px]">
          <div><div class="text-muted-foreground text-[11px]">Entité</div>{{ item.entityName }}</div>
          <div><div class="text-muted-foreground text-[11px]">Demandée par</div>{{ item.requestedByName }}</div>
          <div class="col-span-2"><div class="text-muted-foreground text-[11px]">Session</div>{{ formatDate(item.sessionScheduledAt) }}</div>
        </div>
        <div class="flex gap-2" v-if="item.status === 'Requested'">
          <button :class="L.btnPrimary" class="flex-1 justify-center" @click="enrollmentStore.approve(item.id)">Approuver</button>
          <button :class="L.btnOutline" class="flex-1 justify-center" @click="enrollmentStore.reject(item.id)">Refuser</button>
        </div>
      </div>
    </template>

    <template #empty>
      <UserPlus class="w-8 h-8" />
      <p class="text-[13px]">Aucune inscription</p>
    </template>

    <CreateModalShell
      v-if="showCreate"
      title="Nouvelle inscription"
      banner-label="Nouvelle inscription"
      create-label="Inscrire"
      :is-saving="submitting"
      :save-error="error"
      @close="showCreate = false"
      @create="create"
    >
      <template #form>
        <div class="flex-1 overflow-auto px-6 py-5">
          <div class="max-w-3xl mx-auto">
            <FormSection title="Inscription">
              <div class="grid grid-cols-2 gap-x-6 gap-y-4 max-sm:grid-cols-1">
                <div :class="cls.field" class="col-span-2">
                  <label :class="cls.fieldLabel">Session <span class="text-danger">*</span></label>
                  <select v-model="form.sessionId" :class="cls.fieldSelect">
                    <option value="">Sélectionner…</option>
                    <option v-for="s in openSessions" :key="s.id" :value="s.id">
                      {{ s.courseTitle }} · {{ formatDate(s.scheduledAt) }} ({{ s.enrolledCount }}/{{ s.capacity }})
                    </option>
                  </select>
                </div>
                <div :class="cls.field" class="col-span-2">
                  <label :class="cls.fieldLabel">Employé <span class="text-danger">*</span></label>
                  <select v-model="form.employeeId" :class="cls.fieldSelect">
                    <option value="">Sélectionner…</option>
                    <option v-for="e in employeeStore.directory" :key="e.id" :value="e.id">{{ e.name }}</option>
                  </select>
                </div>
              </div>
            </FormSection>
          </div>
        </div>
      </template>
    </CreateModalShell>

    <EnrollmentCard v-if="openCardId !== null" :items="filtered" :item-id="openCardId" @close="openCardId = null" />
  </ListPageLayout>
</template>

<script setup lang="ts">
/**
 * Inscriptions / demandes de formation (Enrollment), module Formation
 * (design uniquement, données fictives, voir src/stores/training).
 */
import { ref, reactive, computed, watch } from 'vue'
import { Plus, UserPlus } from 'lucide-vue-next'
import { ListPageLayout, StatusPill, CreateModalShell } from '../../components'
import type { ListColumn } from '../../components/shared/ListPageLayout.vue'
import FormSection from '../../components/ui/form-field/FormSection.vue'
import EnrollmentCard from '../../components/training/EnrollmentCard.vue'
import * as cls from '../../lib/formClasses'
import * as L from '../../lib/listClasses'
import { formatDate } from '../../lib/date'
import { getApiErrorMessage } from '../../lib/api'
import { withToast } from '../../lib/withToast'
import { useSubmitGuard } from '../../lib/submitGuard'
import { useEnrollmentStore, useSessionStore } from '../../stores/training'
import type { Enrollment } from '../../stores/training'
import { useEmployeeStore } from '../../stores/employees'

const enrollmentStore = useEnrollmentStore()
const sessionStore = useSessionStore()
const employeeStore = useEmployeeStore()
if (employeeStore.directory.length === 0) employeeStore.fetchDirectory()

const openCardId = ref<string | null>(null)
function openCard(item: Enrollment) { openCardId.value = item.id }

const columns: ListColumn[] = [
  { key: 'employeeName', label: 'Employé', sortable: true, hideable: false, width: 180 },
  { key: 'courseTitle', label: 'Formation', sortable: true, width: 220 },
  { key: 'sessionScheduledAt', label: 'Session', sortable: true, width: 140 },
  { key: 'requestedByName', label: 'Demandée par', width: 160 },
  { key: 'status', label: 'Statut', width: 120 },
]

const openSessions = computed(() => sessionStore.items.filter(s => s.status === 'Scheduled' && s.enrolledCount < s.capacity))

const scopeOptions = [
  { value: '', label: 'Toutes' },
  { value: 'Requested', label: 'Demandées' },
  { value: 'Approved', label: 'Approuvées' },
  { value: 'Attended', label: 'A participé' },
  { value: 'Rejected', label: 'Refusées' },
  { value: 'Cancelled', label: 'Annulées' },
]
const activeScope = ref('')
const searchQuery = ref('')
const sortKey = ref('sessionScheduledAt')
const sortDir = ref<'asc' | 'desc'>('desc')
const page = ref(1)
const pageSize = ref(15)

watch([activeScope, searchQuery, pageSize], () => { page.value = 1 })
function resetFilters() { searchQuery.value = ''; activeScope.value = ''; page.value = 1 }

const sortFieldMap: Record<string, keyof Enrollment> = {
  employeeName: 'employeeName', courseTitle: 'courseTitle', sessionScheduledAt: 'sessionScheduledAt', requestedByName: 'requestedByName',
}

const filtered = computed(() => {
  let rows = enrollmentStore.items.filter(e => {
    if (activeScope.value && e.status !== activeScope.value) return false
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      if (!e.employeeName.toLowerCase().includes(q) && !e.courseTitle.toLowerCase().includes(q)) return false
    }
    return true
  })
  if (sortKey.value && sortFieldMap[sortKey.value]) {
    const f = sortFieldMap[sortKey.value]!
    rows = [...rows].sort((a, b) => {
      const va = a[f], vb = b[f]
      const cmp = String(va).localeCompare(String(vb))
      return sortDir.value === 'asc' ? cmp : -cmp
    })
  }
  return rows
})

const totalCount = computed(() => filtered.value.length)
const pageItems = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filtered.value.slice(start, start + pageSize.value)
})

const showCreate = ref(false)
const error = ref<string | null>(null)
const form = reactive({ sessionId: '', employeeId: '' })

function resetForm() { Object.assign(form, { sessionId: '', employeeId: '' }); error.value = null }

function validate(): boolean {
  if (!form.sessionId) { error.value = 'La session est requise'; return false }
  if (!form.employeeId) { error.value = "L'employé est requis"; return false }
  const session = sessionStore.items.find(s => s.id === form.sessionId)
  if (!session) { error.value = 'Session introuvable'; return false }
  if (session.status !== 'Scheduled') { error.value = "Cette session n'est plus planifiée"; return false }
  if (session.enrolledCount >= session.capacity) { error.value = 'Cette session est complète'; return false }
  const alreadyEnrolled = enrollmentStore.items.some(e =>
    e.sessionId === form.sessionId && e.employeeId === form.employeeId
    && ['Requested', 'Approved', 'Attended'].includes(e.status))
  if (alreadyEnrolled) { error.value = 'Cet employé est déjà inscrit à cette session'; return false }
  error.value = null
  return true
}

const { submitting, guard } = useSubmitGuard()
async function create() {
  if (!validate()) return
  try {
    await guard(() => withToast('Inscription…', async () => {
      const session = sessionStore.items.find(s => s.id === form.sessionId)!
      const employee = employeeStore.directory.find(e => e.id === form.employeeId)!
      enrollmentStore.request({
        sessionId: session.id,
        courseTitle: session.courseTitle,
        sessionScheduledAt: session.scheduledAt,
        employeeId: employee.id,
        employeeName: employee.name,
        entityName: employee.entityName ?? '',
        requestedByName: employee.name,
      })
    }, () => 'Inscription impossible'))
    showCreate.value = false
    resetForm()
  } catch (e) {
    error.value = getApiErrorMessage(e, 'Inscription impossible')
  }
}
</script>
