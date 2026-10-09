// Fonctionnalites actives sur CETTE instance. Les valeurs ne sont plus figees a
// la compilation : le backend les expose (GET /api/config/public, variable
// ENABLED_MODULES) et applyEnabledModules() les renseigne au demarrage, avant
// l'affichage. Meme version du frontend pour tous les clients ; activer ou
// couper un module = changer ENABLED_MODULES cote serveur, sans reconstruire.
//
// `export let` : liaisons vivantes, les importeurs voient la valeur appliquee.
// Le verrou reel est cote backend (un module coupe repond 404) : ces drapeaux
// ne font que masquer navigation et ecrans.

export let MISSIONS_EXPENSES_ENABLED = false
export let RECRUITMENT_MODULE_ENABLED = false
export let FORMATION_MODULE_ENABLED = false
export let PAYROLL_MODULE_ENABLED = false
export let REPORTS_MODULE_ENABLED = false
// Modules encore a l'etat de coquille vide (Paie, Rapports) : vrai si l'un des deux est actif.
export let PLACEHOLDER_MODULES_ENABLED = false
// Diffusion des offres (canaux, flux publics) : option, FEATURE_JOB_DISTRIBUTION_UI cote serveur.
export let JOB_DISTRIBUTION_UI_ENABLED = false

export function applyEnabledModules(modules: readonly string[], features: { jobDistributionUi?: boolean } = {}): void {
  const on = new Set(modules)
  MISSIONS_EXPENSES_ENABLED = on.has('missions_expenses')
  RECRUITMENT_MODULE_ENABLED = on.has('recruitment')
  FORMATION_MODULE_ENABLED = on.has('training')
  PAYROLL_MODULE_ENABLED = on.has('payroll')
  REPORTS_MODULE_ENABLED = on.has('reports')
  PLACEHOLDER_MODULES_ENABLED = PAYROLL_MODULE_ENABLED || REPORTS_MODULE_ENABLED
  JOB_DISTRIBUTION_UI_ENABLED = RECRUITMENT_MODULE_ENABLED && features.jobDistributionUi === true
}
