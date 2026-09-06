<template>
  <div class="orgchart-wrap">
    <div class="orgchart-scroll">
      <div v-for="root in tree" :key="root.id" style="display:inline-flex">
        <OrgChartNode :node="root" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, defineComponent, h } from 'vue'
import type { PropType } from 'vue'
import { useRouter } from 'vue-router'
import { User, Users, Plus, Minus } from 'lucide-vue-next'
import type { Entity } from '../types'

const props = defineProps<{ entities: Entity[] }>()
const router = useRouter()

type TreeNode = Entity & { children: TreeNode[] }

function buildTree(list: Entity[], parentId: string | null): TreeNode[] {
  return list
    .filter(e => e.parentId === parentId)
    .map(e => ({ ...e, children: buildTree(list, e.id) }))
}

const tree = computed(() => buildTree(props.entities, null))

const collapsed = ref(new Set<string>())

function toggle(id: string) {
  const s = new Set(collapsed.value)
  if (s.has(id)) s.delete(id); else s.add(id)
  collapsed.value = s
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const OrgChartNode: any = defineComponent({
  name: 'OrgChartNode',
  props: { node: { type: Object as PropType<TreeNode>, required: true } },
  setup(nodeProps) {
    return () => {
      const node = nodeProps.node
      const hasChildren = node.children.length > 0
      const isCollapsed = collapsed.value.has(node.id)

      const isService = node.type === 'Service'
      const isDept    = node.type === 'Department'

      const cardStyle: Record<string, string> = isService
        ? { background: 'var(--hv-maroon-light)', color: 'var(--hv-maroon)', border: '1px solid rgba(122,31,31,0.3)' }
        : isDept
          ? { background: 'var(--hv-red-dark)', color: 'white' }
          : { background: 'var(--hv-red)', color: 'white' }

      const badgeStyle: Record<string, string> = isService
        ? { background: 'rgba(122,31,31,0.12)', color: 'var(--hv-maroon)' }
        : { background: 'rgba(255,255,255,0.18)', color: 'white' }

      const metaStyle: Record<string, string> = {
        fontSize: '11px', opacity: '0.82',
        display: 'flex', alignItems: 'center',
        gap: '3px', whiteSpace: 'nowrap',
        overflow: 'hidden', textOverflow: 'ellipsis',
        marginTop: '2px',
      }

      const cardContent = [
        h('div', { style: { marginBottom: '5px' } }, [
          h('span', {
            style: {
              ...badgeStyle,
              fontSize: '10px', fontWeight: '700',
              padding: '2px 6px', borderRadius: '4px',
              display: 'inline-block',
            }
          }, node.code)
        ]),
        h('div', {
          style: {
            fontSize: '12px', fontWeight: '600', lineHeight: '1.3',
            overflow: 'hidden', display: '-webkit-box',
            WebkitLineClamp: '2', WebkitBoxOrient: 'vertical',
            marginBottom: '3px',
          }
        }, node.name),
        node.responsibleName
          ? h('div', { style: metaStyle }, [
              h(User, { size: 11, 'aria-hidden': 'true' }),
              ` ${node.responsibleName}`
            ])
          : null,
        h('div', { style: metaStyle }, [
          h(Users, { size: 11, 'aria-hidden': 'true' }),
          ` ${node.headcount}`
        ]),
        hasChildren
          ? h('button', {
              class: 'oct-toggle',
              style: {
                position: 'absolute', bottom: '-9px', left: '50%',
                transform: 'translateX(-50%)',
                width: '18px', height: '18px', borderRadius: '50%',
                border: `1px solid ${isService ? 'var(--hv-maroon)' : 'rgba(255,255,255,0.6)'}`,
                background: 'white',
                color: isService ? 'var(--hv-maroon)' : 'var(--hv-red)',
                fontSize: '10px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: '10', padding: '0', lineHeight: '1',
                boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
              },
              onClick: (e: MouseEvent) => { e.stopPropagation(); toggle(node.id) }
            }, [h(isCollapsed ? Plus : Minus, { size: 12, 'aria-hidden': 'true' })])
          : null,
      ].filter(Boolean)

      return h('div', { class: 'oct-node-wrap' }, [
        h('div', {
          style: {
            ...cardStyle,
            width: '180px', minHeight: '80px',
            borderRadius: '8px', padding: '10px 12px',
            position: 'relative', cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
            transition: 'box-shadow 0.15s', boxSizing: 'border-box',
          },
          class: `oct-card oct-card--${node.type}`,
          onClick: () => router.push({ name: 'hr-entity-detail', params: { id: node.id } })
        }, cardContent),

        hasChildren && !isCollapsed
          ? h('div', { class: 'oct-children-wrap' }, [
              h('div', { class: 'oct-v-line' }),
              h('div', { class: 'oct-children' },
                node.children.map(child =>
                  h('div', { class: 'oct-child-col', key: child.id }, [
                    h(OrgChartNode, { node: child })
                  ])
                )
              )
            ])
          : null
      ])
    }
  }
})
</script>

<style>
/* ── OrgChartTree — styles non-scopés avec préfixe oct- ── */

.orgchart-wrap {
  overflow: auto;
  background: var(--color-background);
  min-height: 420px;
  border-radius: 8px;
  border: 0.5px solid var(--color-border);
}

.orgchart-scroll {
  padding: 40px 20px 60px;
  display: flex;
  justify-content: center;
  gap: 40px;
  min-width: max-content;
}

/* Nœud wrapper — flex colonne centré */
.oct-node-wrap {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
}

/* Hover carte */
.oct-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.16) !important;
}

/* Zone enfants (ligne V + ligne H + colonnes) */
.oct-children-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* Ligne verticale du nœud parent vers la ligne horizontale */
.oct-v-line {
  width: 1px;
  height: 20px;
  background: var(--color-tree-line);
}

/* Rangée d'enfants */
.oct-children {
  display: flex;
  align-items: flex-start;
  gap: 20px;
}

/* Colonne enfant — espace pour les connecteurs */
.oct-child-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  padding-top: 20px;
}

/* Segment horizontal de la ligne connectrice */
.oct-child-col::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--color-tree-line);
}
.oct-child-col:first-child::before { left: 50%; }
.oct-child-col:last-child::before  { right: 50%; }
.oct-child-col:only-child::before  { display: none; }

/* Ligne verticale de la ligne H vers l'enfant */
.oct-child-col::after {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 1px;
  height: 20px;
  background: var(--color-tree-line);
}
</style>
