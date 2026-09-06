<script setup lang="ts">
/**
 * Section de formulaire repliable (pattern frontdesk : Lead Card / Customer Card).
 * En-tête = chevron + titre + soulignage primaire. Une fois repliée, affiche des
 * petits récapitulatifs (chips) à droite. Le contenu (champs) est dans le slot
 * par défaut ; les récaps via la prop `recaps` ou le slot `#recap`.
 */
import { ref } from 'vue'
import { ChevronRight } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    title: string
    /** Valeurs récap affichées en chips quand la section est repliée (les valeurs nulles/vides sont ignorées) */
    recaps?: (string | number | null | undefined)[]
    /** Section ouverte par défaut */
    defaultOpen?: boolean
  }>(),
  { recaps: () => [], defaultOpen: true },
)

const open = ref(props.defaultOpen)
</script>

<template>
  <div class="mb-3">
    <button
      type="button"
      class="w-full flex items-center gap-2 pb-2 border-b-2 border-primary text-left cursor-pointer"
      :aria-expanded="open"
      @click="open = !open"
    >
      <ChevronRight class="w-4 h-4 text-foreground transition-transform shrink-0" :class="{ 'rotate-90': open }" />
      <h2 class="text-base font-bold text-foreground whitespace-nowrap">{{ title }}</h2>
      <div v-if="!open" class="ml-auto flex items-center gap-1.5 flex-wrap justify-end min-w-0 overflow-hidden">
        <slot name="recap">
          <span
            v-for="(r, i) in recaps.filter(v => v !== '' && v != null)"
            :key="i"
            class="bg-background border border-border rounded px-2.5 py-1 text-[12px] text-muted-foreground max-w-[220px] truncate"
          >{{ r }}</span>
        </slot>
      </div>
    </button>
    <div v-show="open" class="pt-4 pb-3">
      <slot />
    </div>
  </div>
</template>
