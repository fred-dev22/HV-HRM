<template>
  <label class="relative inline-flex items-center shrink-0" :class="disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'">
    <input
      type="checkbox"
      class="sr-only peer"
      :checked="modelValue"
      :disabled="disabled"
      @change="emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
    />
    <span class="w-9 h-5 rounded-full bg-foreground/20 transition-colors peer-checked:bg-primary relative after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:w-3.5 after:h-3.5 after:bg-white after:rounded-full after:shadow after:transition-all peer-checked:after:left-[19px]"></span>
  </label>
</template>

<script setup lang="ts">
/** Interrupteur oui / non, meme rendu que dans Calendrier > Types de conges. */
defineProps<{ modelValue: boolean; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
</script>
