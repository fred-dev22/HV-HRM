<template>
  <ListPageLayout
    title="Sessions planifiées"
    :subtitle="`${sessionStore.items.length} session(s)`"
    :columns="columns"
    :items="pageItems"
    :total="totalCount"
    :total-text="`${totalCount} session(s)`"
    search-placeholder="Rechercher une formation, un formateur…"
    :page-size-options="[15, 25, 50]"
    scope-label="Sessions :"
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
        <Plus class="w-4 h-4" /> Planifier une session
      </button>
    </template>

    <template #cell-courseTitle="{ item }"><span class="font-medium text-foreground text-xs truncate">{{ item.courseTitle }}</span></template>
    <template #cell-scheduledAt="{ item }"><span class="text-xs text-foreground whitespace-nowrap">{{ formatSessionDate(item.scheduledAt) }}</span></template>
    <template #cell-mode="{ item }">
      <span class="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <component :is="item.mode === 'InPerson' ? MapPin : Video" class="w-3.5 h-3.5" />
        {{ item.mode === 'InPerson' ? 'Présentiel' : 'Visioconférence' }}
      </span>
    </template>
    <template #cell-trainerName="{ item }"><span class="text-muted-foreground text-xs truncate">{{ item.trainerName }}</span></template>
    <template #cell-enrolledCount="{ item }"><span class="text-xs text-foreground">{{ item.enrolledCount }}/{{ item.capacity }}</span></template>
    <template #cell-status="{ item }"><StatusPill :status="item.status" /></template>

    <template #row-actions="{ item }">
      <button v-if="item.status === 'Scheduled'" type="button" :class="L.actApprove" @click.stop="markDone(item.id)">Marquer terminée</button>
      <button v-if="item.status === 'Scheduled'" type="button" :class="L.actReject" @click.stop="cancelSession(item.id)">Annuler</button>
    </template>

    <template #details-panel="{ item }">
      <div class="flex flex-col gap-3.5">
        <div>
          <div class="text-sm font-semibold text-foreground truncate">{{ item.courseTitle }}</div>
          <div class="text-[11px] text-muted-foreground truncate">{{ formatSessionDate(item.scheduledAt) }}</div>
        </div>
        <div><StatusPill :status="item.status" /></div>
        <div class="grid grid-cols-2 gap-2 text-[12px]">
          <div><div class="text-muted-foreground text-[11px]">Formateur</div>{{ item.trainerName }}</div>
          <div><div class="text-muted-foreground text-[11px]">Inscrits</div>{{ item.enrolledCount }}/{{ item.capacity }}</div>
          <div class="col-span-2" v-if="item.location"><div class="text-muted-foreground text-[11px]">Lieu</div>{{ item.location }}</div>
          <div class="col-span-2" v-if="item.meetingLink"><div class="text-muted-foreground text-[11px]">Lien</div>{{ item.meetingLink }}</div>
        </div>
      </div>
    </template>

    <template #empty>
      <CalendarDays class="w-8 h-8" />
      <p class="text-[13px]">Aucune session planifiée</p>
    </template>

    <CreateModalShell
      v-if="showCreate"
      title="Planifier une session"
      banner-label="Nouvelle session"
      create-label="Planifier"
      :is-saving="submitting"
      :save-error="error"
      @close="showCreate = false"
      @create="create"
    >
      <template #form>
        <div class="flex-1 overflow-auto px-6 py-5">
          <div class="max-w-3xl mx-auto">
            <FormSection title="Session">
              <div class="grid grid-cols-2 gap-x-6 gap-y-4 max-sm:grid-cols-1">
                <div :class="cls.field" class="col-span-2">
                  <label :class="cls.fieldLabel">Formation <span class="text-danger">*</span></label>
                  <select v-model="form.courseId" :class="cls.fieldSelect">
                    <option value="">Sélectionner…</option>
                    <option v-for="c in courseStore.items" :key="c.id" :value="c.id">{{ c.title }}</option>
                  </select>
                </div>
                <div :class="cls.field">
                  <label :class="cls.fieldLabel">Début <span class="text-danger">*</span></label>
                  <input type="datetime-local" v-model="form.scheduledAt" :class="cls.fieldInput" />
                </div>
                <div :class="cls.field">
                  <label :class="cls.fieldLabel">Fin <span class="text-danger">*</span></label>
                  <input type="datetime-local" v-model="form.endAt" :class="cls.fieldInput" />
                </div>
                <div :class="cls.field">
                  <label :class="cls.fieldLabel">Mode <span class="text-danger">*</span></label>
                  <select v-model="form.mode" :class="cls.fieldSelect">
                    <option value="InPerson">Présentiel</option>
                    <option value="VideoCall">Visioconférence</option>
                  </select>
                </div>
                <div :class="cls.field">
                  <label :class="cls.fieldLabel">Capacité <span class="text-danger">*</span></label>
                  <input type="number" min="1" v-model.number="form.capacity" :class="cls.fieldInput" />
                </div>
                <div :class="cls.field" class="col-span-2">
                  <label :class="cls.fieldLabel">Formateur <span class="text-danger">*</span></label>
                  <input v-model="form.trainerName" :class="cls.fieldInput" placeholder="Nom du formateur" />
                </div>
                <div v-if="form.mode === 'InPerson'" :class="cls.field" class="col-span-2">
                  <label :class="cls.fieldLabel">Lieu <span class="text-danger">*</span></label>
                  <input v-model="form.location" :class="cls.fieldInput" placeholder="Salle, adresse…" />
                </div>
                <div v-else :class="cls.field" class="col-span-2">
                  <label :class="cls.fieldLabel">Lien de visioconférence <span class="text-danger">*</span></label>
                  <input v-model="form.meetingLink" :class="cls.fieldInput" placeholder="https://…" />
                </div>
              </div>
            </FormSection>
          </div>
        </div>
      </template>
    </CreateModalShell>

    <TrainingSessionCard v-if="openCardId !== null" :items="filtered" :item-id="openCardId" @close="openCardId = null" />
  </ListPageLayout>
