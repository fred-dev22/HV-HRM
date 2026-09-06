<script setup lang="ts">
import { computed } from 'vue'
import { Lock } from 'lucide-vue-next'
import { cn } from '@/lib/utils'

export interface FormInputProps {
  type?: 'text' | 'number' | 'email' | 'tel' | 'url' | 'search'
  modelValue?: string | number
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  id?: string
  class?: string
  /** When true, shows a lock icon inside the input at the right (trailing). */
  showLockIcon?: boolean
  /** HTML maxlength (character limit). */
  maxlength?: number
}

const props = withDefaults(defineProps<FormInputProps>(), {
  type: 'text',
  disabled: false,
  invalid: false,
  showLockIcon: false
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
}>()

const inputClass = computed(() =>
  cn(
    'w-full h-9 min-w-0 px-3 py-1.5 border rounded text-sm text-card-foreground focus:outline-none',
    props.invalid
      ? 'border-destructive focus:border-destructive'
      : 'border-border focus:border-primary',
    props.disabled ? 'bg-muted/30 cursor-not-allowed' : 'bg-card',
    props.showLockIcon && 'pr-8',
    props.class
  )
)

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement
  const value = props.type === 'number' ? (target.value === '' ? 0 : Number(target.value)) : target.value
  emit('update:modelValue', value)
}
</script>

<template>
  <div class="relative w-full min-w-0">
    <input
      :class="inputClass"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :id="id"
      :maxlength="maxlength"
      @input="handleInput"
    />
    <Lock
      v-if="showLockIcon"
      class="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
    />
  </div>
</template>
