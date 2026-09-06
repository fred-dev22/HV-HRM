<script lang="ts" setup>
/**
 * Adapté du OptionsSelect du frontdesk : les options viennent d'une prop
 * (le HRM n'a pas le optionsStore alimenté par Business Central).
 * Mêmes classes visuelles que l'original.
 */
import { computed } from 'vue'
import { Lock } from 'lucide-vue-next'

export interface SelectOption {
  value: string | number
  label: string
}

const props = withDefaults(defineProps<{
  modelValue?: string | number
  options: SelectOption[]
  disabled?: boolean
  invalid?: boolean
  /** When true, shows a lock icon inside the select at the right (trailing). */
  showLockIcon?: boolean
}>(), {
  modelValue: '',
  disabled: false,
  invalid: false,
  showLockIcon: false
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
}>()

const selectClass = computed(() => [
  'w-full h-9 min-h-0 min-w-0 px-3 py-1.5 border rounded text-sm text-card-foreground focus:outline-none',
  props.invalid ? 'border-destructive focus:border-destructive' : 'border-border focus:border-primary',
  props.disabled ? 'bg-muted/30 cursor-not-allowed opacity-70' : 'bg-card',
  props.showLockIcon && 'pr-8'
])

const onInput = (e: Event) => {
  const target = e.target as HTMLSelectElement
  const raw = target.value
  const match = props.options.find(o => String(o.value) === raw)
  emit('update:modelValue', match ? match.value : raw)
}
</script>

<template>
  <div class="relative w-full min-w-0">
    <select
      :value="modelValue"
      :disabled="disabled"
      :class="selectClass"
      @change="onInput"
    >
      <option v-for="opt in options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
    </select>
    <Lock
      v-if="showLockIcon"
      class="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
    />
  </div>
</template>
