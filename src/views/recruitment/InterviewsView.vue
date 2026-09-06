<template>
  <ListPageLayout
    title="Entretiens"
    :subtitle="`${interviewStore.items.length} entretien(s)`"
    :columns="columns"
    :items="pageItems"
    :total="totalCount"
    :total-text="`${totalCount} entretien(s)`"
    search-placeholder="Rechercher un candidat, une offre, un lieu…"
    :page-size-options="[15, 25, 50]"
    scope-label="Entretiens :"
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
        <Plus class="w-4 h-4" /> Planifier un entretien
      </button>
    </template>

    <!-- KPIs -->
    <template #above-table>
      <div class="grid grid-cols-4 gap-2.5 mb-3.5 max-md:grid-cols-2">
        <div :class="kpiItem">
          <div :class="kpiIcon" class="bg-primary/10"><CalendarClock class="w-[18px] h-[18px] text-primary" /></div>
          <div><div :class="kpiVal">{{ interviewStore.items.length }}</div><div :class="kpiLbl">Total</div></div>
        </div>
        <div :class="kpiItem">
          <div :class="kpiIcon" class="bg-warning-bg"><Clock class="w-[18px] h-[18px] text-warning" /></div>
          <div><div :class="kpiVal">{{ scheduledCount }}</div><div :class="kpiLbl">Planifiés</div></div>
        </div>
        <div :class="kpiItem">
          <div :class="kpiIcon" class="bg-success-bg"><CheckCircle2 class="w-[18px] h-[18px] text-success" /></div>
          <div><div :class="kpiVal">{{ doneCount }}</div><div :class="kpiLbl">Effectués</div></div>
        </div>
        <div :class="kpiItem">
          <div :class="kpiIcon" class="bg-info-bg"><CalendarDays class="w-[18px] h-[18px] text-info" /></div>
          <div><div :class="kpiVal">{{ todayCount }}</div><div :class="kpiLbl">Aujourd'hui</div></div>
        </div>
      </div>
    </template>

    <!-- Actions contextuelles (ligne sélectionnée) -->
    <template #row-actions="{ item }">
      <InterviewWorkflowActions :item="item" />
    </template>

    <!-- Cellules -->
    <template #cell-candidateName="{ item }"><span class="font-medium text-foreground text-xs truncate">{{ item.candidateName }}</span></template>
    <template #cell-jobOfferTitle="{ item }"><span class="text-muted-foreground text-xs truncate">{{ item.jobOfferTitle }}</span></template>
    <template #cell-scheduledAt="{ item }"><span class="text-muted-foreground text-xs whitespace-nowrap">{{ formatDateTime(item.scheduledAt) }}</span></template>
    <template #cell-location="{ item }">
      <a v-if="item.mode === 'VideoCall'" :href="item.meetingLink" target="_blank" rel="noopener" class="inline-flex items-center gap-1 text-primary text-xs truncate hover:underline" @click.stop>
        <Video class="w-3.5 h-3.5 shrink-0" /> Visioconférence
      </a>
      <span v-else class="inline-flex items-center gap-1 text-muted-foreground text-xs truncate">
        <MapPin class="w-3.5 h-3.5 shrink-0" /> {{ item.location }}
      </span>
    </template>
    <template #cell-participants="{ item }"><span class="text-muted-foreground text-xs truncate">{{ item.participants.map(p => p.name).join(', ') }}</span></template>
    <template #cell-status="{ item }"><StatusPill :status="item.status" /></template>

    <!-- Aperçu rapide -->
    <template #details-panel="{ item }">
      <div class="flex flex-col gap-3.5">
        <div>
          <div class="text-sm font-semibold text-foreground truncate">{{ item.candidateName }}</div>
          <div class="text-[11px] text-muted-foreground truncate">{{ item.jobOfferTitle }}</div>
        </div>
        <div><StatusPill :status="item.status" /></div>
        <div class="grid grid-cols-2 gap-2 text-[12px]">
          <div class="col-span-2"><div class="text-muted-foreground text-[11px]">Date et heure</div>{{ formatDateTime(item.scheduledAt) }}</div>
          <div class="col-span-2">
            <div class="text-muted-foreground text-[11px]">{{ item.mode === 'VideoCall' ? 'Visioconférence' : 'Lieu' }}</div>
            <a v-if="item.mode === 'VideoCall'" :href="item.meetingLink" target="_blank" rel="noopener" class="text-primary hover:underline break-all">{{ item.meetingLink }}</a>
            <span v-else>{{ item.location }}</span>
          </div>
        </div>
        <div class="pt-2 border-t border-border">
          <InterviewWorkflowActions :item="item" />
        </div>
        <button :class="L.btnPrimary" class="w-full justify-center" @click="openCard(item)">Ouvrir la fiche</button>
      </div>
    </template>

    <template #empty>
      <CalendarClock class="w-8 h-8" />
      <p class="text-[13px]">Aucun entretien</p>
    </template>

    <!-- Création -->
    <CreateModalShell
      v-if="showCreate"
      title="Planifier un entretien"
      banner-label="Nouvel entretien"
      create-label="Planifier"
      :save-error="error"
      @close="showCreate = false"
      @create="create"
    >
      <template #form>
        <div class="flex-1 overflow-auto px-6 py-5">
          <div class="max-w-3xl mx-auto">

            <FormSection title="Candidature">
              <div :class="cls.field">
                <label :class="cls.fieldLabel">Candidature <span class="text-danger">*</span></label>
                <select v-model="form.applicationId" :class="cls.fieldSelect">
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

    <!-- Fiche complète -->
    <InterviewCard v-if="openCardId !== null" :items="filtered" :item-id="openCardId" @close="openCardId = null" />
  </ListPageLayout>
