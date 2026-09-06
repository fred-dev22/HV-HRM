<script setup lang="ts">
/**
 * TableLookupField — sélection d'une ENTITÉ (code + libellé) via un mini-tableau
 * déroulant + une liste complète, à la manière du frontdesk
 * (P247_FD_LWL_APP/src/components/ui/table-lookup/TableLookupField.vue).
 *
 * Cœur générique : piloté par une `fetchFn` (branchée sur les stores HRM), sans
 * le câblage entités du frontdesk. Pour les vrais objets métier (employés,
 * entités…) — pas les simples options d'un select.
 */
import { ref, watch, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { ChevronDown, Check, Search, X } from 'lucide-vue-next'
import ModalShell from '../ModalShell.vue'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyItem = Record<string, any>

export interface LookupColumn {
  key: string
  label: string
  width?: string
}
export interface LookupFetchParams {
  page: number
  pageSize: number
  searchQuery?: string
}
export interface LookupFetchResult {
  items: AnyItem[]
  total?: number
}

const props = withDefaults(
  defineProps<{
    code: string
    name: string
    label?: string
    columns: LookupColumn[]
    fetchFn: (params: LookupFetchParams) => Promise<LookupFetchResult> | LookupFetchResult
    modalTitle?: string
    valueKey?: string
    nameKey?: string
    placeholder?: string
    pageSize?: number
    dropdownPageSize?: number
    required?: boolean
    invalid?: boolean
    disabled?: boolean
    // Marque certaines LIGNES de la liste comme non sélectionnables (ex :
    // employé/entité désactivé) sans les retirer de la liste — l'utilisateur
    // doit voir pourquoi l'option existe mais reste indisponible plutôt
    // qu'elle disparaisse silencieusement (même principe que le picker de
    // validateurs dans ApprovalPoolConfig.vue, decision du 30/07).
    isItemDisabled?: (item: AnyItem) => boolean
    itemDisabledReason?: (item: AnyItem) => string
  }>(),
  {
    valueKey: 'id',
    nameKey: 'name',
    placeholder: '',
    pageSize: 25,
    dropdownPageSize: 20,
    modalTitle: 'Sélectionner',
    required: false,
    invalid: false,
    disabled: false,
  },
)

const emit = defineEmits<{
  'update:code': [value: string]
  'update:name': [value: string]
  select: [item: AnyItem]
}>()

const DEBOUNCE_MS = 250

const displayName = ref(props.name)
watch(() => props.name, (v) => { displayName.value = v })

/* ── Dropdown ───────────────────────────────────────────────── */
const dropdownOpen = ref(false)
const wrapperRef = ref<HTMLElement | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)
const dropdownPosition = ref({ top: 0, left: 0, width: 280 })
const dropdownMaxHeight = ref(240)
const listItems = ref<AnyItem[]>([])
const dropdownLoading = ref(false)
const searchQuery = ref('')
let searchDebounce: ReturnType<typeof setTimeout> | null = null

async function loadDropdownItems(query?: string) {
  dropdownLoading.value = true
  try {
    const res = await props.fetchFn({
      page: 1,
      pageSize: props.dropdownPageSize,
      searchQuery: (query ?? searchQuery.value).trim() || undefined,
    })
    listItems.value = res.items
  } finally {
    dropdownLoading.value = false
  }
}

watch(searchQuery, () => {
  if (searchDebounce) clearTimeout(searchDebounce)
  searchDebounce = setTimeout(() => { if (dropdownOpen.value) loadDropdownItems() }, DEBOUNCE_MS)
})

// Positionne le dropdown sous le champ par defaut, mais bascule au-dessus
// (et reduit sa hauteur max) s'il n'y a pas la place en dessous — sinon,
// pour un champ situe bas dans une popup, le dropdown deborde du viewport
// et rien ne permet de scroller pour voir le reste (c'est un panneau
// position:fixed hors de tout conteneur scrollable, pas une simple
// superposition dans le flux de la page).
const DROPDOWN_FOOTER_HEIGHT = 40
const DROPDOWN_MAX = 240
const DROPDOWN_MARGIN = 8

