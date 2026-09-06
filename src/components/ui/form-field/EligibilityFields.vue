<script setup lang="ts">
/**
 * Champs de ciblage d'eligibilite partages entre un type de conge et un jour
 * ferie (demande client, 01/09, generalisee a tout type/jour ferie) : genre
 * concerne, statut expatrie. "Tous" (valeur vide) = s'applique a tout le
 * monde sur ce critere — meme comportement que si le champ n'existait pas
 * (voir backend common/utils/eligibility.util.ts). Valeurs texte ('', 'M',
 * 'F', 'true', 'false') comme tout autre select optionnel de l'appli,
 * converties en undefined/booleen par le formulaire appelant au moment de
 * construire son payload.
 */
import * as cls from '../../../lib/formClasses'

const gender = defineModel<string>('gender', { default: '' })
const expatriate = defineModel<string>('expatriate', { default: '' })
</script>

<template>
  <div class="grid grid-cols-2 gap-x-6 gap-y-4 max-sm:grid-cols-1">
    <div :class="cls.field">
      <label :class="cls.fieldLabel">Genre concerné</label>
      <select v-model="gender" :class="cls.fieldSelect">
        <option value="">Tous</option>
        <option value="M">Homme uniquement</option>
        <option value="F">Femme uniquement</option>
      </select>
    </div>
    <div :class="cls.field">
      <label :class="cls.fieldLabel">Statut expatrié</label>
      <select v-model="expatriate" :class="cls.fieldSelect">
        <option value="">Tous</option>
        <option value="true">Expatriés uniquement</option>
        <option value="false">Locaux uniquement</option>
      </select>
    </div>
  </div>
</template>
