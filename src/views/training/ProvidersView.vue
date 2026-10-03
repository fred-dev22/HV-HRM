<template>
  <ListPageLayout
    title="Prestataires"
    :subtitle="`${providerStore.items.length} prestataire(s)`"
    :columns="columns"
    :items="pageItems"
    :total="totalCount"
    :total-text="`${totalCount} prestataire(s)`"
    search-placeholder="Rechercher un prestataire, une spécialité…"
    :page-size-options="[15, 25, 50]"
    scope-label="Prestataires :"
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
        <Plus class="w-4 h-4" /> Nouveau prestataire
      </button>
    </template>

    <template #cell-name="{ item }"><span class="font-medium text-foreground text-xs truncate">{{ item.name }}</span></template>
    <template #cell-contactName="{ item }"><span class="text-muted-foreground text-xs truncate">{{ item.contactName }}</span></template>
    <template #cell-specialties="{ item }"><span class="text-muted-foreground text-xs truncate">{{ item.specialties }}</span></template>
    <template #cell-lastEvaluationScore="{ item }">
      <span v-if="item.lastEvaluationScore" class="text-xs font-medium text-foreground">{{ item.lastEvaluationScore }}/5</span>
      <span v-else class="text-xs text-muted-foreground">-</span>
    </template>
    <template #cell-status="{ item }"><StatusPill :status="item.status" /></template>

    <template #details-panel="{ item }">
      <div class="flex flex-col gap-3.5">
        <div>
          <div class="text-sm font-semibold text-foreground truncate">{{ item.name }}</div>
          <div class="text-[11px] text-muted-foreground truncate">{{ item.specialties }}</div>
        </div>
        <div><StatusPill :status="item.status" /></div>
        <div class="grid grid-cols-2 gap-2 text-[12px]">
          <div><div class="text-muted-foreground text-[11px]">Contact</div>{{ item.contactName }}</div>
          <div><div class="text-muted-foreground text-[11px]">Téléphone</div>{{ item.phone }}</div>
          <div class="col-span-2"><div class="text-muted-foreground text-[11px]">E-mail</div>{{ item.email }}</div>
          <div class="col-span-2"><div class="text-muted-foreground text-[11px]">Prochaine évaluation</div>{{ formatDate(item.nextEvaluationDueAt) }}</div>
        </div>
        <button :class="L.btnPrimary" class="w-full justify-center" @click="openCard(item)">Ouvrir la fiche</button>
      </div>
    </template>

    <template #empty>
      <Landmark class="w-8 h-8" />
      <p class="text-[13px]">Aucun prestataire</p>
    </template>

    <CreateModalShell
      v-if="showCreate"
      title="Nouveau prestataire"
      banner-label="Nouveau prestataire"
      create-label="Créer"
      :is-saving="submitting"
      :save-error="error"
      @close="showCreate = false"
      @create="create"
    >
      <template #form>
        <div class="flex-1 overflow-auto px-6 py-5">
          <div class="max-w-3xl mx-auto">
            <FormSection title="Prestataire">
              <div class="grid grid-cols-2 gap-x-6 gap-y-4 max-sm:grid-cols-1">
                <div :class="cls.field" class="col-span-2">
                  <label :class="cls.fieldLabel">Nom <span class="text-danger">*</span></label>
                  <input v-model="form.name" :class="cls.fieldInput" placeholder="Raison sociale" />
                </div>
                <div :class="cls.field">
                  <label :class="cls.fieldLabel">Contact <span class="text-danger">*</span></label>
                  <input v-model="form.contactName" :class="cls.fieldInput" />
                </div>
                <div :class="cls.field">
                  <label :class="cls.fieldLabel">Téléphone <span class="text-danger">*</span></label>
                  <input v-model="form.phone" :class="cls.fieldInput" />
                </div>
                <div :class="cls.field" class="col-span-2">
                  <label :class="cls.fieldLabel">E-mail <span class="text-danger">*</span></label>
                  <input type="email" v-model="form.email" :class="cls.fieldInput" />
                </div>
                <div :class="cls.field" class="col-span-2">
                  <label :class="cls.fieldLabel">Spécialités <span class="text-danger">*</span></label>
                  <input v-model="form.specialties" :class="cls.fieldInput" placeholder="ex : Bureautique, langues…" />
                </div>
              </div>
            </FormSection>
          </div>
        </div>
      </template>
    </CreateModalShell>

    <ProviderCard v-if="openCardId !== null" :items="filtered" :item-id="openCardId" @close="openCardId = null" />
  </ListPageLayout>
