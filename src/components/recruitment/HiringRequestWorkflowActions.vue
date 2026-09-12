<script setup lang="ts">
/**
 * Actions d'une expression de besoin. Aucun circuit de validation (décision
 * client du 05/09) : Brouillon -> Exprimé -> Clôturé | Annulé.
 * - "Exprimer le besoin" / "Annuler" / "Supprimer" : permission BESOIN_EXPRIMER
 *   (ou l'accès module).
 * - "Clôturer" : réservé au module Recrutement (RECRUTEMENT_ACCES).
 */
import { Send, Ban, Trash2, Archive } from 'lucide-vue-next'
import { confirmDialog } from '../../lib/confirm'
import { withToast } from '../../lib/withToast'
import { useSubmitGuard } from '../../lib/submitGuard'
import { useHiringRequestStore } from '../../stores/recruitment'
import type { HiringRequest } from '../../stores/recruitment'
import { useAuthStore } from '../../stores/auth'

const props = defineProps<{ item: HiringRequest }>()
const store = useHiringRequestStore()
const auth = useAuthStore()

const canExpress = auth.hasAnyPermission(['RECRUTEMENT_BESOIN_EXPRIMER', 'RECRUTEMENT_ACCES'])
const canManage = auth.hasPermission('RECRUTEMENT_ACCES')

const btn = 'px-2.5 py-[5px] rounded text-xs font-medium cursor-pointer whitespace-nowrap inline-flex items-center gap-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
const primaryCls = btn + ' bg-success-bg text-success hover:brightness-95'
const closeCls   = btn + ' bg-info-bg text-info hover:brightness-95'
const cancelCls  = btn + ' bg-neutral-bg text-neutral hover:brightness-95'
const deleteCls  = btn + ' bg-danger-bg text-danger hover:brightness-95'

const { submitting: expressing, guard: guardExpress } = useSubmitGuard()
async function express() {
  await guardExpress(() => withToast('Envoi…', () => store.submit(props.item.id), () => "Impossible d'exprimer le besoin"))
}
async function close() {
  if (await confirmDialog('Clôturer cette expression de besoin ?', { danger: false })) {
    await withToast('Clôture…', () => store.close(props.item.id), () => 'Clôture impossible')
  }
}
async function cancel() {
  if (await confirmDialog('Annuler cette expression de besoin ?', { danger: false })) {
    await withToast('Annulation…', () => store.cancel(props.item.id), () => 'Annulation impossible')
  }
}
async function remove() {
  if (await confirmDialog('Supprimer définitivement ce brouillon ?')) {
    await withToast('Suppression…', () => store.remove(props.item.id), () => 'Suppression impossible')
  }
}
</script>

<template>
  <div class="flex items-center gap-1.5 flex-wrap">
    <button v-if="item.status === 'Draft' && canExpress" :class="primaryCls" :disabled="expressing" @click="express">
      <Send class="w-3.5 h-3.5" /> Exprimer le besoin
    </button>
    <button v-if="item.status === 'Open' && canManage" :class="closeCls" @click="close">
      <Archive class="w-3.5 h-3.5" /> Clôturer
    </button>
    <button v-if="['Draft', 'Open'].includes(item.status) && canExpress" :class="cancelCls" @click="cancel">
      <Ban class="w-3.5 h-3.5" /> Annuler
    </button>
    <button v-if="['Draft', 'Cancelled'].includes(item.status) && canExpress" :class="deleteCls" @click="remove">
      <Trash2 class="w-3.5 h-3.5" /> Supprimer
    </button>
    <span
      v-if="(item.status === 'Closed') || (!canExpress && !canManage)"
      class="text-xs text-muted-foreground italic"
    >Aucune action disponible</span>
  </div>
</template>
