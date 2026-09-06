<template>
  <div class="px-7 py-6">

        <!-- Chargement -->
        <SkeletonLoader v-if="store.loading" type="card" :lines="6" />

        <!-- Entité introuvable -->
        <div v-else-if="!entity" class="flex flex-col items-center gap-3 py-20 text-muted-foreground">
          <TriangleAlert class="w-12 h-12" />
          <p>Entité introuvable.</p>
          <router-link :to="{ name: 'hr-entities' }" :class="L.btnPrimary">Retour à la liste</router-link>
        </div>

        <template v-else>
          <!-- ── Breadcrumb + actions ── -->
          <div class="flex items-start justify-between mb-5 gap-3">
            <div>
              <div class="flex items-center gap-1 text-xs mb-1.5">
                <router-link :to="{ name: 'hr-entities' }" class="text-primary no-underline hover:underline">Entités</router-link>
                <ChevronRight class="w-3 h-3 text-muted-foreground" />
                <span class="text-muted-foreground">{{ entity.name }}</span>
              </div>
              <div class="flex items-center gap-2 flex-wrap">
                <h1 class="text-lg font-bold m-0">{{ entity.name }}</h1>
                <span :class="codeChip">{{ entity.code }}</span>
                <span class="text-[11px] font-medium px-2.5 py-[3px] rounded-full whitespace-nowrap" :class="statusClass">{{ statusLabel }}</span>
              </div>
            </div>
            <div class="flex gap-2 shrink-0 flex-wrap">
              <button :class="L.btnOutline" @click="router.push(navStore.previousEntityRoute)">
                <ArrowLeft class="w-4 h-4" /> Retour
              </button>

              <template v-if="entity.status === 'Draft'">
                <router-link v-if="auth.hasPermission('ENTITE_MODIFIER')" :to="{ name: 'hr-entity-edit', params: { id: entity.id } }" :class="L.btnOutline">
                  <Pencil class="w-4 h-4" /> Modifier
                </router-link>
                <button v-if="auth.hasPermission('ENTITE_SOUMETTRE')" :class="L.btnPrimary" @click="store.submitEntity(entity.id)">
                  <Send class="w-4 h-4" /> Soumettre pour approbation
                </button>
              </template>
              <template v-else-if="entity.status === 'PendingApproval' && auth.hasPermission('ENTITE_APPROUVER')">
                <button :class="btnSuccess" @click="store.approveEntity(entity.id)">
                  <Check class="w-4 h-4" /> Approuver
                </button>
                <button :class="btnDanger" @click="store.rejectEntity(entity.id)">
                  <X class="w-4 h-4" /> Rejeter
                </button>
              </template>
              <template v-else-if="entity.status === 'Active'">
                <router-link v-if="auth.hasPermission('ENTITE_MODIFIER')" :to="{ name: 'hr-entity-edit', params: { id: entity.id } }" :class="L.btnOutline">
                  <Pencil class="w-4 h-4" /> Modifier
                </router-link>
                <button v-if="!isRoot && auth.hasPermission('ENTITE_DESACTIVER')" :class="btnDangerOutline" @click="store.deactivateEntity(entity.id)">
                  <Ban class="w-4 h-4" /> Désactiver
                </button>
              </template>
            </div>
          </div>

          <!-- ── Corps deux colonnes ── -->
          <div class="grid grid-cols-2 gap-3.5 items-start max-lg:grid-cols-1">

            <!-- Colonne gauche -->
            <div class="flex flex-col gap-3.5">

              <!-- Card Informations -->
              <div :class="card">
                <div :class="cardTitle"><Info class="w-[15px] h-[15px] text-primary" /> Informations</div>
                <div class="flex flex-col gap-2">
                  <div :class="infoRow"><span :class="infoLbl">Code</span><span :class="codeChip">{{ entity.code }}</span></div>
                  <div :class="infoRow"><span :class="infoLbl">Type</span><span class="text-[11px] font-medium px-2 py-0.5 rounded-full" :class="typeBadge(entity.type)">{{ typeLabel }}</span></div>
                  <div :class="infoRow" v-if="entity.legalIdentifier"><span :class="infoLbl">Identifiant légal</span><span>{{ entity.legalIdentifier }}</span></div>
                  <div :class="infoRow" v-if="entity.address"><span :class="infoLbl">Adresse</span><span>{{ entity.address }}</span></div>
                  <div :class="infoRow" v-if="entity.phone"><span :class="infoLbl">Téléphone</span><span>{{ entity.phone }}</span></div>
                  <div :class="infoRow" v-if="entity.email">
                    <span :class="infoLbl">Email</span>
                    <a :href="`mailto:${entity.email}`" class="text-info no-underline hover:underline">{{ entity.email }}</a>
                  </div>
                  <div :class="infoRow" v-if="entity.responsibleName">
                    <span :class="infoLbl">Responsable</span>
                    <div class="flex items-center gap-1.5">
                      <div class="w-[22px] h-[22px] rounded-full flex items-center justify-center text-[8px] font-bold bg-primary/10 text-primary">
                        {{ respInitials }}
                      </div>
                      <span>{{ entity.responsibleName }}</span>
                    </div>
                  </div>
                  <div :class="infoRow">
                    <span :class="infoLbl">Effectif rattaché</span>
                    <span class="flex items-center gap-1 font-medium text-foreground"><Users class="w-3.5 h-3.5" /> {{ entity.headcount }} employé{{ entity.headcount > 1 ? 's' : '' }}</span>
                  </div>
                </div>
              </div>

              <!-- Card Entité parente -->
              <div :class="card">
                <div :class="cardTitle"><ArrowUp class="w-[15px] h-[15px] text-primary" /> Entité parente</div>
                <div v-if="parentEntity">
                  <router-link :to="{ name: 'hr-entity-detail', params: { id: parentEntity.id } }" :class="entityLink">
                    <span :class="codeChip">{{ parentEntity.code }}</span>
                    <span>{{ parentEntity.name }}</span>
                    <ArrowRight class="w-3 h-3 ml-auto text-muted-foreground" />
                  </router-link>
                </div>
                <div v-else :class="emptyInfo">Aucune (entité racine)</div>
              </div>

              <!-- Card Sous-entités -->
              <div :class="card">
                <div :class="cardTitle"><ArrowDown class="w-[15px] h-[15px] text-primary" /> Sous-entités ({{ children.length }})</div>
                <div v-if="children.length > 0" class="flex flex-col gap-1.5">
                  <router-link
                    v-for="child in children" :key="child.id"
                    :to="{ name: 'hr-entity-detail', params: { id: child.id } }"
                    :class="entityLink"
                  >
                    <span class="text-[11px] font-medium px-2 py-0.5 rounded-full" :class="typeBadge(child.type)">{{ typeLabelOf(child.type) }}</span>
                    <span :class="codeChip">{{ child.code }}</span>
                    <span>{{ child.name }}</span>
                    <ArrowRight class="w-3 h-3 ml-auto text-muted-foreground" />
                  </router-link>
                </div>
                <div v-else :class="emptyInfo">Aucune sous-entité</div>
              </div>

            </div>

            <!-- Colonne droite -->
            <div class="flex flex-col gap-3.5">

              <!-- Card Pools de validation -->
              <div :class="card">
                <div :class="cardTitle"><ShieldCheck class="w-[15px] h-[15px] text-primary" /> Pools de validation</div>
                <ApprovalPoolConfig :entity-id="entity.id" />
              </div>

              <!-- Card Employés rattachés -->
              <div :class="card">
                <div :class="cardTitle"><Users class="w-[15px] h-[15px] text-primary" /> Employés rattachés</div>
                <div class="text-[13px] font-medium">{{ entity.headcount }} employé{{ entity.headcount > 1 ? 's' : '' }}</div>
                <div class="flex flex-col gap-1.5">
                  <div v-for="emp in unitEmployees.slice(0, 3)" :key="emp.id" class="flex items-center gap-2 py-1.5">
                    <div class="w-[26px] h-[26px] rounded-full flex items-center justify-center text-[9px] font-bold" :style="{ background: emp.avatarBg, color: emp.avatarText }">{{ emp.initials }}</div>
                    <div class="text-[13px]">{{ emp.name }}</div>
                  </div>
                </div>
                <router-link v-if="entity.headcount > 3" :to="{ name: 'hr-employees' }" class="text-xs text-info cursor-pointer mt-1 no-underline hover:underline">
                  Voir tous les {{ entity.headcount }} employés →
                </router-link>
              </div>

              <!-- Card Historique -->
              <div :class="card">
                <div :class="cardTitle"><History class="w-[15px] h-[15px] text-primary" /> Historique</div>
                <div class="flex flex-col gap-3">
                  <div class="flex items-start gap-2.5">
                    <div :class="histIcon"><CirclePlus class="w-3.5 h-3.5" /></div>
                    <div>
                      <div class="text-[11px] text-muted-foreground">Créée le</div>
                      <div class="text-[13px] font-medium">{{ entity.createdAt }}</div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </template>

  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  TriangleAlert, ChevronRight, ArrowLeft, Pencil, Send, Check, X, Ban, Info,
  ArrowUp, ArrowDown, ArrowRight, Users, ShieldCheck, History, CirclePlus,
} from 'lucide-vue-next'
import { SkeletonLoader } from '../../components'
import ApprovalPoolConfig from '../../components/entities/ApprovalPoolConfig.vue'
import * as L from '../../lib/listClasses'
import { useAuthStore }       from '../../stores/auth'
import { useEntityStore }     from '../../stores/entities'
import { useEmployeeStore }   from '../../stores/employees'
import { useNavigationStore } from '../../stores/navigation'
import type { EntityType } from '../../types'

