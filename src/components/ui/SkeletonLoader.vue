<script setup lang="ts">
// Squelette de chargement générique, calqué sur les tokens du design system
// (bg-card/border-border/rounded-lg, mêmes paddings que ListPageLayout/
// DashboardHR). `lines` contrôle la répétition (lignes de liste, champs de
// formulaire…), `type` la forme approximative du contenu attendu.
withDefaults(
  defineProps<{
    lines?: number
    type?: 'list' | 'card' | 'table' | 'form'
  }>(),
  { lines: 5, type: 'list' },
)
</script>

<template>
  <div class="animate-pulse" role="status" aria-busy="true" aria-label="Chargement en cours">
    <!-- Liste : lignes façon carte (icône + 2 barres) -->
    <div v-if="type === 'list'" class="space-y-2">
      <div v-for="i in lines" :key="i" class="flex items-center gap-3 bg-card border border-border rounded-lg px-3.5 py-3">
        <div class="w-9 h-9 rounded-lg bg-muted shrink-0"></div>
        <div class="flex-1 space-y-1.5">
          <div class="h-3 bg-muted rounded" style="width: 40%"></div>
          <div class="h-2.5 bg-muted rounded" style="width: 60%"></div>
        </div>
      </div>
    </div>

    <!-- Tableau : en-tête + lignes de cellules -->
    <div v-else-if="type === 'table'" class="bg-card border border-border rounded-lg overflow-hidden">
      <div class="flex items-center gap-4 px-3.5 py-2.5 border-b border-border bg-background">
        <div v-for="i in 5" :key="i" class="h-2.5 bg-muted rounded flex-1"></div>
      </div>
      <div v-for="row in lines" :key="row" class="flex items-center gap-4 px-3.5 py-3 border-b border-border last:border-0">
        <div v-for="col in 5" :key="col" class="h-3 bg-muted rounded flex-1"></div>
      </div>
    </div>

    <!-- Carte / profil : avatar + titre + lignes de détail -->
    <div v-else-if="type === 'card'" class="bg-card border border-border rounded-lg p-3.5 space-y-4">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-full bg-muted shrink-0"></div>
        <div class="flex-1 space-y-1.5">
          <div class="h-3.5 bg-muted rounded" style="width: 45%"></div>
          <div class="h-2.5 bg-muted rounded" style="width: 30%"></div>
        </div>
      </div>
      <div class="space-y-2">
        <div v-for="i in lines" :key="i" class="h-2.5 bg-muted rounded" :style="{ width: i % 2 === 0 ? '55%' : '90%' }"></div>
      </div>
    </div>

    <!-- Formulaire : paires libellé + champ -->
    <div v-else class="space-y-3.5">
      <div v-for="i in lines" :key="i" class="space-y-1.5">
        <div class="h-2.5 bg-muted rounded" style="width: 25%"></div>
        <div class="h-9 bg-muted rounded-lg w-full"></div>
      </div>
    </div>
  </div>
</template>