</template>

<script setup lang="ts">
/**
 * Liste des entretiens (Interview), module Recrutement, design uniquement
 * (données fictives, voir src/stores/recruitment). Calquée sur
 * EmployeeListView.vue / JobOffersView.vue / HiringRequestsView.vue :
 * ListPageLayout + boutons de workflow dans InterviewWorkflowActions.vue,
 * fiche complète dans InterviewCard.vue.
 */
import { ref, reactive, computed, watch } from 'vue'
import { Plus, CalendarClock, Clock, CheckCircle2, CalendarDays, MapPin, Video, X } from 'lucide-vue-next'
import { ListPageLayout, StatusPill, CreateModalShell } from '../../components'
import type { ListColumn } from '../../components/shared/ListPageLayout.vue'
import FormSection from '../../components/ui/form-field/FormSection.vue'
import TableLookupField from '../../components/ui/table-lookup/TableLookupField.vue'
import type { LookupColumn, LookupFetchParams } from '../../components/ui/table-lookup/TableLookupField.vue'
import InterviewWorkflowActions from '../../components/recruitment/InterviewWorkflowActions.vue'
import InterviewCard from '../../components/recruitment/InterviewCard.vue'
import * as cls from '../../lib/formClasses'
import * as L from '../../lib/listClasses'
import { todayIso } from '../../lib/date'
import { useInterviewStore, useApplicationStore } from '../../stores/recruitment'
import type { Interview, InterviewMode, InterviewParticipant } from '../../stores/recruitment'
import { useEmployeeStore } from '../../stores/employees'

const interviewStore = useInterviewStore()
const applicationStore = useApplicationStore()
const employeeStore = useEmployeeStore()
// Annuaire léger, deja utilise pour ce genre de picker ailleurs dans l'appli
// (MissionCreate.vue, AbsenceCreate.vue…) : accessible sans permission
// elevee, mais n'expose pas l'email (voir InterviewParticipant.email).
if (employeeStore.directory.length === 0) employeeStore.fetchDirectory()

/* ── Styles (KPI) ───────────────────────────────────────────── */
const kpiItem = 'bg-card border border-border rounded-lg px-3.5 py-3 flex items-center gap-3'
const kpiIcon = 'w-9 h-9 rounded-lg flex items-center justify-center shrink-0'
const kpiVal = 'text-[22px] font-bold leading-none'
const kpiLbl = 'text-xs text-muted-foreground mt-0.5'

const modeBtn = 'flex-1 h-[38px] px-2.5 rounded-md border border-border bg-background text-muted-foreground text-[13px] font-medium cursor-pointer inline-flex items-center justify-center gap-1.5 transition-colors hover:text-foreground'
const modeBtnActive = '!bg-primary/10 !text-primary !border-primary/30'

/* ── Formatage date et heure (ex : "25/08/2026 10:00") ─────────── */
function formatDateTime(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso)
  if (!m) return iso
  const [, y, mo, d, h, mi] = m
  return `${d}/${mo}/${y} ${h}:${mi}`
}

