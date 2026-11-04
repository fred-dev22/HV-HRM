// Association des colonnes d'un fichier d'import a celles attendues par l'import.
// Un fichier au format prevu est reconnu seul ; sinon, l'association choisie par
// la personne est memorisee (par type d'import) et reprise la fois suivante.

// Compare les en-tetes sans tenir compte des accents, de la casse ni des espaces.
export function normalizeHeader(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

// Pour chaque colonne attendue (par son en-tete csvHeader) : la colonne du fichier
// qui lui correspond, ou '' si aucune. Ordre : nom reconnu tel quel, puis
// association memorisee si cette colonne existe encore dans le fichier.
export function resolveColumnMapping(
  expected: { csvHeader: string }[],
  fileHeaders: string[],
  saved: Record<string, string> = {},
): Record<string, string> {
  const byName = new Map(fileHeaders.map(h => [normalizeHeader(h), h]))
  const out: Record<string, string> = {}
  for (const { csvHeader } of expected) {
    const direct = byName.get(normalizeHeader(csvHeader))
    const remembered = saved[csvHeader]
    out[csvHeader] = direct ?? (remembered && fileHeaders.includes(remembered) ? remembered : '')
  }
  return out
}

// Associations a memoriser : seulement celles qui different du nom attendu.
export function mappingToRemember(mapping: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(mapping).filter(([expected, actual]) => actual && normalizeHeader(actual) !== normalizeHeader(expected)),
  )
}

const KEY = (importTitle: string) => `import-mapping:${importTitle}`

export function loadSavedMapping(importTitle: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(KEY(importTitle))
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function saveMapping(importTitle: string, mapping: Record<string, string>): void {
  try {
    const toKeep = mappingToRemember(mapping)
    if (Object.keys(toKeep).length === 0) localStorage.removeItem(KEY(importTitle))
    else localStorage.setItem(KEY(importTitle), JSON.stringify(toKeep))
  } catch {
    // stockage indisponible : l'association sera simplement redemandee
  }
}
