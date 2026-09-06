<template>
  <div class="flex flex-col min-w-max">
    <!-- ── Carte du nœud ── -->
    <div class="border border-border rounded-lg bg-card overflow-hidden transition-shadow min-w-[380px] max-w-[560px] hover:shadow-[0_2px_10px_rgba(0,0,0,0.08)]" :style="cardBorder">
      <div class="flex items-center gap-2 px-3 py-2.5">

        <!-- Toggle collapse -->
        <button
          v-if="hasChildren"
          class="w-[22px] h-[22px] border-0 bg-transparent cursor-pointer text-muted-foreground rounded flex items-center justify-center shrink-0 transition-colors hover:bg-background hover:text-foreground"
          @click.stop="toggle"
          :title="isCollapsed ? 'Déplier' : 'Replier'"
        >
          <ChevronRight v-if="isCollapsed" class="w-3.5 h-3.5" />
          <ChevronDown v-else class="w-3.5 h-3.5" />
        </button>
        <div v-else class="w-[22px] shrink-0"></div>

        <!-- Icône type -->
        <div class="w-7 h-7 rounded-md flex items-center justify-center shrink-0" :style="typeColor">
          <component :is="typeIcon" class="w-3.5 h-3.5" />
        </div>

        <!-- Code badge -->
        <span class="text-[10px] font-bold px-[7px] py-0.5 rounded whitespace-nowrap shrink-0 tracking-[0.04em]" :style="typeColor">{{ entity.code }}</span>

        <!-- Nom + responsable -->
        <div class="flex-1 min-w-0">
          <div class="text-[13px] font-semibold text-foreground whitespace-nowrap overflow-hidden text-ellipsis">{{ entity.name }}</div>
          <div class="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5" v-if="entity.responsibleName">
            <User class="w-[11px] h-[11px]" /> {{ entity.responsibleName }}
          </div>
        </div>

        <!-- Méta droite -->
        <div class="flex items-center gap-2 shrink-0">
          <span class="text-[11px] text-muted-foreground flex items-center gap-[3px]">
            <Users class="w-[11px] h-[11px]" /> {{ entity.headcount }}
          </span>
          <span class="text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap" :class="statusClass">{{ statusText }}</span>
        </div>

        <!-- Actions -->
        <div class="flex gap-1 shrink-0">
          <button :class="actBtn" @click.stop="navigateToDetail(entity.id)">
            Voir →
          </button>
          <button
            v-if="entity.status === 'Draft'"
            :class="[actBtn, 'bg-warning-bg text-warning']"
            @click.stop="submitEntity"
          >Soumettre</button>
          <button
            v-if="entity.status === 'PendingApproval'"
            :class="[actBtn, 'bg-success-bg text-success']"
            @click.stop="approveEntity"
          >Approuver</button>
          <router-link
            v-if="entity.status === 'Active'"
            :to="{ name: 'hr-entity-edit', params: { id: entity.id } }"
            :class="actBtn"
          >Modifier</router-link>
        </div>
      </div>
    </div>

    <!-- ── Enfants (récursif) ── -->
    <div v-if="hasChildren && !isCollapsed" class="org-children">
      <div
        v-for="child in entity.children"
        :key="child.id"
        class="org-child"
      >
        <OrgNode :entity="child" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { useRouter } from 'vue-router'
import { ChevronRight, ChevronDown, User, Users, Building, Building2, LayoutGrid, Wrench } from 'lucide-vue-next'
import { useEntityStore } from '../../stores/entities'
import type { Entity } from '../../types'
import type { Ref } from 'vue'

defineOptions({ name: 'OrgNode' })

const props = defineProps<{ entity: Entity }>()

const router         = useRouter()
const store          = useEntityStore()
const collapsedIds   = inject<Ref<string[]>>('entity-collapsed')!
const toggleCollapse = inject<(id: string) => void>('entity-toggle')!
const navigateToDetail = inject<(id: string) => void>(
  'navigate-to-detail',
  (id: string) => router.push({ name: 'hr-entity-detail', params: { id } })
)

const actBtn = 'px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer border-0 whitespace-nowrap no-underline inline-flex items-center bg-background text-muted-foreground transition-colors hover:bg-neutral-bg hover:text-foreground'

const hasChildren = computed(() => (props.entity.children?.length ?? 0) > 0)
const isCollapsed = computed(() => collapsedIds.value.includes(props.entity.id))

function toggle() { toggleCollapse(props.entity.id) }

// ── Type helpers ─────────────────────────────────────────────
const typeIcon = computed(() => {
  const map: Record<string, typeof Building> = {
    Direction:  Building2,
    Department: LayoutGrid,
    Service:    Wrench,
  }
  return map[props.entity.type] ?? Building
})

// Accent bordure gauche selon le niveau (couleurs organigramme HV)
const cardBorder = computed(() => {
  const map: Record<string, string> = {
    Direction:  '4px solid var(--hv-direction-bg)',
    Department: '3px solid var(--hv-department-bg)',
    Service:    '2px solid var(--hv-service-border)',
  }
  return { borderLeft: map[props.entity.type] ?? '2px solid var(--color-border)' }
})

const typeColor = computed(() => {
  const map: Record<string, { background: string; color: string }> = {
    Direction:  { background: 'var(--hv-maroon-light)', color: 'var(--hv-maroon)' },
    Department: { background: 'var(--hv-red-light)',    color: 'var(--hv-red)' },
    Service:    { background: 'var(--hv-red-light)',    color: 'var(--hv-red)' },
  }
  return map[props.entity.type] ?? { background: 'var(--hv-red-light)', color: 'var(--hv-red)' }
})

// ── Status helpers ────────────────────────────────────────────
const statusText = computed(() => {
  const map: Record<string, string> = {
    Draft:           'Brouillon',
    PendingApproval: 'En attente',
    Active:          'Approuvé',
    Inactive:        'Désactivée',
  }
  return map[props.entity.status] ?? props.entity.status
})
const statusClass = computed(() => {
  const map: Record<string, string> = {
    Active:          'bg-success-bg text-success',
    PendingApproval: 'bg-warning-bg text-warning',
    Draft:           'bg-transparent text-foreground/60 border border-border',
    Inactive:        'bg-danger-bg text-danger',
  }
  return map[props.entity.status] ?? 'bg-neutral-bg text-neutral'
})

// ── Actions ───────────────────────────────────────────────────
function submitEntity()  { store.submitEntity(props.entity.id) }
function approveEntity() { store.approveEntity(props.entity.id) }
</script>

<style scoped>
/* Connecteurs d'arbre — pseudo-éléments non exprimables en utilitaires Tailwind */
.org-children {
  margin-left: 32px;
  padding-left: 22px;
  border-left: 2px solid var(--hv-red-mid);
  margin-top: 6px;
  padding-bottom: 2px;
}
.org-child {
  position: relative;
  margin-top: 8px;
}
.org-child::before {
  content: '';
  position: absolute;
  left: -22px;
  top: 22px;
  width: 22px;
  height: 2px;
  background: var(--hv-red-mid);
}
.org-child:last-child::after {
  content: '';
  position: absolute;
  left: -24px;
  top: 23px;
  bottom: -10px;
  width: 4px;
  background: var(--color-card);
}
</style>
