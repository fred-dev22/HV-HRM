<template>
  <div class="flex flex-col items-center justify-center min-h-[400px] text-center text-muted-foreground">
    <Wrench class="w-12 h-12 mb-4 text-border" />
    <h2 class="text-lg font-semibold text-foreground mb-2">{{ title }}</h2>
    <p class="text-[13px] mb-1">Ce module est en cours de développement.</p>
    <p class="text-[13px]">Il sera disponible prochainement.</p>
  </div>
</template>

<script setup lang="ts">
import { Wrench } from 'lucide-vue-next'
defineProps<{ title: string }>()
</script>
