<template>
  <div class="orgchart-wrap">
    <div class="orgchart-toolbar">
      <span class="orgchart-hint">
        <Pointer class="w-3.5 h-3.5" />
        Faites glisser · Molette pour zoomer · Clic sur un nœud pour le détail
      </span>
    </div>

    <div class="orgchart-body">
      <Vue3OrgChart v-if="store.orgChartEntities.length" :data="store.orgChartEntities">
        <template #node="{ item, children, open, toggleChildren }">
          <div
            class="org-node"
            :class="`org-node--${item.type.toLowerCase()}`"
            @click.stop="onNodeClick(item.id)"
          >
            <div class="org-node__code-badge">{{ item.code }}</div>

            <div class="org-node__header">
              <UserAvatar
                v-if="item.responsibleName"
                :name="item.responsibleName"
                size="sm"
              />
              <div class="org-node__info">
                <div class="org-node__name">{{ item.name }}</div>
                <div class="org-node__responsible">{{ item.responsibleName ?? '-' }}</div>
              </div>
            </div>

            <div class="org-node__footer">
              <span class="org-node__headcount">
                <Users class="w-3 h-3 inline-block align-[-1px]" /> {{ item.headcount }}
              </span>
              <StatusPill :status="item.status" />
            </div>

            <button
              v-if="children.length"
              class="org-node__toggle"
              @click.stop="toggleChildren"
            >
              <Minus v-if="open" class="w-2.5 h-2.5" />
              <Plus v-else class="w-2.5 h-2.5" />
            </button>
          </div>
        </template>
      </Vue3OrgChart>

      <div v-else class="orgchart-empty">
        <Network class="w-9 h-9" />
        Aucune entité à afficher
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { inject } from 'vue'
import { useRouter } from 'vue-router'
import { Vue3OrgChart } from 'vue3-org-chart'
import 'vue3-org-chart/dist/style.css'
import { Pointer, Users, Minus, Plus, Network } from 'lucide-vue-next'
import { useEntityStore }     from '../stores/entities'
import { useNavigationStore } from '../stores/navigation'
import UserAvatar from './ui/UserAvatar.vue'
import StatusPill from './ui/StatusPill.vue'

const store   = useEntityStore()
const navStore = useNavigationStore()
const router   = useRouter()

// Quand rendu dans EntityListView, ouvre la fiche en MODAL via le provide ;
// sinon, navigation vers la page de détail (fallback).
const navigateToDetail = inject<((id: string) => void) | null>('navigate-to-detail', null)
function onNodeClick(id: string) {
  if (navigateToDetail) { navigateToDetail(id); return }
  navStore.setPreviousRoute({ name: 'hr-entities', query: { tab: 'orgchart' } })
  router.push({ name: 'hr-entity-detail', params: { id } })
}
</script>

<style scoped>
.orgchart-wrap {
  display: flex;
  flex-direction: column;
  background: var(--color-background);
  border-radius: 8px;
  border: 0.5px solid var(--color-border);
  overflow: hidden;
}

.orgchart-toolbar {
  padding: 8px 14px;
  background: var(--color-card);
  border-bottom: 0.5px solid var(--color-border);
}

.orgchart-hint {
  font-size: 11px;
  color: var(--color-muted-foreground);
  display: flex;
  align-items: center;
  gap: 5px;
}

.orgchart-body {
  min-height: 500px;
}

.orgchart-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  color: var(--color-muted-foreground);
  gap: 10px;
}
.orgchart-empty i { font-size: 36px; }

/* ── Nœud ── */
.org-node {
  position: relative;
  width: 190px;
  border-radius: 10px;
  padding: 10px 12px 14px;
  cursor: pointer;
  transition: transform 0.12s, box-shadow 0.12s;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.10);
  box-sizing: border-box;
}
.org-node:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.14);
}

.org-node--direction {
  background: var(--hv-red);
  color: var(--hv-white);
}
.org-node--department {
  background: #1A8A50;
  color: var(--hv-white);
}
.org-node--service {
  background: var(--color-card);
  color: var(--color-foreground);
  border: 1.5px solid var(--hv-maroon);
}

.org-node__code-badge {
  position: absolute;
  top: 7px;
  right: 9px;
  font-size: 9px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 4px;
  letter-spacing: 0.05em;
  background: rgba(255, 255, 255, 0.22);
  color: inherit;
}
.org-node--service .org-node__code-badge {
  background: var(--hv-maroon-light);
  color: var(--hv-maroon);
}

.org-node__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  padding-right: 28px;
}

.org-node__info { flex: 1; min-width: 0; }
.org-node__name {
  font-size: 12px;
  font-weight: 600;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.org-node__responsible {
  font-size: 10px;
  opacity: 0.75;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.org-node__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.18);
}
.org-node--service .org-node__footer {
  border-top-color: var(--color-border);
}

.org-node__headcount {
  font-size: 10px;
  opacity: 0.8;
  display: flex;
  align-items: center;
  gap: 3px;
}

.org-node__toggle {
  position: absolute;
  bottom: -10px;
  left: 50%;
  transform: translateX(-50%);
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1.5px solid rgba(255, 255, 255, 0.5);
  background: var(--color-card);
  color: var(--color-primary);
  font-size: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
  transition: background 0.12s;
}
.org-node--service .org-node__toggle {
  border-color: var(--hv-maroon);
  color: var(--hv-maroon);
}
.org-node__toggle:hover { background: var(--color-primary-light); }

/* Surcharger les lignes de connexion vue3-org-chart */
:deep(.vue3-org-chart-container) {
  --vue3-org-chart-line-color: var(--hv-red);
}
</style>
