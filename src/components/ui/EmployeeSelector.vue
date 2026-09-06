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
        <span :class="avatarClass" :style="{ background: selected.avatarBg ?? '#B5D4F4', color: selected.avatarText ?? '#0C447C' }">{{ initials(selected.name) }}</span>
        <span class="flex-1 text-foreground font-medium">{{ selected.name }}</span>
        <button type="button" class="flex items-center justify-center w-5 h-5 border-0 bg-border rounded-full cursor-pointer text-muted-foreground shrink-0 transition-colors hover:bg-danger-bg hover:text-danger" @click.stop="clear">
          <X class="w-3 h-3" />
        </button>
      </template>
      <template v-else>
        <User class="w-3.5 h-3.5 text-muted-foreground" />
        <span class="flex-1 text-muted-foreground">{{ placeholder }}</span>
        <ChevronDown class="w-3 h-3 text-muted-foreground transition-transform shrink-0" :class="{ 'rotate-180': open }" />
      </template>
    </button>

    <!-- Dropdown -->
    <div
      v-if="open"
      class="absolute left-0 z-[200] min-w-[280px] w-full bg-popover border border-border rounded-lg shadow-[0_4px_16px_rgba(0,0,0,0.12)] overflow-hidden"
      :class="dropUp ? 'bottom-[calc(100%+4px)]' : 'top-[calc(100%+4px)]'"
    >
      <!-- Search -->
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

      <!-- List -->
      <div class="max-h-[220px] overflow-y-auto p-1">
        <button
          v-for="emp in filtered"
          :key="emp.id"
          type="button"
          class="flex items-center gap-2 w-full px-2 py-[7px] border-0 rounded-md bg-transparent cursor-pointer text-left transition-colors hover:bg-primary/10"
          :class="{ 'bg-primary/10': modelValue === emp.id }"
          @click="select(emp.id)"
        >
          <span :class="avatarClass" :style="{ background: emp.avatarBg ?? '#B5D4F4', color: emp.avatarText ?? '#0C447C' }">{{ initials(emp.name) }}</span>
          <span class="flex-1 flex flex-col gap-px min-w-0">
            <span class="text-[13px] font-medium text-foreground">{{ emp.name }}</span>
            <span v-if="emp.entityName" class="text-[11px] text-muted-foreground">{{ emp.entityName }}</span>
          </span>
          <Check v-if="modelValue === emp.id" class="w-3.5 h-3.5 text-primary shrink-0" />
        </button>

        <div v-if="filtered.length === 0" class="p-4 text-center text-[13px] text-muted-foreground">
          Aucun résultat pour « {{ query }} »
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { X, User, ChevronDown, Search, Check } from 'lucide-vue-next'

interface EmpItem {
  id:          string
  name:        string
  avatarBg?:   string
  avatarText?: string
  entityName?: string
}

const props = withDefaults(defineProps<{
  employees:   EmpItem[]
  modelValue?: string
  placeholder?: string
  disabled?:   boolean
}>(), {
  placeholder: 'Sélectionner un employé',
  disabled:    false,
})

const emit = defineEmits<{ 'update:modelValue': [id: string] }>()

const avatarClass = 'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0'

const rootEl   = ref<HTMLElement | null>(null)
const searchEl = ref<HTMLInputElement | null>(null)
const open     = ref(false)
const query    = ref('')
const dropUp   = ref(false)

// Hauteur approximative du panneau — sert uniquement a decider du sens
// d'ouverture, pas besoin d'etre exacte.
const PANEL_HEIGHT = 260

const selected = computed(() =>
  props.modelValue ? props.employees.find(e => e.id === props.modelValue) : undefined
)

const filtered = computed(() => {
  const q = query.value.toLowerCase().trim()
  return q ? props.employees.filter(e => e.name.toLowerCase().includes(q)) : props.employees
})

function initials(name: string) {
  return name.split(' ').map(p => p[0] ?? '').join('').toUpperCase().slice(0, 2)
}

function toggle() {
  if (props.disabled) return
  open.value ? close() : openDropdown()
}

function openDropdown() {
  // Decide du sens d'ouverture selon la place disponible a l'ecran (Lot G #5).
  if (rootEl.value) {
    const rect = rootEl.value.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    dropUp.value = spaceBelow < PANEL_HEIGHT && rect.top > spaceBelow
  }
  open.value = true
  query.value = ''
  nextTick(() => searchEl.value?.focus())
}

function close() {
  open.value = false
  query.value = ''
}

function select(id: string) {
  emit('update:modelValue', id)
  close()
}

function clear() {
  emit('update:modelValue', '')
}

onClickOutside(rootEl, close)

watch(() => props.modelValue, () => {
  if (!props.modelValue) query.value = ''
})
</script>
