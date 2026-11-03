<template>
  <div :class="L.pagination">
    <span class="whitespace-nowrap">{{ total }} résultat{{ total > 1 ? 's' : '' }}, page {{ page }} / {{ totalPages }}</span>
    <div class="flex-1"></div>
    <label class="flex items-center gap-1.5 whitespace-nowrap">
      Par page
      <select :value="pageSize" :class="L.pagSizeSelect" @change="emit('update:pageSize', Number(($event.target as HTMLSelectElement).value))">
        <option v-for="n in [10, 25, 50]" :key="n" :value="n">{{ n }}</option>
      </select>
    </label>
    <div class="flex items-center gap-[3px]">
      <button :class="L.pagBtn" :disabled="page <= 1" @click="emit('update:page', page - 1)"><ChevronLeft class="w-3 h-3" /></button>
      <button
        v-for="p in visiblePages" :key="p"
        :class="[L.pagBtn, p === page && L.pagBtnActive]"
        @click="emit('update:page', p)"
      >{{ p }}</button>
      <button :class="L.pagBtn" :disabled="page >= totalPages" @click="emit('update:page', page + 1)"><ChevronRight class="w-3 h-3" /></button>
    </div>
  </div>
</template>

<script setup lang="ts">
/** Pied de tableau commun aux ecrans du module Temps : pagination serveur. */
import { computed } from 'vue'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import * as L from '../../lib/listClasses'

const props = defineProps<{ page: number; pageSize: number; total: number }>()
const emit = defineEmits<{ 'update:page': [number]; 'update:pageSize': [number] }>()

const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
// Fenetre de 5 pages autour de la page courante (evite 200 boutons).
const visiblePages = computed(() => {
  const start = Math.max(1, Math.min(props.page - 2, totalPages.value - 4))
  const end = Math.min(totalPages.value, start + 4)
  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
})
</script>
