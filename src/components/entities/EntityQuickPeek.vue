<script setup lang="ts">
/**
 * Aperçu rapide d'une entité : panneau fixe à droite, dans le flux de la
 * page (pas un overlay flottant), même convention que
 * ListPageLayout::details-panel (largeur fixe w-[320px]/min-w-[320px],
 * border-l, pas de Teleport). Juste le responsable et les employés
 * rattachés, un bouton pour ouvrir la fiche complète (EntityCard) si
 * besoin de plus. Retour client du 22/09 : au clic sur une entité (arbre
 * ou organigramme), quelque chose de simple d'abord. Retour client du
 * 22/09 (2e passage) : ce panneau ne doit pas recouvrir la barre du haut
 * ni flotter par-dessus la page, il doit créer son propre espace en
 * rétrécissant le contenu à côté de lui, d'où le placement en flux
 * (flex) chez l'appelant plutôt qu'un Teleport ici. Retour client du
 * 22/09 (3e passage) : le bouton "fiche complète" doit être accessible en
 * haut, pas en bas (une longue liste d'employés le rendrait inatteignable
 * sans défiler tout le panneau), et la hauteur du panneau ne doit jamais
 * dépasser celle de l'organigramme à côté, quel que soit le nombre
 * d'employés. Retour client du 22/09 (4e passage) : le plafond de hauteur
 * passait inaperçu (rien ne montre visuellement où la liste s'arrête).
 * Fix : la liste est dans un encadré (border + coins arrondis), pour que
 * la limite soit visible. Retour client du 22/09 (5e passage) : l'en-tête
 * en deux bandes séparées n'était pas demandé, retour à l'en-tête
 * d'origine. Retour client du 23/09 (1er passage) : plafonner uniquement
 * la liste des employés ne suffit pas, l'en-tête + responsable + liste
 * plafonnée dépassaient quand même un panneau voisin court (ex. vue arbre
 * avec peu d'entités). Fix initial : tout le corps défile comme un seul
 * bloc sous l'en-tête, avec un plafond de hauteur fixe (max-h-[500px]).
 * Retour client du 23/09 (2e passage) : ce plafond fixe ne "prend" pas
 * vraiment la hauteur du bloc voisin, il devine une valeur qui colle
 * aujourd'hui par coïncidence (l'organigramme a aussi un min-height de
 * 500px) mais désynchronise dès que ce bloc change (vue arbre courte,
 * organigramme profond...). Fix : la hauteur exacte du bloc de gauche est
 * mesurée en direct (useElementSize, voir EntityTabsContent.vue /
 * EntityListView.vue) et posée en style inline sur ce panneau ; plus de
 * valeur devinée, le corps défile toujours comme un bloc sous l'en-tête,
 * dans cette hauteur mesurée.
 */
import { computed } from 'vue'
import { X, Users, UserRoundCog, ArrowRight } from 'lucide-vue-next'
import { useEntityStore } from '../../stores/entities'
import { useEmployeeStore } from '../../stores/employees'
import UserAvatar from '../ui/UserAvatar.vue'

const props = defineProps<{ entityId: string }>()
const emit = defineEmits<{ close: []; 'view-full': [id: string] }>()

const entityStore = useEntityStore()
const employeeStore = useEmployeeStore()

const entity = computed(() => entityStore.getEntityById(props.entityId))
const responsible = computed(() => (entity.value?.managerId ? employeeStore.getById(entity.value.managerId) : undefined))
const employees = computed(() => employeeStore.getByEntityId(props.entityId))

const TYPE_LABELS: Record<string, string> = { Direction: 'Direction', Department: 'Département', Service: 'Service' }
const TYPE_BADGE: Record<string, string> = { Direction: 'bg-danger-bg text-danger', Department: 'bg-success-bg text-success', Service: 'bg-tint text-primary' }

function viewFull() {
  if (entity.value) emit('view-full', entity.value.id)
}
</script>

<template>
  <div v-if="entity" class="bg-card overflow-hidden flex flex-col h-full">
    <!-- En-tête : badge + actions sur une ligne, nom + type en dessous -->
    <div class="px-3.5 py-3 border-b border-border shrink-0">
      <div class="flex items-center justify-between gap-2 mb-2">
        <span class="text-[10px] font-bold px-[7px] py-0.5 rounded tracking-[0.04em]" :class="TYPE_BADGE[entity.type] ?? 'bg-neutral-bg text-neutral'">{{ entity.code }}</span>
        <div class="flex items-center gap-1 shrink-0">
          <button
            class="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            title="Voir la fiche complète"
            @click="viewFull"
          >
            Fiche complète <ArrowRight class="w-3 h-3" />
          </button>
          <button class="w-6 h-6 flex items-center justify-center rounded-md bg-transparent border-0 cursor-pointer text-muted-foreground hover:bg-background hover:text-foreground transition-colors" title="Fermer" @click="emit('close')">
            <X class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div class="text-[14px] font-semibold text-foreground truncate">{{ entity.name }}</div>
      <div class="text-[11px] text-muted-foreground mt-0.5">{{ TYPE_LABELS[entity.type] ?? entity.type }}</div>
    </div>

    <!-- Corps : défile comme un seul bloc (en-tête au-dessus reste fixe) -->
    <div class="flex-1 min-h-0 px-3.5 py-3.5 flex flex-col gap-4 overflow-y-auto">
      <!-- Responsable -->
      <div class="shrink-0">
        <div class="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.04em] mb-2 flex items-center gap-1.5">
          <UserRoundCog class="w-3.5 h-3.5" /> Responsable
        </div>
        <div v-if="responsible" class="flex items-center gap-2.5 px-2.5 py-2 bg-background rounded-lg">
          <UserAvatar :name="responsible.name" size="sm" />
          <div class="min-w-0">
            <div class="text-[13px] font-medium text-foreground truncate">{{ responsible.name }}</div>
            <div class="text-[11px] text-muted-foreground truncate">{{ responsible.jobTitle || '-' }}</div>
          </div>
        </div>
        <p v-else class="text-[12px] text-muted-foreground">Aucun responsable désigné.</p>
      </div>

      <!-- Employés : encadré, comme un bloc distinct -->
      <div class="shrink-0">
        <div class="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.04em] mb-2 flex items-center gap-1.5">
          <Users class="w-3.5 h-3.5" /> Employés ({{ employees.length }})
        </div>
        <div v-if="employees.length" class="bg-background border border-border rounded-lg">
          <div v-for="(emp, i) in employees" :key="emp.id" class="flex items-center gap-2.5 px-2.5 py-2" :class="i !== employees.length - 1 && 'border-b border-border'">
            <UserAvatar :name="emp.name" size="sm" />
            <div class="min-w-0">
              <div class="text-[13px] font-medium text-foreground truncate">{{ emp.name }}</div>
              <div class="text-[11px] text-muted-foreground truncate">{{ emp.jobTitle || '-' }}</div>
            </div>
          </div>
        </div>
        <p v-else class="text-[12px] text-muted-foreground">Aucun employé rattaché directement à cette entité.</p>
      </div>
    </div>
  </div>
</template>
