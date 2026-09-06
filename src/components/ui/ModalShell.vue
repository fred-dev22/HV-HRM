<script setup lang="ts">
/**
 * Shell générique pour les modales centrées du HRM.
 * Langage visuel aligné sur les shells du frontdesk (CardModalShell /
 * CreateModalShell) : backdrop sombre flouté, fermeture Escape/backdrop,
 * en-tête titre + bouton X, pied de page bordé pour les actions.
 */
import { onMounted, onUnmounted } from 'vue'
import { X } from 'lucide-vue-next'

withDefaults(defineProps<{
  open: boolean
  title: string
  /** Largeur max de la carte (classe Tailwind), ex: 'max-w-[560px]' */
  maxWidth?: string
}>(), {
  maxWidth: 'max-w-[560px]',
})

const emit = defineEmits<{
  close: []
}>()

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') emit('close')
}
onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[1000]"
      @click.self="emit('close')"
    >
      <div
        class="relative bg-card text-card-foreground rounded-xl p-7 max-sm:p-5 w-[90%] shadow-[0_8px_32px_rgba(0,0,0,0.16)] flex flex-col max-h-[92vh] overflow-y-auto"
        :class="maxWidth"
      >
        <!-- En-tête -->
        <div class="flex items-center justify-between mb-5">
          <span class="text-[15px] font-semibold text-foreground">{{ title }}</span>
          <div class="flex items-center gap-2">
            <slot name="header-extra" />
            <button
              class="w-7 h-7 bg-background rounded-md cursor-pointer flex items-center justify-center text-muted-foreground shrink-0 transition-colors hover:bg-border hover:text-foreground"
              @click="emit('close')"
            >
              <X class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- Corps -->
        <div class="flex flex-col gap-3.5">
          <slot />
        </div>

        <!-- Pied -->
        <div
          v-if="$slots.footer"
          class="flex gap-2 justify-end mt-5 pt-4 border-t border-border max-sm:flex-col-reverse"
        >
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>
