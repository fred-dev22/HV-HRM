<template>
  <ListPageLayout
    title="Mon équipe"
    :subtitle="entityName"
    :columns="columns"
    :items="pageItems"
    :total="totalCount"
    :total-text="`${totalCount} membre(s)`"
    search-placeholder="Rechercher un membre…"
    v-model:search-query="searchQuery"
    v-model:sort-key="sortKey"
    v-model:sort-dir="sortDir"
    v-model:page="page"
    v-model:page-size="pageSize"
    @open-card="openCard"
  >
    <template #cell-name="{ item }">
      <div class="flex items-center gap-2.5">
        <div class="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0" :style="{ background: item.avatarBg, color: item.avatarText }">{{ item.initials }}</div>
        <div class="min-w-0">
          <div class="font-medium text-[13px] truncate">{{ item.name }}</div>
          <div class="text-[11px] text-muted-foreground truncate">{{ item.email }}</div>
        </div>
      </div>
    </template>
    <template #cell-jobTitle="{ item }"><span class="text-muted-foreground text-xs truncate">{{ item.jobTitle }}</span></template>
    <template #cell-entityName="{ item }"><span class="text-muted-foreground text-xs truncate">{{ item.entityName }}</span></template>
    <template #cell-contractType="{ item }"><span class="text-muted-foreground text-xs">{{ item.contractType }}</span></template>
    <template #cell-status="{ item }"><StatusPill :status="item.status" /></template>

    <template #details-panel="{ item }">
      <div class="flex flex-col gap-3.5">
        <div class="flex items-center gap-2.5">
          <div class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0" :style="{ background: item.avatarBg, color: item.avatarText }">{{ item.initials }}</div>
          <div class="min-w-0"><div class="text-sm font-semibold text-foreground truncate">{{ item.name }}</div><div class="text-[11px] text-muted-foreground">{{ item.jobTitle }}</div></div>
        </div>
        <div><StatusPill :status="item.status" /></div>
        <div class="grid grid-cols-2 gap-2 text-[12px]">
          <div><div class="text-muted-foreground text-[11px]">Matricule</div>{{ item.code }}</div>
          <div><div class="text-muted-foreground text-[11px]">Contrat</div>{{ item.contractType }}</div>
        </div>
        <div v-if="item.email" class="text-[12px]"><div class="text-muted-foreground text-[11px]">Email</div>{{ item.email }}</div>
        <button :class="L.btnPrimary" class="w-full justify-center" @click="openCard(item)">Ouvrir la fiche</button>
      </div>
    </template>

    <template #empty>
      <Users class="w-8 h-8" />
      <p class="text-[13px]">Aucun membre d'équipe trouvé</p>
    </template>

    <EmployeeCard v-if="openCardId !== null" :employees="filtered" :employee-id="openCardId" @close="openCardId = null" />
  </ListPageLayout>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Users } from 'lucide-vue-next'
import { StatusPill, ListPageLayout } from '../../components'
import type { ListColumn } from '../../components/shared/ListPageLayout.vue'
import EmployeeCard from '../../components/employees/EmployeeCard.vue'
import * as L from '../../lib/listClasses'
import { useAuthStore } from '../../stores/auth'
import { useEmployeeStore } from '../../stores/employees'
import { useEntityStore } from '../../stores/entities'
import type { Employee } from '../../types'

const auth = useAuthStore()
const employeeStore = useEmployeeStore()
const entityStore = useEntityStore()
// Séquencé : mapEmployee lit entityStore de façon synchrone pour entityName.
// /employees/team (EMPLOYE_VOIR_EQUIPE) plutôt que fetchAll (EMPLOYE_VOIR_TOUT)
// — cette page est accessible aux managers qui n'ont que la permission
// restreinte à leur équipe.
;(async () => {
  if (entityStore.entities.length === 0) await entityStore.fetchAll()
  try {
    await employeeStore.fetchTeam()
  } catch {
    // employeeStore.error porte le message ; la page reste affichée
    // avec la liste vide plutôt que d'échouer silencieusement.
  }
})()

const openCardId = ref<string | null>(null)
function openCard(item: Employee) { openCardId.value = item.id }

const searchQuery = ref('')
const sortKey = ref('')
const sortDir = ref<'asc' | 'desc'>('asc')
const page = ref(1)
const pageSize = ref(10)
watch([searchQuery, pageSize], () => { page.value = 1 })

const columns: ListColumn[] = [
  { key: 'name', label: 'Employé', sortable: true, hideable: false, width: 240 },
  { key: 'jobTitle', label: 'Poste', sortable: true, width: 180 },
  { key: 'entityName', label: 'Entité', sortable: true, width: 160 },
  { key: 'contractType', label: 'Contrat', width: 110 },
  { key: 'status', label: 'Statut', width: 120 },
]

const myEntityId = computed(() => auth.user?.entityId ?? '')
const entityName = computed(() => myEntityId.value ? (entityStore.getEntityById(myEntityId.value)?.name ?? '') : '')

const teamMembers = computed(() =>
  myEntityId.value ? employeeStore.team.filter(e => e.entityId === myEntityId.value && e.id !== auth.user?.id) : [],
)

const sortFieldMap: Record<string, keyof Employee> = { name: 'name', jobTitle: 'jobTitle', entityName: 'entityName' }

const filtered = computed(() => {
  let rows = teamMembers.value
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    rows = rows.filter(e => e.name.toLowerCase().includes(q) || e.jobTitle.toLowerCase().includes(q))
  }
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
</script>