function updateDropdownPosition() {
  if (!wrapperRef.value) return
  const rect = wrapperRef.value.getBoundingClientRect()
  const width = Math.max(rect.width, 280)
  const spaceBelow = window.innerHeight - rect.bottom - DROPDOWN_MARGIN
  const spaceAbove = rect.top - DROPDOWN_MARGIN
  const fitsBelow = spaceBelow >= DROPDOWN_MAX + DROPDOWN_FOOTER_HEIGHT
  const openUpward = !fitsBelow && spaceAbove > spaceBelow

  const available = (openUpward ? spaceAbove : spaceBelow) - DROPDOWN_FOOTER_HEIGHT
  dropdownMaxHeight.value = Math.max(80, Math.min(DROPDOWN_MAX, available))

  dropdownPosition.value = {
    top: openUpward
      ? Math.max(DROPDOWN_MARGIN, rect.top - dropdownMaxHeight.value - DROPDOWN_FOOTER_HEIGHT - 4)
      : rect.bottom + 4,
    left: rect.left,
    width,
  }
}

function openDropdown() {
  if (props.disabled) return
  searchQuery.value = ''
  dropdownOpen.value = true
  loadDropdownItems()
  nextTick(updateDropdownPosition)
}
function toggleDropdown() {
  if (dropdownOpen.value) dropdownOpen.value = false
  else openDropdown()
}
function onInputFocus() { if (!dropdownOpen.value) openDropdown() }
function onInputInput(e: Event) {
  searchQuery.value = (e.target as HTMLInputElement).value
  if (!dropdownOpen.value) { dropdownOpen.value = true; nextTick(updateDropdownPosition) }
}

function itemDisabled(item: AnyItem): boolean {
  return props.isItemDisabled ? props.isItemDisabled(item) : false
}
function itemDisabledReason(item: AnyItem): string {
  return props.itemDisabledReason ? props.itemDisabledReason(item) : ''
}

function selectItem(item: AnyItem) {
  if (itemDisabled(item)) return
  emit('update:code', String(item[props.valueKey] ?? ''))
  emit('update:name', String(item[props.nameKey] ?? ''))
  emit('select', item)
  displayName.value = String(item[props.nameKey] ?? '')
  searchQuery.value = ''
  dropdownOpen.value = false
}
function clearSelection() {
  emit('update:code', '')
  emit('update:name', '')
  displayName.value = ''
}

/* ── Liste complète (modale) ────────────────────────────────── */
const modalOpen = ref(false)
const modalItems = ref<AnyItem[]>([])
const modalLoading = ref(false)
const modalSearch = ref('')
const modalPage = ref(1)
const modalTotal = ref(0)
let modalDebounce: ReturnType<typeof setTimeout> | null = null

const modalTotalPages = computed(() => Math.max(1, Math.ceil(modalTotal.value / props.pageSize)))

async function loadModalItems() {
  modalLoading.value = true
  try {
    const res = await props.fetchFn({
      page: modalPage.value,
      pageSize: props.pageSize,
      searchQuery: modalSearch.value.trim() || undefined,
    })
    modalItems.value = res.items
    modalTotal.value = res.total ?? res.items.length
  } finally {
    modalLoading.value = false
  }
}
function openFullList() {
  if (props.disabled) return
  dropdownOpen.value = false
  modalOpen.value = true
  modalSearch.value = ''
  modalPage.value = 1
  loadModalItems()
}
function selectFromModalIfEnabled(item: AnyItem) {
  if (itemDisabled(item)) return
  selectFromModal(item)
}
watch(modalSearch, () => {
  if (modalDebounce) clearTimeout(modalDebounce)
  modalDebounce = setTimeout(() => { modalPage.value = 1; loadModalItems() }, DEBOUNCE_MS)
})
watch(modalPage, loadModalItems)
function selectFromModal(item: AnyItem) {
  selectItem(item)
  modalOpen.value = false
}