const auth     = useAuthStore()
const store    = useEntityStore()
const empStore = useEmployeeStore()
const navStore = useNavigationStore()
const route    = useRoute()
const router   = useRouter()
if (empStore.employees.length === 0) empStore.fetchAll()

// ── Classes du design system ─────────────────────────────────
const card = 'bg-card border border-border rounded-lg p-4 flex flex-col gap-3'
const cardTitle = 'flex items-center gap-1.5 text-[13px] font-semibold pb-2.5 border-b border-border text-foreground'
const infoRow = 'flex items-center justify-between text-[13px] gap-2'
const infoLbl = 'text-xs text-muted-foreground shrink-0'
const codeChip = 'text-[11px] font-bold px-[7px] py-0.5 rounded bg-primary/10 text-primary tracking-[0.04em]'
const entityLink = 'flex items-center gap-2 px-2.5 py-2 rounded-md bg-background no-underline text-foreground text-[13px] transition-colors hover:bg-primary/10'
const emptyInfo = 'text-xs text-muted-foreground flex items-center gap-1.5'
const histIcon = 'w-7 h-7 rounded-full bg-background text-muted-foreground flex items-center justify-center shrink-0'
const btnSuccess = L.btnOutline + ' !bg-success-bg !text-success !border-success'
const btnDanger = L.btnOutline + ' !bg-danger-bg !text-danger !border-danger'
const btnDangerOutline = L.btnOutline + ' !bg-transparent !text-danger !border-danger'

