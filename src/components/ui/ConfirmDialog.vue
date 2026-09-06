<script setup lang="ts">
/**
 * Boîte de dialogue de confirmation globale — une seule instance montée dans
 * App.vue, pilotée par stores/confirmDialog.ts. Remplace tous les
 * window.confirm() natifs de l'app (voir lib/confirm.ts pour l'appel
 * côté consommateur).
 */
import { TriangleAlert } from 'lucide-vue-next'
import ModalShell from './ModalShell.vue'
import * as cls from '../../lib/formClasses'
import { useConfirmDialogStore } from '../../stores/confirmDialog'

const store = useConfirmDialogStore()
</script>

<template>
  <ModalShell :open="store.open" :title="store.title" max-width="max-w-[420px]" @close="store.cancel">
    <div class="flex items-start gap-3">
      <div
        class="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
        :class="store.danger ? 'bg-danger-bg text-danger' : 'bg-info-bg text-info'"
      >
        <TriangleAlert class="w-[18px] h-[18px]" />
      </div>
      <p class="text-[13px] text-foreground leading-relaxed pt-1.5">{{ store.message }}</p>
    </div>
    <template #footer>
      <button :class="store.danger ? cls.btnDestructive : cls.btnPrimary" @click="store.confirm">{{ store.confirmLabel }}</button>
      <button :class="cls.btnOutline" @click="store.cancel">{{ store.cancelLabel }}</button>
    </template>
  </ModalShell>
</template>