</template>

<script setup lang="ts">
/**
 * Prestataires de formation (Provider), module Formation (backend /training,
 * voir src/stores/training). Évaluation annuelle
 * relancée automatiquement en décembre (voir Liste des besoins.xlsx #2).
 */
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { Plus, Landmark } from 'lucide-vue-next'
import { ListPageLayout, StatusPill, CreateModalShell } from '../../components'
import type { ListColumn } from '../../components/shared/ListPageLayout.vue'
import FormSection from '../../components/ui/form-field/FormSection.vue'
import ProviderCard from '../../components/training/ProviderCard.vue'
import * as cls from '../../lib/formClasses'
import * as L from '../../lib/listClasses'
import { formatDate } from '../../lib/date'
import { getApiErrorMessage } from '../../lib/api'
import { withToast } from '../../lib/withToast'
import { loadAll } from '../../lib/runAction'
import { useSubmitGuard } from '../../lib/submitGuard'
import { useProviderStore } from '../../stores/training'
import type { Provider } from '../../stores/training'

const providerStore = useProviderStore()
onMounted(() => loadAll(() => providerStore.fetchAll()))

const openCardId = ref<string | null>(null)
function openCard(item: Provider) { openCardId.value = item.id }

const columns: ListColumn[] = [
  { key: 'name', label: 'Nom', sortable: true, hideable: false, width: 200 },
  { key: 'contactName', label: 'Contact', width: 170 },
  { key: 'specialties', label: 'Spécialités', width: 220 },
  { key: 'lastEvaluationScore', label: 'Dernière éval.', align: 'center', width: 120 },
  { key: 'status', label: 'Statut', width: 110 },
]

const scopeOptions = [
  { value: '', label: 'Tous' },
  { value: 'active', label: 'Actifs' },
  { value: 'inactive', label: 'Inactifs' },
]
const activeScope = ref('')
const searchQuery = ref('')
const sortKey = ref('name')
const sortDir = ref<'asc' | 'desc'>('asc')
const page = ref(1)
const pageSize = ref(15)

watch([activeScope, searchQuery, pageSize], () => { page.value = 1 })
function resetFilters() { searchQuery.value = ''; activeScope.value = ''; page.value = 1 }

const filtered = computed(() => {
  let rows = providerStore.items.filter(p => {
    if (activeScope.value && p.status !== activeScope.value) return false
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      if (!p.name.toLowerCase().includes(q) && !p.specialties.toLowerCase().includes(q)) return false
    }
    return true
  })
  rows = [...rows].sort((a, b) => {
    const cmp = a.name.localeCompare(b.name)
    return sortDir.value === 'asc' ? cmp : -cmp
  })
  return rows
})

const totalCount = computed(() => filtered.value.length)
const pageItems = computed(() => filtered.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value))

const showCreate = ref(false)
const error = ref<string | null>(null)
const form = reactive({ name: '', contactName: '', email: '', phone: '', specialties: '' })

function resetForm() {
  Object.assign(form, { name: '', contactName: '', email: '', phone: '', specialties: '' })
  error.value = null
}

function validate(): boolean {
  if (!form.name.trim()) { error.value = 'Le nom est requis'; return false }
  if (!form.contactName.trim()) { error.value = 'Le contact est requis'; return false }
  if (!form.email.trim()) { error.value = "L'e-mail est requis"; return false }
  if (!form.phone.trim()) { error.value = 'Le téléphone est requis'; return false }
  if (!form.specialties.trim()) { error.value = 'Les spécialités sont requises'; return false }
  error.value = null
  return true
}

const { submitting, guard } = useSubmitGuard()
async function create() {
  if (!validate()) return
  try {
    await guard(() => withToast('Création…', () => providerStore.create({
      name: form.name.trim(),
      contactName: form.contactName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      specialties: form.specialties.trim(),
    }), () => 'Création impossible'))
    showCreate.value = false
    resetForm()
  } catch (e) {
    error.value = getApiErrorMessage(e, 'Création impossible')
  }
}
</script>
