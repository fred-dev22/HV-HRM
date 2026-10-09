<template>
  <div>
    <!-- Deux listes, chacune masquee quand elle est vide : (1) l'entite que l'on
         dirige, avec une marque sur ceux dont on valide aussi les demandes ;
         (2) les employes d'AUTRES entites dont on valide les demandes
         (validateur direct, ou membre du pool d'approbation de leur entite). -->
    <TeamMembersList
      v-if="ownEntity.length > 0"
      mode="entity"
      title="Mon équipe"
      subtitle="Les employés de l'entité que vous dirigez"
      :employees="ownEntity"
      :links="employeeStore.collaboratorLinks"
    />
    <TeamMembersList
      v-if="validatedOnly.length > 0"
      mode="validated"
      title="Autres employés dont je valide les demandes"
      subtitle="Validateur direct, ou membre du pool d'approbation de leur entité"
      :employees="validatedOnly"
      :links="employeeStore.collaboratorLinks"
    />
    <div v-if="ownEntity.length === 0 && validatedOnly.length === 0 && !employeeStore.loading" class="px-7 py-6 text-[13px] text-muted-foreground">
      Aucun membre d'équipe trouvé
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import TeamMembersList from '../../components/employees/TeamMembersList.vue'
import { useAuthStore } from '../../stores/auth'
import { useEmployeeStore } from '../../stores/employees'
import { useEntityStore } from '../../stores/entities'

const auth = useAuthStore()
const employeeStore = useEmployeeStore()
const entityStore = useEntityStore()
// Séquencé : mapEmployee lit entityStore de façon synchrone pour entityName.
// /employees/collaborators (EMPLOYE_VOIR_EQUIPE) : employés de l'entité dirigée
// (sans les sous-entités) + employés dont on valide les demandes, avec le motif.
;(async () => {
  try {
    if (entityStore.entities.length === 0) await entityStore.fetchAll()
  } catch {
    // Le nom d'entite reste vide si la liste des entites n'est pas accessible :
    // ce n'est pas une raison de ne pas afficher l'equipe.
  }
  try {
    await employeeStore.fetchCollaborators()
  } catch {
    // employeeStore.error porte le message ; la page reste affichée.
  }
})()

const members = computed(() => employeeStore.collaborators.filter(e => e.id !== auth.user?.id))
const linksOf = (id: string) => employeeStore.collaboratorLinks[id] ?? []
const ownEntity = computed(() => members.value.filter(e => linksOf(e.id).includes('Entite')))
const validatedOnly = computed(() => members.value.filter(e => !linksOf(e.id).includes('Entite')))
</script>