</template>

<script setup lang="ts">
/**
 * Sessions planifiées (TrainingSession), module Formation (backend /training,
 * voir src/stores/training).
 */
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { Plus, CalendarDays, MapPin, Video } from 'lucide-vue-next'
import { ListPageLayout, StatusPill, CreateModalShell } from '../../components'
import type { ListColumn } from '../../components/shared/ListPageLayout.vue'
import FormSection from '../../components/ui/form-field/FormSection.vue'
import TrainingSessionCard from '../../components/training/TrainingSessionCard.vue'
import * as cls from '../../lib/formClasses'
import * as L from '../../lib/listClasses'
import { getApiErrorMessage } from '../../lib/api'
import { withToast } from '../../lib/withToast'
import { runAction, loadAll } from '../../lib/runAction'
import { useSubmitGuard } from '../../lib/submitGuard'
import { useSessionStore, useCourseStore } from '../../stores/training'
import type { TrainingSession, SessionMode } from '../../stores/training'

const sessionStore = useSessionStore()
const courseStore = useCourseStore()

onMounted(() => loadAll(() => sessionStore.fetchAll(), () => courseStore.fetchAll()))

const markDone = (id: string) => runAction('Mise à jour…', () => sessionStore.markDone(id), 'Action impossible')
const cancelSession = (id: string) => runAction('Annulation…', () => sessionStore.cancel(id), 'Annulation impossible')

const openCardId = ref<string | null>(null)
function openCard(item: TrainingSession) { openCardId.value = item.id }

const columns: ListColumn[] = [
  { key: 'courseTitle', label: 'Formation', sortable: true, hideable: false, width: 220 },
  { key: 'scheduledAt', label: 'Date', sortable: true, width: 150 },
  { key: 'mode', label: 'Mode', width: 130 },
  { key: 'trainerName', label: 'Formateur', width: 160 },
  { key: 'enrolledCount', label: 'Inscrits', align: 'center', width: 90 },
  { key: 'status', label: 'Statut', width: 120 },
]

function formatSessionDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) + ' · ' +
    d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

const scopeOptions = [
  { value: '', label: 'Toutes' },
  { value: 'Scheduled', label: 'Planifiées' },
  { value: 'Done', label: 'Terminées' },
  { value: 'Cancelled', label: 'Annulées' },
]
const activeScope = ref('')
const searchQuery = ref('')
const sortKey = ref('scheduledAt')
const sortDir = ref<'asc' | 'desc'>('desc')
const page = ref(1)
const pageSize = ref(15)

watch([activeScope, searchQuery, pageSize], () => { page.value = 1 })
function resetFilters() { searchQuery.value = ''; activeScope.value = ''; page.value = 1 }

const sortFieldMap: Record<string, keyof TrainingSession> = {
  courseTitle: 'courseTitle', scheduledAt: 'scheduledAt', trainerName: 'trainerName', enrolledCount: 'enrolledCount',
}

const filtered = computed(() => {
  let rows = sessionStore.items.filter(s => {
    if (activeScope.value && s.status !== activeScope.value) return false
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      if (!s.courseTitle.toLowerCase().includes(q) && !s.trainerName.toLowerCase().includes(q)) return false
    }
    return true
  })
  if (sortKey.value && sortFieldMap[sortKey.value]) {
    const f = sortFieldMap[sortKey.value]!
    rows = [...rows].sort((a, b) => {
      const va = a[f], vb = b[f]
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb))
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
const form = reactive({
  courseId: '', scheduledAt: '', endAt: '', mode: 'InPerson' as SessionMode,
  location: '', meetingLink: '', trainerName: '', capacity: 10,
})

function resetForm() {
  Object.assign(form, { courseId: '', scheduledAt: '', endAt: '', mode: 'InPerson', location: '', meetingLink: '', trainerName: '', capacity: 10 })
  error.value = null
}

function validate(): boolean {
  if (!form.courseId) { error.value = 'La formation est requise'; return false }
  if (!form.scheduledAt) { error.value = 'La date de début est requise'; return false }
  if (!form.endAt) { error.value = 'La date de fin est requise'; return false }
  if (form.endAt < form.scheduledAt) { error.value = 'La date de fin doit être après le début'; return false }
  if (!form.trainerName.trim()) { error.value = 'Le formateur est requis'; return false }
  if (!form.capacity || form.capacity < 1) { error.value = "La capacité doit être d'au moins 1"; return false }
  if (form.mode === 'InPerson' && !form.location.trim()) { error.value = 'Le lieu est requis'; return false }
  if (form.mode === 'VideoCall' && !form.meetingLink.trim()) { error.value = 'Le lien de visioconférence est requis'; return false }
  error.value = null
  return true
}

const { submitting, guard } = useSubmitGuard()
async function create() {
  if (!validate()) return
  try {
    await guard(() => withToast('Planification…', () => sessionStore.schedule({
      courseId: form.courseId,
      scheduledAt: form.scheduledAt,
      endAt: form.endAt,
      mode: form.mode,
      location: form.mode === 'InPerson' ? form.location.trim() : undefined,
      meetingLink: form.mode === 'VideoCall' ? form.meetingLink.trim() : undefined,
      trainerName: form.trainerName.trim(),
      capacity: form.capacity,
    }), () => 'Planification impossible'))
    showCreate.value = false
    resetForm()
  } catch (e) {
    error.value = getApiErrorMessage(e, 'Planification impossible')
  }
}
</script>
