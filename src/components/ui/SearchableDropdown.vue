<template>
  <div class="relative" ref="rootEl">

    <!-- Trigger -->
    <button
      type="button"
      class="flex items-center gap-2 w-full h-[38px] px-2.5 border rounded-md bg-background text-[13px] cursor-pointer transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
      :class="open || selected ? 'border-primary bg-card' : 'border-border hover:border-primary'"
      :disabled="disabled"
      @click="toggle"
    >
      <template v-if="selected">
        <span v-if="showAvatar" :class="avatarClass" :style="avatarStyle(selected)">
          {{ avatarText(selected) }}
        </span>
        <span class="flex-1 text-foreground font-medium">{{ selected.label }}</span>
        <button type="button" class="flex items-center justify-center w-5 h-5 border-0 bg-border rounded-full cursor-pointer text-muted-foreground shrink-0 transition-colors hover:bg-danger-bg hover:text-danger" @click.stop="clear">
          <X class="w-3 h-3" />
        </button>
      </template>
      <template v-else>
        <User v-if="showAvatar" class="w-3.5 h-3.5 text-muted-foreground" />
        <span class="flex-1 text-muted-foreground">{{ placeholder }}</span>
        <ChevronDown class="w-3 h-3 text-muted-foreground transition-transform shrink-0" :class="{ 'rotate-180': open }" />
      </template>
    </button>

    <!-- Dropdown -->
    <div
      v-if="open"
      class="absolute left-0 z-[200] min-w-[260px] w-full bg-popover border border-border rounded-lg shadow-[0_4px_16px_rgba(0,0,0,0.12)] overflow-hidden"
      :class="dropUp ? 'bottom-[calc(100%+4px)]' : 'top-[calc(100%+4px)]'"
    >
      <div class="relative p-2 pb-1 border-b border-border">
        <Search class="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-3.5 h-3.5 pointer-events-none" />
        <input
          ref="searchEl"
          v-model="query"
          type="text"
          class="w-full h-8 pl-8 pr-2.5 border border-border rounded-md bg-background text-[13px] text-foreground outline-none focus:border-primary"
          placeholder="Rechercher..."
          @keydown.escape="close"
        />
      </div>
      <div class="max-h-60 overflow-y-auto p-1">
        <button
          v-for="item in filtered"
          :key="item.id"
          type="button"
          class="flex items-center gap-2 w-full px-2 py-[7px] border-0 rounded-md bg-transparent text-left transition-colors"
          :class="item.itemDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-primary/10'"
          :title="item.itemDisabled ? (item.disabledReason || 'Indisponible') : ''"
          @click="select(item)"
        >
          <span v-if="showAvatar" :class="avatarClass" :style="avatarStyle(item)">
            {{ avatarText(item) }}
          </span>
          <span class="flex-1 flex flex-col gap-px min-w-0">
            <span class="text-[13px] font-medium text-foreground truncate">{{ item.label }}{{ item.itemDisabled ? ' (désactivé)' : '' }}</span>
            <span v-if="item.sublabel" class="text-[11px] text-muted-foreground truncate">{{ item.sublabel }}</span>
          </span>
          <Check v-if="modelValue === item.id" class="w-3.5 h-3.5 text-primary shrink-0" />
        </button>
        <div v-if="filtered.length === 0" class="p-3.5 text-center text-[13px] text-muted-foreground">
          Aucun résultat{{ query ? ` pour « ${query} »` : '' }}
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { X, User, ChevronDown, Search, Check } from 'lucide-vue-next'

export interface DropdownItem {
  id:          string
  label:       string
  sublabel?:   string
  initials?:   string
  avatarColor?: string
  // Marque l'item comme visible mais non sélectionnable (ex : employé
  // désactivé) — même principe que TableLookupField.vue : montrer pourquoi
  // une option est indisponible plutôt que la faire disparaître.
  itemDisabled?: boolean
  disabledReason?: string
}

const props = withDefaults(defineProps<{
  items:        DropdownItem[]
  modelValue?:  string
  placeholder?: string
  disabled?:    boolean
  showAvatar?:  boolean
}>(), {
  placeholder: 'Sélectionner...',
  disabled:    false,
  showAvatar:  false,
})

const emit = defineEmits<{ 'update:modelValue': [id: string] }>()

const avatarClass = 'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0'

const rootEl   = ref<HTMLElement | null>(null)
const searchEl = ref<HTMLInputElement | null>(null)
const open     = ref(false)
const query    = ref('')
const dropUp   = ref(false)

// Hauteur approximative du panneau (barre de recherche + liste) — sert
// uniquement à decider du sens d'ouverture, pas besoin d'etre exacte.
const PANEL_HEIGHT = 300

const selected = computed(() =>
  props.modelValue ? props.items.find(i => i.id === props.modelValue) : undefined
)

const filtered = computed(() => {
  const q = query.value.toLowerCase().trim()
  return q
    ? props.items.filter(i =>
        i.label.toLowerCase().includes(q) ||
        (i.sublabel ?? '').toLowerCase().includes(q)
      )
    : props.items
})

function avatarText(item: DropdownItem): string {
  if (item.initials) return item.initials
  return item.label.split(' ').map(p => p.charAt(0)).join('').toUpperCase().slice(0, 2)
}

function avatarStyle(item: DropdownItem): Record<string, string> {
  return {
    background: item.avatarColor ?? 'var(--color-primary-light)',
    color:      item.avatarColor ? '#fff' : 'var(--color-primary)',
  }
}

function toggle() {
  if (props.disabled) return
  open.value ? close() : openDrop()
}

function openDrop() {
  // Decide du sens d'ouverture selon la place disponible a l'ecran — sans
  // ca, un champ situe en bas d'une longue fiche (ex: Intérimaire) ouvre son
  // panneau hors-viewport, invisible ou coupe (Lot G #5).
  if (rootEl.value) {
    const rect = rootEl.value.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    dropUp.value = spaceBelow < PANEL_HEIGHT && rect.top > spaceBelow
  }
  open.value  = true
  query.value = ''
  nextTick(() => searchEl.value?.focus())
}

function close() {
  open.value  = false
  query.value = ''
}

function select(item: DropdownItem) {
  if (item.itemDisabled) return
  emit('update:modelValue', item.id)
  close()
}

function clear() {
  emit('update:modelValue', '')
}

onClickOutside(rootEl, close)
</script>
