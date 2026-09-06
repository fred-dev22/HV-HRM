// Ciblage d'eligibilite partage entre LeaveType et Holiday — miroir
// frontend de eligibility.util.ts (backend). Sur
// chaque critere, une valeur absente/null ne restreint rien (s'applique a
// tous) : c'est le comportement par defaut de tout type/jour ferie existant
// avant l'ajout de ces colonnes, donc rien ne change pour eux tant qu'on ne
// les configure pas explicitement.
export interface EligibilityRule {
  appliesToGender?: 'M' | 'F' | null
  appliesToExpatriate?: boolean | null
  organizationUnitId?: string | null
}

export interface EligibilityEmployee {
  gender: 'M' | 'F'
  isExpatriate: boolean
  entityId: string | null
}

export function isEligible(rule: EligibilityRule, employee: EligibilityEmployee): boolean {
  if (rule.appliesToGender && rule.appliesToGender !== employee.gender) return false
  if (rule.appliesToExpatriate != null && rule.appliesToExpatriate !== employee.isExpatriate) return false
  if (rule.organizationUnitId && rule.organizationUnitId !== employee.entityId) return false
  return true
}
