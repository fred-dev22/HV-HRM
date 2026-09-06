<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0 translate-y-4"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-4"
    >
      <div
        v-if="toast.visible"
        class="fixed bottom-6 right-6 z-[1100] flex items-center gap-2.5 rounded-lg px-4 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.2)] text-[13px] font-medium max-w-[340px]"
        :class="toast.status === 'error' ? 'bg-destructive text-destructive-foreground' : toast.status === 'success' ? 'bg-success text-white' : 'bg-primary text-primary-foreground'"
        role="status"
        aria-live="polite"
      >
        <Loader2 v-if="toast.status === 'loading'" class="w-4 h-4 shrink-0 animate-spin" />
        <CircleCheck v-else-if="toast.status === 'success'" class="w-4 h-4 shrink-0" />
        <CircleAlert v-else class="w-4 h-4 shrink-0" />
        <span>{{ toast.message }}</span>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { Loader2, CircleCheck, CircleAlert } from 'lucide-vue-next'
import { useToastStore } from '../../stores/toast'

const toast = useToastStore()
</script>
