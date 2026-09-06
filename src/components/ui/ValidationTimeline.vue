<template>
  <div class="flex flex-col py-1">
    <div
      v-for="(s, i) in history"
      :key="i"
      class="flex items-start gap-3 relative pb-4 last:pb-0"
    >
      <!-- Connecteur vertical -->
      <div v-if="i < history.length - 1" class="absolute left-[11px] top-6 w-0.5 h-[calc(100%-8px)] bg-border z-0"></div>

      <!-- Dot -->
      <div class="w-6 h-6 rounded-full flex items-center justify-center shrink-0 relative z-[1] border-2 border-current" :class="dotColor(s.action)">
        <component :is="dotIcon(s.action)" class="w-3 h-3" />
      </div>

      <!-- Contenu -->
      <div class="flex flex-col gap-1 pt-0.5 flex-1">
        <div class="flex items-center gap-2 flex-wrap">
          <UserAvatar :name="s.actorName" size="sm" />
          <span class="text-[13px] font-semibold text-foreground">{{ s.actorName }}</span>
          <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-neutral-bg text-neutral whitespace-nowrap">{{ levelLabel(s.level) }}</span>
          <span v-if="s.date" class="text-[11px] text-muted-foreground ml-auto whitespace-nowrap">{{ formatDate(s.date) }}</span>
        </div>
        <div class="text-xs" :class="actionColor(s.action)">{{ actionLabel(s.action) }}</div>
        <div v-if="s.comment" class="text-xs text-muted-foreground italic bg-background border-l-2 border-border px-2 py-1 rounded-r">"{{ s.comment }}"</div>
        <div v-if="s.action === 'pending'" class="text-[11px] text-neutral flex items-center gap-1 italic">
          <MoreHorizontal class="w-3.5 h-3.5" /> En attente de validation...
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Send, Check, X, CornerUpLeft, Clock, Circle, MoreHorizontal } from 'lucide-vue-next'
import UserAvatar from './UserAvatar.vue'
import type { ValidationStep } from '../../types'

defineProps<{ history: ValidationStep[] }>()

function dotIcon(action: ValidationStep['action']) {
  const m: Record<ValidationStep['action'], typeof Send> = {
    submitted: Send,
    approved:  Check,
    rejected:  X,
    returned:  CornerUpLeft,
    pending:   Clock,
  }
  return m[action] ?? Circle
}

function dotColor(action: ValidationStep['action']): string {
  const m: Record<string, string> = {
    submitted: 'text-info bg-info-bg',
    approved:  'text-success bg-success-bg',
    rejected:  'text-danger bg-danger-bg',
    returned:  'text-warning bg-warning-bg',
    pending:   'text-neutral bg-neutral-bg',
  }
  return m[action] ?? 'text-neutral bg-neutral-bg'
}

function actionColor(action: ValidationStep['action']): string {
  const m: Record<string, string> = {
    approved:  'text-success font-medium',
    rejected:  'text-danger font-medium',
    returned:  'text-warning font-medium',
    submitted: 'text-info font-medium',
    pending:   'text-muted-foreground',
  }
  return m[action] ?? 'text-muted-foreground'
}

function actionLabel(action: ValidationStep['action']): string {
  const m: Record<ValidationStep['action'], string> = {
    submitted: 'Demande soumise',
    approved:  'Validé',
    rejected:  'Refusé',
    returned:  'Retourné pour corrections',
    pending:   'En attente',
  }
  return m[action] ?? action
}

function levelLabel(level: ValidationStep['level']): string {
  const m: Record<ValidationStep['level'], string> = {
    employee: 'Demandeur',
    n1:       'Validateur N+1',
    n2:       'Validateur N+2',
    n3:       'Validateur N+3',
    n4:       'Validateur N+4',
    rh:       'RH',
    system:   'Système',
  }
  return m[level] ?? level
}

function formatDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
</script>