/* ── Colonnes ───────────────────────────────────────────────── */
const columns: ListColumn[] = [
  { key: 'candidateName', label: 'Candidat', sortable: true, hideable: false, width: 180 },
  { key: 'jobOfferTitle', label: 'Offre', sortable: true, width: 180 },
  { key: 'scheduledAt', label: 'Date et heure', sortable: true, width: 150 },
  { key: 'location', label: 'Lieu / Visio', width: 170 },
  { key: 'participants', label: 'Participants', width: 220 },
  { key: 'status', label: 'Statut', width: 130 },
]

/* ── KPIs ───────────────────────────────────────────────────── */
const scheduledCount = computed(() => interviewStore.items.filter(i => i.status === 'Scheduled').length)
const doneCount = computed(() => interviewStore.items.filter(i => i.status === 'Done').length)
const todayCount = computed(() => {
  const today = todayIso()
  return interviewStore.items.filter(i => i.scheduledAt.slice(0, 10) === today).length
})

/* ── Scope / recherche / tri / pagination ──────────────────────
   Même pattern que EmployeeListView.vue : la vue calcule elle-même
   "filtered" puis passe la page déjà filtrée/triée à ListPageLayout. */
const scopeOptions = [
  { value: '', label: 'Tous' },
  { value: 'Scheduled', label: 'Planifié' },
  { value: 'Done', label: 'Effectué' },
  { value: 'Cancelled', label: 'Annulé' },
]
const activeScope = ref('')
const searchQuery = ref('')
const sortKey = ref('')
const sortDir = ref<'asc' | 'desc'>('asc')
const page = ref(1)
const pageSize = ref(15)

watch([activeScope, searchQuery, pageSize], () => { page.value = 1 })

function resetFilters() {
  searchQuery.value = ''; activeScope.value = ''; page.value = 1
}

const sortFieldMap: Record<string, keyof Interview> = {
  candidateName: 'candidateName', jobOfferTitle: 'jobOfferTitle', scheduledAt: 'scheduledAt',
}

const filtered = computed(() => {
  let rows = interviewStore.items.filter(i => {
    if (activeScope.value && i.status !== activeScope.value) return false
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      const place = (i.location ?? i.meetingLink ?? '').toLowerCase()
      if (!i.candidateName.toLowerCase().includes(q) && !i.jobOfferTitle.toLowerCase().includes(q) && !place.includes(q)) return false
    }
    return true
  })
  if (sortKey.value && sortFieldMap[sortKey.value]) {
    const f = sortFieldMap[sortKey.value]!
    rows = [...rows].sort((a, b) => {
      const cmp = String(a[f] ?? '').localeCompare(String(b[f] ?? ''))
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

/* ── Création ───────────────────────────────────────────────── */
const eligibleApplications = computed(() => applicationStore.items.filter(a => a.status === 'New' || a.status === 'InReview'))

/* ── Picker de participants (annuaire employés réel, voir plus haut) ──── */
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
// Champ contrôlé du picker : remis à vide après chaque ajout (voir
// onAddParticipant) pour que "Ajouter un participant" reste utilisable en
// boucle, contrairement à un TableLookupField classique à sélection unique.
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

const showCreate = ref(false)
const error = ref<string | null>(null)
const form = reactive({
  applicationId: '', scheduledAt: '', mode: 'InPerson' as InterviewMode, location: '', meetingLink: '',
  participants: [] as InterviewParticipant[],
})

function resetForm() {
  Object.assign(form, { applicationId: '', scheduledAt: '', mode: 'InPerson', location: '', meetingLink: '', participants: [] })
  participantPickerCode.value = ''
  participantPickerName.value = ''
  error.value = null
}

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
  const app = applicationStore.items.find(a => a.id === form.applicationId)
  return {
    applicationId: form.applicationId,
    candidateName: app?.candidateName ?? '',
    candidateEmail: app?.candidateEmail ?? '',
    jobOfferTitle: app?.jobOfferTitle ?? 'Candidature spontanée',
    scheduledAt: form.scheduledAt,
    mode: form.mode,
    location: form.mode === 'InPerson' ? form.location.trim() : undefined,
    meetingLink: form.mode === 'VideoCall' ? form.meetingLink.trim() : undefined,
    participants: form.participants,
  }
}

function create() {
  if (!validate()) return
  interviewStore.schedule(buildPayload())
  showCreate.value = false
  resetForm()
}

/* ── Fiche complète (double-clic sur une ligne ou bouton "Ouvrir la
   fiche") ──────────────────────────────────────────────────── */
const openCardId = ref<string | null>(null)
function openCard(item: Interview) { openCardId.value = item.id }
</script>
