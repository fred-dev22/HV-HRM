import type { RouteLocationRaw } from 'vue-router'

// Config declarative consommee par ImportWizardModal.vue — un objet par
// domaine importable (voir configs/*.ts), le wizard lui-meme ne connait rien
// de metier specifique a un domaine.

export interface ImportOption {
  value: string
  label: string
  /** Code/identifiant lisible utilise pour l'auto-resolution depuis le CSV (ex: code entite, code metier). */
  code?: string
}

export interface ImportColumn {
  /** Nom du champ backend (PascalCase), ex: 'FirstName', 'OrganizationUnitId'. */
  key: string
  /** En-tete de colonne dans le CSV. */
  csvHeader: string
  /** Libelle affiche a l'etape 2 (peut differer de csvHeader). */
  label: string
  required: boolean
  type: 'text' | 'date' | 'boolean' | 'number' | 'select'
  /** Valeur utilisee dans le CSV d'exemple telechargeable. */
  sample: string
  /** Obligatoire si type === 'select' — evalue a l'ouverture du wizard pour refleter les donnees a jour. */
  options?: () => ImportOption[]
}

export interface ImportDependency {
  label: string
  ok: () => boolean
  routeTo: RouteLocationRaw
  /** Si true et `ok()` est faux, l'import est bloqué (pas seulement signalé). */
  required: boolean
}

export interface ImportConfig {
  title: string
  /** Phrase d'intro etape 1, ex: "Importez plusieurs métiers en une fois." */
  intro: string
  /** Endpoint POST appele une fois par ligne (progression reelle, voir ImportWizardModal). */
  createEndpoint: string
  dependencies: ImportDependency[]
  columns: ImportColumn[]
  /** 2-3 lignes d'exemple pour le CSV telechargeable, cles = csvHeader. */
  sampleRows: Record<string, string>[]
  /** Colonnes UI uniquement (jamais envoyees a createEndpoint), ex: case "creer un compte" pour les employes. */
  extraColumns?: ImportColumn[]
  /** Appele apres succes de la creation d'une ligne — effet de bord optionnel (ex: creer le compte utilisateur). Un rejet est capture et affiche comme avertissement a l'etape 3 (voir ImportRowResult.warning), pas silencieusement ignore. */
  onRowCreated?: (created: Record<string, unknown>, extra: Record<string, unknown>) => Promise<void>
  /** Ajuste le payload juste avant l'envoi — pour un champ backend requis mais derivable d'un autre champ deja saisi (ex: HolidayType derive de OrganizationUnitId), sans l'exposer a l'utilisateur. */
  transformPayload?: (row: ParsedRow, payload: Record<string, unknown>) => Record<string, unknown>
  /** Validation inter-champs au-dela de "required" sur une colonne isolee (ex: "createAccount" coché sans catégorie choisie) — retourne un message si la ligne a un problème, undefined sinon. Affiché comme avertissement (n'empêche pas l'import). */
  rowValidation?: (row: ParsedRow) => string | undefined
}

export interface ParsedRow {
  /** Valeurs editables (id resolu pour les colonnes 'select', texte brut sinon), cles = ImportColumn.key. */
  values: Record<string, string>
  /** Texte brut original du CSV, cles = ImportColumn.key — sert d'indice quand une colonne 'select' n'a pas pu être auto-résolue. */
  raw: Record<string, string>
  /** Valeurs des extraColumns (UI uniquement). */
  extra: Record<string, unknown>
}

export interface ImportRowResult {
  index: number
  success: boolean
  error?: string
  /** Effet de bord post-creation qui a echoue (ex: compte utilisateur non cree) — la ligne elle-meme est un succes, mais l'utilisateur doit le savoir plutot que le decouvrir plus tard. */
  warning?: string
}