/* ── Évènements globaux ─────────────────────────────────────── */
function onClickOutside(e: MouseEvent) {
  if (wrapperRef.value && !wrapperRef.value.contains(e.target as Node) &&
      dropdownRef.value && !dropdownRef.value.contains(e.target as Node)) {
    dropdownOpen.value = false
    searchQuery.value = ''
  }
}
function onKeydown(e: KeyboardEvent) { if (e.key === 'Escape') { dropdownOpen.value = false } }
function onScrollOrResize() { if (dropdownOpen.value) updateDropdownPosition() }

onMounted(() => {
  document.addEventListener('mousedown', onClickOutside)
  document.addEventListener('keydown', onKeydown)
  window.addEventListener('scroll', onScrollOrResize, true)
  window.addEventListener('resize', onScrollOrResize)
})
onUnmounted(() => {
  document.removeEventListener('mousedown', onClickOutside)
  document.removeEventListener('keydown', onKeydown)
  window.removeEventListener('scroll', onScrollOrResize, true)
  window.removeEventListener('resize', onScrollOrResize)
  if (searchDebounce) clearTimeout(searchDebounce)
  if (modalDebounce) clearTimeout(modalDebounce)
})
</script>

<template>
  <div ref="wrapperRef" class="relative" :class="{ 'opacity-70 pointer-events-none': disabled }">
    <label v-if="label" class="block text-[11px] text-muted-foreground mb-1">
      <span v-if="required" class="text-danger">* </span>{{ label }}
    </label>
    <div
      class="grid grid-cols-[1fr_1fr_auto_auto] rounded-md border overflow-hidden bg-card"
      :class="invalid ? 'border-danger' : 'border-border'"
    >
      <input
        :value="dropdownOpen ? searchQuery : code"
        type="text"
        class="min-w-0 w-full px-3 py-1.5 border-0 bg-card text-[13px] rounded-none focus:outline-none"
        :placeholder="placeholder"
        :disabled="disabled"
        @focus="onInputFocus"
        @input="onInputInput"
      />
      <div class="min-w-0 px-3 py-1.5 bg-background text-muted-foreground text-[13px] flex items-center truncate">
        {{ displayName || ' ' }}
      </div>
      <button
        v-if="(code || name) && !disabled"
        type="button"
        class="shrink-0 h-full px-2 bg-background flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background cursor-pointer"
        title="Effacer"
        @click.stop.prevent="clearSelection"
      >
        <X class="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        class="shrink-0 px-2 py-1.5 bg-background text-muted-foreground hover:bg-background disabled:opacity-50 cursor-pointer"
        :title="label"
        :disabled="disabled"
        @click="toggleDropdown"
      >
        <ChevronDown class="w-4 h-4" />
      </button>
    </div>

    <!-- Dropdown mini-table -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-150 ease-out" enter-from-class="opacity-0 -translate-y-1" enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition duration-100 ease-in" leave-from-class="opacity-100 translate-y-0" leave-to-class="opacity-0 -translate-y-1"
      >
        <div
          v-if="dropdownOpen"
          ref="dropdownRef"
          class="fixed z-[9999] bg-card border border-border shadow-lg rounded-md overflow-hidden"
          :style="{ top: `${dropdownPosition.top}px`, left: `${dropdownPosition.left}px`, width: `${dropdownPosition.width}px`, minWidth: '280px' }"
        >
          <div class="overflow-y-auto min-h-[80px] flex flex-col" :style="{ maxHeight: `${dropdownMaxHeight}px` }">
            <div v-if="dropdownLoading" class="flex-1 flex items-center justify-center py-8 text-muted-foreground text-[13px]">Chargement…</div>
            <table v-else class="w-full text-[13px] table-fixed">
              <thead>
                <tr class="border-b border-border bg-background sticky top-0">
                  <th class="w-8 px-2 py-1.5" />
                  <th v-for="col in columns" :key="col.key" class="px-3 py-1.5 text-left text-[11px] font-semibold text-muted-foreground whitespace-nowrap" :style="col.width ? { width: col.width } : {}">
                    {{ col.label }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="item in listItems"
                  :key="String(item[valueKey])"
                  class="transition-colors border-b border-border/50 last:border-0 text-foreground"
                  :class="itemDisabled(item) ? 'opacity-50 cursor-not-allowed' : (String(item[valueKey]) === code ? 'bg-primary/10 cursor-pointer' : 'cursor-pointer hover:bg-primary/10')"
                  :title="itemDisabled(item) ? itemDisabledReason(item) : ''"
                  @mousedown.stop.prevent="selectItem(item)"
                >
                  <td class="w-8 px-2 py-1.5 text-center">
                    <Check v-if="String(item[valueKey]) === code" class="w-4 h-4 text-primary inline-block" />
                  </td>
                  <td v-for="col in columns" :key="col.key" class="px-3 py-1.5 whitespace-nowrap overflow-hidden text-ellipsis" :class="col.key === valueKey ? 'font-medium text-primary' : ''">
                    {{ item[col.key] ?? '' }}{{ col.key === nameKey && itemDisabled(item) ? ' (désactivé)' : '' }}
                  </td>
                </tr>
                <tr v-if="listItems.length === 0">
                  <td :colspan="columns.length + 1" class="px-3 py-4 text-center text-muted-foreground text-[13px]">Aucun élément</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="flex items-center justify-end px-3 py-2 text-[12px] border-t border-border bg-background/40">
            <button type="button" class="text-primary hover:underline cursor-pointer" @mousedown.stop.prevent="openFullList">
              Sélectionner depuis la liste complète
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Liste complète -->
    <ModalShell :open="modalOpen" :title="modalTitle" max-width="max-w-[680px]" @close="modalOpen = false">
      <div class="flex items-center gap-1.5 border border-border rounded-md px-2 h-[34px] bg-card mb-3">
        <Search class="w-3.5 h-3.5 text-muted-foreground" />
        <input v-model="modalSearch" type="text" placeholder="Rechercher…" class="border-0 outline-none text-[13px] text-foreground bg-transparent w-full placeholder:text-muted-foreground" />
      </div>
      <div class="border border-border rounded-md overflow-hidden">
        <table class="w-full text-[13px]">
          <thead>
            <tr class="bg-primary/10 border-b border-primary/20">
              <th v-for="col in columns" :key="col.key" class="px-3 py-2 text-left text-xs font-semibold text-foreground whitespace-nowrap">{{ col.label }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="modalLoading"><td :colspan="columns.length" class="px-3 py-8 text-center text-muted-foreground">Chargement…</td></tr>
            <tr
              v-else
              v-for="item in modalItems"
              :key="String(item[valueKey])"
              class="border-b border-border last:border-0"
              :class="itemDisabled(item) ? 'opacity-50 cursor-not-allowed' : (String(item[valueKey]) === code ? 'bg-primary/10 cursor-pointer' : 'cursor-pointer hover:bg-primary/10')"
              :title="itemDisabled(item) ? itemDisabledReason(item) : ''"
              @click="selectFromModalIfEnabled(item)"
            >
              <td v-for="col in columns" :key="col.key" class="px-3 py-2 whitespace-nowrap" :class="col.key === valueKey ? 'font-medium text-primary' : 'text-foreground'">
                {{ item[col.key] ?? '' }}{{ col.key === nameKey && itemDisabled(item) ? ' (désactivé)' : '' }}
              </td>
            </tr>
            <tr v-if="!modalLoading && modalItems.length === 0"><td :colspan="columns.length" class="px-3 py-8 text-center text-muted-foreground">Aucun élément</td></tr>
          </tbody>
        </table>
      </div>
      <div class="flex items-center justify-between mt-3 text-[12px] text-muted-foreground">
        <span>{{ modalTotal }} élément(s)</span>
        <div class="flex items-center gap-1.5">
          <button class="px-2 py-1 rounded border border-border disabled:opacity-40 cursor-pointer" :disabled="modalPage <= 1" @click="modalPage--">Précédent</button>
          <span>{{ modalPage }} / {{ modalTotalPages }}</span>
          <button class="px-2 py-1 rounded border border-border disabled:opacity-40 cursor-pointer" :disabled="modalPage >= modalTotalPages" @click="modalPage++">Suivant</button>
        </div>
      </div>
    </ModalShell>
  </div>
</template>
