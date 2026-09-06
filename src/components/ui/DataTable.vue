<template>
  <div class="flex flex-col bg-card rounded-lg border border-border overflow-hidden">

    <!-- Filters bar + built-in toolbar -->
    <div v-if="$slots.filters || hideableColumns.length > 0" class="min-h-11 border-b border-border flex items-center gap-2 px-3.5 py-1.5">
      <div class="flex-1 flex gap-2 flex-wrap items-center">
        <slot name="filters" />
      </div>
      <div class="flex items-center gap-1 shrink-0">
        <button
          :class="[toolBtnClass, density === 'compact' && toolBtnActiveClass]"
          :title="density === 'compact' ? 'Affichage normal' : 'Affichage compact'"
          @click="toggleDensity"
        >
          <Rows3 class="w-3.5 h-3.5" />
        </button>
        <div v-if="hideableColumns.length > 0" ref="colsWrapRef" class="relative">
          <button
            :class="[toolBtnClass, showColMenu && toolBtnActiveClass]"
            title="Visibilité des colonnes"
            @click="showColMenu = !showColMenu"
          >
            <Columns3 class="w-3.5 h-3.5" />
          </button>
          <div
            v-if="showColMenu"
            class="absolute top-[calc(100%+4px)] right-0 z-[300] bg-popover border border-border rounded-lg shadow-[0_4px_16px_rgba(0,0,0,0.12)] p-1.5 min-w-40"
          >
            <div class="text-[10px] font-bold text-muted-foreground tracking-[0.06em] px-2 pt-1 pb-1.5">COLONNES</div>
            <label
              v-for="col in hideableColumns" :key="col.key"
              class="flex items-center gap-2 px-2 py-1.5 rounded text-xs text-foreground cursor-pointer select-none hover:bg-background"
            >
              <input
                type="checkbox"
                class="accent-primary"
                :checked="!hiddenKeys.includes(col.key)"
                @change="toggleColumn(col.key)"
              />
              <span>{{ col.label }}</span>
            </label>
          </div>
        </div>
      </div>
    </div>

    <!-- Table -->
    <div class="overflow-x-auto">
      <table class="w-full border-collapse text-[13px]">
        <thead>
          <tr class="bg-background border-b border-border">
            <th
              v-for="col in visibleColumns" :key="col.key"
              class="px-3.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.04em] whitespace-nowrap"
              :class="[cellPad, col.sortable && 'cursor-pointer select-none hover:text-primary']"
              :style="{ width: col.width, textAlign: col.align ?? 'left' }"
              @click="col.sortable && $emit('sort', col.key)"
            >
              <span class="inline-flex items-center gap-1">
                {{ col.label }}
                <span v-if="col.sortable" class="opacity-60">
                  <ArrowDownAZ v-if="sortKey === col.key && sortDir === 'asc'" class="w-3.5 h-3.5" />
                  <ArrowDownZA v-else-if="sortKey === col.key && sortDir === 'desc'" class="w-3.5 h-3.5" />
                  <ArrowUpDown v-else class="w-3 h-3" />
                </span>
              </span>
            </th>
          </tr>
        </thead>

        <tbody>
          <tr v-if="loading">
            <td :colspan="visibleColumns.length" class="text-center px-5 py-12 text-muted-foreground text-[13px]">
              <Loader2 class="w-4 h-4 animate-spin inline-block mr-1 align-[-2px]" /> Chargement…
            </td>
          </tr>

          <tr v-else-if="!rows.length">
            <td :colspan="visibleColumns.length" class="text-center px-5 py-12 text-muted-foreground text-[13px]">
              <Inbox class="w-7 h-7 mx-auto mb-2" />
              {{ emptyMessage ?? 'Aucun résultat trouvé' }}
            </td>
          </tr>

          <template v-else v-for="(row, i) in pagedRows" :key="rowKey ? row[rowKey] : i">
            <tr
              class="border-b border-border last:border-b-0 transition-colors cursor-pointer hover:bg-primary/10"
              @click="$emit('rowClick', row)"
            >
              <td
                v-for="col in visibleColumns" :key="col.key"
                class="px-3.5 text-foreground align-middle"
                :class="cellPad"
                :style="{ textAlign: col.align ?? 'left' }"
              >
                <slot :name="`cell-${col.key}`" :row="row" :value="row[col.key]">
                  {{ row[col.key] }}
                </slot>
              </td>
            </tr>
            <slot name="row-after" :row="row" :index="i" />
          </template>
        </tbody>
      </table>
    </div>

    <!-- Built-in pagination (when pageSize prop is set and no external #pagination slot) -->
    <div v-if="props.pageSize && !$slots.pagination && rows.length > 0" class="px-3.5 py-2 border-t border-border flex items-center gap-3">
      <span class="text-xs text-muted-foreground flex-1">{{ pageStart + 1 }}–{{ pageEnd }} / {{ rows.length }}</span>
      <div class="flex items-center gap-2">
        <button :class="pgBtnClass" :disabled="currentPage <= 1" @click="currentPage--">
          <ChevronLeft class="w-3.5 h-3.5" />
        </button>
        <span class="text-xs text-foreground min-w-[50px] text-center">{{ currentPage }} / {{ totalPages }}</span>
        <button :class="pgBtnClass" :disabled="currentPage >= totalPages" @click="currentPage++">
          <ChevronRight class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <!-- External pagination slot (backward compat) -->
    <div v-else-if="$slots.pagination" class="px-3.5 py-2 border-t border-border flex items-center gap-3">
      <slot name="pagination" />
    </div>

  </div>
</template>

<script setup lang="ts" generic="T extends Record<string, any>">
import { ref, computed, watch } from 'vue'
import { onClickOutside } from '@vueuse/core'
import {
  Rows3, Columns3, ArrowDownAZ, ArrowDownZA, ArrowUpDown, Loader2, Inbox,
  ChevronLeft, ChevronRight,
} from 'lucide-vue-next'

const props = defineProps<{
  columns: Array<{
    key: string
    label: string
    width?: string
    align?: 'left' | 'center' | 'right'
    sortable?: boolean
    hideable?: boolean
  }>
  rows: T[]
  loading?: boolean
  emptyMessage?: string
  rowKey?: string
  sortKey?: string
  sortDir?: 'asc' | 'desc'
  pageSize?: number
}>()

defineEmits<{
  rowClick: [row: T]
  sort: [key: string]
}>()

// ── Classes du design system ─────────────────────────────────
const toolBtnClass =
  'w-[30px] h-[30px] border border-border rounded-md bg-background text-muted-foreground cursor-pointer flex items-center justify-center transition-colors hover:bg-card hover:text-foreground'
const toolBtnActiveClass = '!bg-primary/10 !text-primary !border-primary'
const pgBtnClass =
  'w-7 h-7 border border-border rounded bg-background text-muted-foreground cursor-pointer flex items-center justify-center transition-colors hover:bg-card hover:text-foreground disabled:opacity-40 disabled:cursor-default'

// ── Density ──────────────────────────────────────────────────
const density = ref<'normal' | 'compact'>('normal')
function toggleDensity() {
  density.value = density.value === 'normal' ? 'compact' : 'normal'
}
const cellPad = computed(() => (density.value === 'compact' ? 'py-1.5' : 'py-2.5'))

// ── Column visibility ─────────────────────────────────────────
const hiddenKeys   = ref<string[]>([])
const showColMenu  = ref(false)
const colsWrapRef  = ref<HTMLElement | null>(null)

onClickOutside(colsWrapRef, () => { showColMenu.value = false })

const hideableColumns = computed(() => props.columns.filter(c => c.hideable))
const visibleColumns  = computed(() => props.columns.filter(c => !hiddenKeys.value.includes(c.key)))

function toggleColumn(key: string) {
  const idx = hiddenKeys.value.indexOf(key)
  if (idx >= 0) hiddenKeys.value.splice(idx, 1)
  else hiddenKeys.value.push(key)
}

// ── Pagination ─────────────────────────────────────────────────
const currentPage = ref(1)

const totalPages = computed(() =>
  props.pageSize ? Math.max(1, Math.ceil(props.rows.length / props.pageSize)) : 1
)
const pageStart = computed(() =>
  props.pageSize ? (currentPage.value - 1) * props.pageSize : 0
)
const pageEnd = computed(() =>
  props.pageSize
    ? Math.min(pageStart.value + props.pageSize, props.rows.length)
    : props.rows.length
)
const pagedRows = computed(() =>
  props.pageSize ? props.rows.slice(pageStart.value, pageEnd.value) : props.rows
)

watch(() => props.rows.length, () => { currentPage.value = 1 })
</script>
