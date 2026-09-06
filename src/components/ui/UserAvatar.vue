<template>
  <div class="inline-flex shrink-0 overflow-hidden rounded-full" :class="SIZES[size ?? 'md']">
    <img v-if="photoUrl" :src="photoUrl" :alt="name" class="w-full h-full object-cover" />
    <span
      v-else
      class="w-full h-full flex items-center justify-center text-white font-bold"
      :style="{ background: bgColor }"
    >
      {{ initials }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  name: string
  size?: 'sm' | 'md' | 'lg'
  photoUrl?: string
}>()

const SIZES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'w-6 h-6 text-[9px]',
  md: 'w-8 h-8 text-[11px]',
  lg: 'w-10 h-10 text-sm',
}

const COLORS = [
  'var(--hv-red)',
  'var(--hv-maroon)',
  'var(--color-info)',
  '#854F0B',
  '#993556',
  '#3C3489',
]

const initials = computed(() =>
  props.name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
)

const bgColor = computed(() => {
  let hash = 0
  for (let i = 0; i < props.name.length; i++) {
    hash = props.name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return COLORS[Math.abs(hash) % COLORS.length]
})
</script>
