<template>
  <ListPageLayout
    title="Évaluations à chaud"
    subtitle="Participants ayant assisté à une formation, en attente de leur évaluation à chaud"
    :columns="columns"
    :items="pageItems"
    :total="totalCount"
    :total-text="`${totalCount} évaluation(s) à faire`"
    search-placeholder="Rechercher un employé, une formation…"
    :page-size-options="[15, 25, 50]"
    v-model:search-query="searchQuery"
    v-model:sort-key="sortKey"
    v-model:sort-dir="sortDir"
    v-model:page="page"
    v-model:page-size="pageSize"
    :show-search="true"
    @reset-filters="searchQuery = ''"
  >
    <template #cell-employeeName="{ item }"><span class="font-medium text-foreground text-xs truncate">{{ item.employeeName }}</span></template>
    <template #cell-courseTitle="{ item }"><span class="text-muted-foreground text-xs truncate">{{ item.courseTitle }}</span></template>
    <template #cell-sessionScheduledAt="{ item }"><span class="text-xs text-foreground whitespace-nowrap">{{ formatDate(item.sessionScheduledAt) }}</span></template>
    <template #cell-actions="{ item }">
      <button type="button" :class="L.btnPrimary" @click.stop="openEval(item)">Évaluer</button>
    </template>

    <template #empty>
      <Flame class="w-8 h-8" />
      <p class="text-[13px]">Aucune évaluation à chaud en attente</p>
    </template>
  </ListPageLayout>

  <ModalShell :open="evalOpen" title="Évaluation à chaud" @close="evalOpen = false">
    <template v-if="evalTarget">
      <div class="text-[13px] text-muted-foreground mb-1">{{ evalTarget.employeeName }} · {{ evalTarget.courseTitle }}</div>
      <div :class="cls.field">
        <label :class="cls.fieldLabel">Note (sur 5) <span class="text-danger">*</span></label>
        <select v-model.number="score" :class="cls.fieldSelect">
          <option v-for="n in [5,4,3,2,1]" :key="n" :value="n">{{ n }}/5</option>
        </select>
      </div>
      <div :class="cls.field">
        <label :class="cls.fieldLabel">Commentaire <span class="text-danger">*</span></label>
        <textarea v-model="comment" :class="cls.fieldTextarea" rows="3" placeholder="Ressenti à chaud du participant…"></textarea>
      </div>
      <p v-if="error" :class="cls.fieldErrorBlock">{{ error }}</p>
    </template>
    <template #footer>
      <button :class="cls.btnOutline" @click="evalOpen = false">Annuler</button>
      <button :class="cls.btnPrimary" :disabled="submitting" @click="submit">Enregistrer</button>
    </template>
  </ModalShell>
</template>

<script setup lang="ts">
/**
 * Évaluations à chaud, module Formation (backend /training,
 * voir src/stores/training). Liste les inscriptions "A participé"
 * n'ayant pas encore reçu leur évaluation à chaud (voir Liste des
 * besoins.xlsx "Formations et perfectionnement" #4 : relance automatique).
 */
import { ref, computed, watch, onMounted } from 'vue'
import { Flame } from 'lucide-vue-next'
import { ListPageLayout } from '../../components'
import ModalShell from '../../components/ui/ModalShell.vue'
import type { ListColumn } from '../../components/shared/ListPageLayout.vue'
import * as cls from '../../lib/formClasses'
import * as L from '../../lib/listClasses'
import { formatDate } from '../../lib/date'
import { getApiErrorMessage } from '../../lib/api'
import { withToast } from '../../lib/withToast'
import { loadAll } from '../../lib/runAction'
import { useSubmitGuard } from '../../lib/submitGuard'
import { useEnrollmentStore } from '../../stores/training'
import type { Enrollment } from '../../stores/training'

const enrollmentStore = useEnrollmentStore()
onMounted(() => loadAll(() => enrollmentStore.fetchAll()))

const columns: ListColumn[] = [
  { key: 'employeeName', label: 'Employé', sortable: true, hideable: false, width: 180 },
  { key: 'courseTitle', label: 'Formation', sortable: true, width: 220 },
  { key: 'sessionScheduledAt', label: 'Session', sortable: true, width: 140 },
  { key: 'actions', label: '', width: 110, sortable: false, pinnable: false },
]

const searchQuery = ref('')
const sortKey = ref('sessionScheduledAt')
const sortDir = ref<'asc' | 'desc'>('desc')
const page = ref(1)
const pageSize = ref(15)
watch([searchQuery, pageSize], () => { page.value = 1 })

const pending = computed(() => enrollmentStore.items.filter(e => e.status === 'Attended' && !e.hotEvaluation))

const filtered = computed(() => {
  let rows = pending.value
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    rows = rows.filter(e => e.employeeName.toLowerCase().includes(q) || e.courseTitle.toLowerCase().includes(q))
  }
  return [...rows].sort((a, b) => {
    const cmp = a.sessionScheduledAt.localeCompare(b.sessionScheduledAt)
    return sortDir.value === 'asc' ? cmp : -cmp
  })
})

const totalCount = computed(() => filtered.value.length)
const pageItems = computed(() => filtered.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value))

const evalOpen = ref(false)
const evalTarget = ref<Enrollment | null>(null)
const score = ref(5)
const comment = ref('')
const error = ref<string | null>(null)

function openEval(item: Enrollment) {
  evalTarget.value = item
  score.value = 5
  comment.value = ''
  error.value = null
  evalOpen.value = true
}

const { submitting, guard } = useSubmitGuard()
async function submit() {
  if (!comment.value.trim()) { error.value = 'Le commentaire est requis'; return }
  if (!evalTarget.value) return
  try {
    await guard(() => withToast('Enregistrement…', () => enrollmentStore.submitHotEvaluation(evalTarget.value!.id, {
      score: score.value,
      comment: comment.value.trim(),
      date: new Date().toISOString().slice(0, 10),
    }), () => 'Enregistrement impossible'))
    evalOpen.value = false
  } catch (e) {
    error.value = getApiErrorMessage(e, 'Enregistrement impossible')
  }
}
</script>
