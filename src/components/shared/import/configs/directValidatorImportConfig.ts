import { useEmployeeStore } from '../../../../stores/employees'
import type { ImportConfig } from '../importTypes'

// Assignation en masse des validateurs directs par employé (demande client,
// retour du 08/09) : bascule le workflow de validation de congé de chaque
// ligne sur UN seul validateur fixe, à la place du pool de validation par
// entité (même bascule que le formulaire employé, voir EmployeeFormView.vue)
// — pensé pour les organisations sans hiérarchie à plusieurs niveaux.
// Réimporter le même fichier remplace simplement l'ancien validateur par le
// nouveau pour chaque ligne (endpoint idempotent, pas d'ajout cumulatif).
// Endpoint dédié /employees/assign-direct-validator plutôt que le PATCH
// générique de la fiche employé : le wizard d'import appelle toujours un
// POST une fois par ligne, jamais un PATCH paramétré par id.
export function buildDirectValidatorImportConfig(): ImportConfig {
  const employeeStore = useEmployeeStore()
  // employees (liste complète, pas directory) : necessaire pour filtrer les
  // options du validateur aux seuls employes ayant un compte + le droit de
  // validation reel (voir options() de la colonne DirectValidatorId
  // ci-dessous) — directory n'expose ni hasAccount ni validatorPermissions
  // (reponse allegee, voir stores/employees.ts).
  if (employeeStore.employees.length === 0) employeeStore.fetchAll()

  // Seul un employé avec un compte actif ET la permission CONGE_VALIDER
  // RÉELLEMENT accordée (validatorPermissions, calculé backend depuis les
  // UserPermission effectives — pas le gabarit de la catégorie qui peut avoir
  // divergé, retour du 10/09) peut effectivement traiter une demande « à
  // valider ». Pré-filtre côté import ; l'enforcement réel reste côté serveur
  // (EmployeeService.assertValidDirectValidator), qui rejette la ligne avec un
  // message clair si une valeur invalide est quand même soumise.
  function canValidateLeave(e: { validatorPermissions?: string[] }): boolean {
    return !!e.validatorPermissions?.includes('CONGE_VALIDER')
  }

  return {
    title: 'Validateurs directs',
    intro: "Assignez en une fois le validateur direct de plusieurs employés (un seul niveau de validation, à la place du pool de validation par entité configuré aujourd'hui). Réimporter le même fichier remplace simplement l'ancien validateur par le nouveau pour chaque ligne.",
    createEndpoint: '/employees/assign-direct-validator',
    dependencies: [
      {
        label: 'Au moins un employé doit déjà exister',
        ok: () => employeeStore.employees.length > 0,
        routeTo: { name: 'hr-employees' },
        required: true,
      },
    ],
    columns: [
      {
        key: 'EmployeeId', csvHeader: 'Code employé', label: 'Employé', required: true, type: 'select', sample: '',
        options: () => employeeStore.employees.map(e => ({ value: e.id, label: e.name, code: e.code })),
      },
      {
        key: 'DirectValidatorId', csvHeader: 'Code validateur', label: 'Validateur direct', required: true, type: 'select', sample: '',
        options: () => employeeStore.employees
          .filter(e => e.hasAccount && canValidateLeave(e))
          .map(e => ({ value: e.id, label: e.name, code: e.code })),
      },
    ],
    sampleRows: [
      { 'Code employé': 'EMP002', 'Code validateur': 'EMP001' },
    ],
    // Un employé désigné comme son propre validateur est un cas valide (ses
    // demandes sont auto-approuvées, voir routeToDirectValidator côté
    // backend) — juste signalé ici pour éviter une erreur de saisie
    // silencieuse (avertissement, n'empêche pas l'import).
    rowValidation(row) {
      if (row.values.EmployeeId && row.values.EmployeeId === row.values.DirectValidatorId) {
        return "Le validateur choisi est le même que l'employé : ses demandes seront auto-approuvées, sans validation humaine."
      }
      return undefined
    },
  }
}