function typeBadge(type: string): string {
  const m: Record<string, string> = {
    Direction:  'bg-danger-bg text-danger',
    Department: 'bg-success-bg text-success',
    Service:    'bg-primary/10 text-primary',
  }
  return m[type] ?? 'bg-neutral-bg text-neutral'
}

if (store.entities.length === 0) store.fetchAll()

const entityId = computed(() => route.params.id as string)
const entity   = computed(() => store.getEntityById(entityId.value))
// Entité racine (Direction Générale, créée au seed, sans parent) — ne doit
// jamais pouvoir être désactivée ni supprimée (voir aussi
// EntityWorkflowActions.vue, même règle).
const isRoot   = computed(() => entity.value?.parentId == null)
const parent   = computed(() => entity.value?.parentId)
const parentEntity = computed(() => parent.value ? store.getEntityById(parent.value) : undefined)
const children     = computed(() => store.getChildren(entityId.value))
const unitEmployees = computed(() => entity.value ? empStore.getByEntityId(entity.value.id) : [])

// ── Helpers affichage ─────────────────────────────────────────
const typeLabel = computed(() => {
  const map: Record<string, string> = { Direction: 'Direction', Department: 'Département', Service: 'Service' }
  return map[entity.value?.type ?? ''] ?? entity.value?.type ?? ''
})
function typeLabelOf(t: EntityType): string {
  const map: Record<string, string> = { Direction: 'Direction', Department: 'Département', Service: 'Service' }
  return map[t] ?? t
}

const statusLabel = computed(() => {
  const map: Record<string, string> = {
    Draft: 'Brouillon', PendingApproval: 'En attente', Active: 'Approuvé', Inactive: 'Désactivée',
  }
  return map[entity.value?.status ?? ''] ?? ''
})
const statusClass = computed(() => {
  const map: Record<string, string> = {
    Active:          'bg-success-bg text-success',
    PendingApproval: 'bg-warning-bg text-warning',
    Draft:           'bg-transparent text-foreground/60 border border-border',
    Inactive:        'bg-background text-muted-foreground',
  }
  return map[entity.value?.status ?? ''] ?? ''
})

const respInitials = computed(() => {
  const name = entity.value?.responsibleName ?? ''
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase()
  return (parts[0] ?? '?').slice(0, 2).toUpperCase()
})

</script>
