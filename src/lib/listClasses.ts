/**
 * Classes Tailwind partagées pour les vues "liste" du HRM
 * (absences, congés, missions, frais, employés, entités…).
 * Centralisées pour garder le même langage visuel que le ListPageLayout
 * du frontdesk pendant la migration.
 */

/* Layout coquille page (TopNav + Sidebar + contenu) */
export const shell = 'flex flex-col min-h-screen'
export const mainLayout = 'flex flex-1 overflow-hidden'
export const content = 'flex-1 overflow-y-auto px-7 py-6 bg-background'

/* En-tête de page */
export const pageHeader = 'flex items-center justify-between mb-3.5'
export const pageTitle = 'text-lg font-semibold'
export const pageSub = 'text-[13px] text-muted-foreground mt-px'

/* Boutons */
export const btnPrimary = 'px-4 py-[7px] rounded-md text-[13px] font-medium cursor-pointer inline-flex items-center gap-1.5 bg-primary text-primary-foreground transition-colors hover:bg-primary/90'
export const btnOutline = 'px-4 py-[7px] rounded-md text-[13px] font-medium cursor-pointer inline-flex items-center gap-1.5 bg-card text-foreground border border-border transition-colors hover:bg-background'

/* Carte tableau */
export const tableCard = 'bg-card border border-border rounded-lg overflow-hidden'

/* Toolbar */
export const toolbar = 'flex items-center justify-between px-3.5 py-2 border-b border-border gap-2'
export const searchBox = 'flex items-center gap-1.5 border border-border rounded-md px-2 h-[30px] bg-card'
export const searchInput = 'border-0 outline-none text-xs text-foreground bg-transparent w-40 placeholder:text-muted-foreground'
export const tbIconBtn = 'w-[30px] h-[30px] rounded-md border border-border bg-card text-muted-foreground flex items-center justify-center cursor-pointer transition-colors relative hover:bg-background hover:text-foreground'
export const tbIconBtnActive = '!bg-primary/10 !text-primary !border-primary/20'

/* Table */
export const table = 'w-full border-collapse text-[13px]'
export const th = 'px-3 py-2.5 text-left text-xs font-semibold text-foreground bg-primary/10 border-b border-primary/20 whitespace-nowrap cursor-pointer select-none hover:bg-primary/15'
export const td = 'px-3 py-2.5 border-b border-border text-foreground align-middle'
export const rowHover = 'hover:bg-primary/10'

/* Boutons d'action dans les lignes */
export const actBtn = 'px-2.5 py-[5px] rounded text-xs font-medium cursor-pointer whitespace-nowrap inline-flex items-center gap-1'
export const actApprove = actBtn + ' bg-success-bg text-success'
export const actReturn = actBtn + ' bg-info-bg text-info'
export const actReject = actBtn + ' bg-danger-bg text-danger'
export const actView = actBtn + ' bg-background text-muted-foreground'

/* Panneau de filtres latéral */
export const filterPanel = 'w-[220px] min-w-[220px] border-r border-border p-3.5 flex flex-col gap-2.5 bg-card overflow-y-auto'
export const fpField = 'flex flex-col gap-1'
export const fpFieldLabel = 'text-[11px] text-muted-foreground'
export const fpSelect = 'h-[30px] px-2 border border-border rounded-md text-xs text-foreground bg-card outline-none w-full focus:border-primary'

/* Pagination */
export const pagination = 'flex items-center gap-3 px-3.5 py-2.5 border-t border-border text-xs text-muted-foreground'
export const pagBtn = 'min-w-[28px] h-7 px-1.5 rounded text-xs font-medium cursor-pointer border border-border bg-card text-foreground flex items-center justify-center transition-colors hover:bg-background disabled:opacity-35 disabled:cursor-not-allowed'
export const pagBtnActive = '!bg-primary !text-primary-foreground !border-primary'
export const pagSizeSelect = 'h-[26px] px-1.5 border border-border rounded text-xs text-foreground bg-card outline-none cursor-pointer focus:border-primary'

/* État vide */
export const emptyState = 'flex flex-col items-center p-10 gap-2 text-muted-foreground'

/* Carte simple (sections, détails) */
export const card = 'bg-card border border-border rounded-lg p-3.5'
export const cardHeader = 'flex items-center justify-between mb-3'
export const cardTitle = 'flex items-center gap-1.5 text-sm font-semibold text-foreground'
