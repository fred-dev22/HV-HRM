/**
 * Classes Tailwind partagées pour les champs de formulaire des modales.
 * Centralisées ici pour garder les 7 modales métier visuellement identiques
 * pendant et après la migration vers le design system.
 */

export const field = 'flex flex-col gap-1'

export const fieldLabel = 'text-xs font-medium text-foreground'

export const fieldOptional = 'font-normal text-muted-foreground'

export const fieldInput =
  'h-[38px] px-2.5 border border-border rounded-md bg-background text-[13px] text-foreground outline-none w-full transition-colors focus:border-primary focus:bg-card'

export const fieldTextarea =
  'px-2.5 py-2 border border-border rounded-md bg-background text-[13px] text-foreground outline-none resize-y w-full transition-colors focus:border-primary focus:bg-card'

export const fieldSelect = fieldInput + ' cursor-pointer'

export const inputError = '!border-danger'

export const fieldError = 'text-[11px] text-danger flex items-center gap-1'

export const fieldErrorBlock =
  'text-xs text-danger flex items-center gap-1 bg-danger-bg rounded-md px-2.5 py-2'

export const fieldWarning =
  'text-[11px] text-warning flex items-center gap-1 bg-warning-bg rounded px-2 py-1'

export const fieldRow = 'grid grid-cols-2 gap-3 max-sm:grid-cols-1'

export const radioGroup = 'flex gap-4 flex-wrap max-sm:flex-col max-sm:gap-2'

export const radioItem =
  'flex items-center gap-1.5 text-[13px] text-foreground cursor-pointer [&_input]:accent-primary [&_input]:cursor-pointer'

export const hintChip =
  'inline-flex items-center gap-1 text-[11px] font-medium rounded-full px-2.5 py-[3px]'

export const hintChipNeutral = hintChip + ' bg-neutral-bg text-neutral'
export const hintChipInfo = hintChip + ' bg-info-bg text-info'
export const hintChipWarning = hintChip + ' bg-warning-bg text-warning'

/* Boutons de pied de modale */
export const btn =
  'px-4 py-2 rounded-md text-[13px] font-medium cursor-pointer inline-flex items-center gap-1.5 transition-colors whitespace-nowrap max-sm:w-full max-sm:justify-center disabled:opacity-50 disabled:cursor-not-allowed'

export const btnPrimary = btn + ' bg-primary text-primary-foreground hover:bg-primary/90'

export const btnOutline = btn + ' bg-card text-foreground border border-border hover:bg-background'

export const btnDestructive = btn + ' bg-destructive text-destructive-foreground hover:bg-destructive/90'

export const btnInfo = btn + ' bg-info-bg text-info hover:bg-info hover:text-white'
