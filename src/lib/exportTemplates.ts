import type { CsvOptions, ExportColumnConfig, ExportFormat } from './exportFile'

// Modeles d'export enregistres par l'utilisateur (ex : "Sage paie mensuel").
// Stockes dans le navigateur de la personne (localStorage) : pratique pour un
// export recurrent, mais pas partages entre postes. Toute lecture/ecriture est
// protegee (navigation privee, stockage bloque) : sans stockage, l'export
// fonctionne, simplement sans memoire.

export interface ExportSettings {
  columns: ExportColumnConfig[]
  format: ExportFormat
  includeHeader: boolean
  csv: CsvOptions
}

export interface ExportTemplate extends ExportSettings {
  id: string
  name: string
}

const PREFIX = 'export-templates:'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* stockage indisponible : on continue sans memoire */
  }
}

export function listTemplates(scope: string): ExportTemplate[] {
  const list = read<ExportTemplate[]>(PREFIX + scope, [])
  return Array.isArray(list) ? list : []
}

export function saveTemplate(scope: string, name: string, settings: ExportSettings): ExportTemplate {
  const templates = listTemplates(scope)
  const trimmed = name.trim()
  const existing = templates.find(t => t.name.toLowerCase() === trimmed.toLowerCase())
  const template: ExportTemplate = {
    ...settings,
    id: existing?.id ?? `tpl-${Date.now().toString(36)}`,
    name: trimmed,
  }
  write(PREFIX + scope, [...templates.filter(t => t.id !== template.id), template])
  return template
}

export function deleteTemplate(scope: string, id: string) {
  write(PREFIX + scope, listTemplates(scope).filter(t => t.id !== id))
}

// Derniers reglages utilises : l'export suivant reprend ou on s'etait arrete.
export function loadLastSettings(scope: string): ExportSettings | null {
  return read<ExportSettings | null>(PREFIX + scope + ':last', null)
}

export function saveLastSettings(scope: string, settings: ExportSettings) {
  write(PREFIX + scope + ':last', settings)
}
