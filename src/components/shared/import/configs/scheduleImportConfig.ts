import { useEmployeeStore } from '../../../../stores/employees'
import { useEmployeeCategoryStore } from '../../../../stores/employeeCategories'
import type { ImportConfig, ParsedRow } from '../importTypes'

// Import des horaires de travail (Excel ou CSV) : une ligne = des jours, des heures et
// une pause pour le calendrier global, celui d'une categorie ou celui d'un employe. Le
// calendrier est cree s'il n'existe pas ; sinon seuls les jours indiques changent.
// Debut et Fin vides = jour de repos.

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const
// Noms francais et abreviations, sans accent ni majuscule.
const DAY_NAMES: Record<string, (typeof DAYS)[number]> = {
  lundi: 'Monday', lun: 'Monday', mardi: 'Tuesday', mar: 'Tuesday', mercredi: 'Wednesday', mer: 'Wednesday',
  jeudi: 'Thursday', jeu: 'Thursday', vendredi: 'Friday', ven: 'Friday', samedi: 'Saturday', sam: 'Saturday',
  dimanche: 'Sunday', dim: 'Sunday',
}

const plain = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

// "Lundi-Vendredi", "lun au ven", "Lundi, Mercredi", "Samedi", "Tous" -> jours en anglais
// (ordre de la semaine, sans doublon). Renvoie null si un mot n'est pas reconnu.
export function parseDays(text: string | undefined): (typeof DAYS)[number][] | null {
  const t = plain(text ?? '')
  if (!t) return null
  if (['tous', 'tous les jours', 'toute la semaine', '7j/7'].includes(t)) return [...DAYS]
  if (['semaine', 'jours ouvres', 'jours ouvrables'].includes(t)) return DAYS.slice(0, 5)
  const picked = new Set<(typeof DAYS)[number]>()
  for (const part of t.split(/\s*(?:,|;|\+|\/|\bet\b)\s*/).filter(Boolean)) {
    const range = part.split(/\s*(?:-|\bau\b|\ba\b)\s*/).filter(Boolean)
    if (range.length === 1) {
      const d = DAY_NAMES[range[0]!]
      if (!d) return null
      picked.add(d)
    } else if (range.length === 2) {
      const from = DAY_NAMES[range[0]!]
      const to = DAY_NAMES[range[1]!]
      if (!from || !to) return null
      let i = DAYS.indexOf(from)
      const end = DAYS.indexOf(to)
      for (let guard = 0; guard < 7; guard++) {
        picked.add(DAYS[i]!)
        if (i === end) break
        i = (i + 1) % 7
      }
    } else {
      return null
    }
  }
  return DAYS.filter(d => picked.has(d))
}

// "8:00", "08:00", "8h30", "8h" -> "08:00" ; autre chose : renvoye tel quel.
export function normalizeTime(value: string | undefined): string {
  const v = (value ?? '').trim().toLowerCase()
  if (!v) return ''
  const m = v.match(/^(\d{1,2})\s*[:h]\s*(\d{2})?$/)
  if (!m) return v
  return `${m[1]!.padStart(2, '0')}:${m[2] ?? '00'}`
}

const TIME_OK = /^([01]\d|2[0-3]):[0-5]\d$/
const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3))

export interface ScheduleLookups {
  findCategoryId: (text: string) => string | undefined
  findEmployeeId: (text: string) => string | undefined
}

// Verifie une ligne : portee, cible retrouvee, jours reconnus, heures coherentes.
export function validateScheduleRow(row: ParsedRow, lookups: ScheduleLookups): string | undefined {
  const scope = row.values.Scope
  if (!scope) return 'Choisissez la portée : Global, Catégorie ou Employé.'
  const target = (row.values.Target ?? '').trim()
  if (scope === 'category' && !lookups.findCategoryId(target)) return target ? `Aucune catégorie avec le code « ${target} ». Indiquez le code, pas le nom.` : 'Indiquez le code de la catégorie dans la colonne Cible.'
  if (scope === 'employee' && !lookups.findEmployeeId(target)) return target ? `Aucun employé avec le matricule « ${target} ». Indiquez le matricule, pas le nom.` : "Indiquez le matricule de l'employé dans la colonne Cible."
  if (!parseDays(row.values.Days)) return 'Jours non reconnus. Exemples : Lundi-Vendredi, Samedi, Lundi, Mercredi, Tous.'

  const start = normalizeTime(row.values.StartTime)
  const end = normalizeTime(row.values.EndTime)
  const bStart = normalizeTime(row.values.BreakStartTime)
  const bEnd = normalizeTime(row.values.BreakEndTime)
  if (!start && !end) return undefined // jour de repos
  if (!start || !end) return "Renseignez l'heure de début ET l'heure de fin (ou laissez les deux vides pour un jour de repos)."
  if (![start, end, bStart, bEnd].filter(Boolean).every(t => TIME_OK.test(t))) return 'Les heures doivent être au format HH:mm (ex : 08:00).'
  if (toMinutes(end) <= toMinutes(start)) return "L'heure de fin doit être après l'heure de début."
  if (!!bStart !== !!bEnd) return 'Renseignez le début ET la fin de la pause.'
  if (bStart && bEnd) {
    if (toMinutes(bEnd) <= toMinutes(bStart)) return 'La pause doit finir après avoir commencé.'
    if (toMinutes(bStart) < toMinutes(start) || toMinutes(bEnd) > toMinutes(end)) return "La pause doit être comprise entre l'heure de début et l'heure de fin."
  }
  return undefined
}

export function buildScheduleImportConfig(): ImportConfig {
  const employeeStore = useEmployeeStore()
  const categoryStore = useEmployeeCategoryStore()
  employeeStore.fetchDirectory().catch(() => {})
  categoryStore.fetchAll().catch(() => {})

  const lookups: ScheduleLookups = {
    // Code de categorie et matricule uniquement (uniques en base) ; si jamais deux
    // lignes portaient le meme, la cible est refusee plutot que devinee.
    findCategoryId: (text) => {
      const t = plain(text)
      const found = categoryStore.categories.filter(c => plain(c.code) === t)
      return found.length === 1 ? found[0]!.id : undefined
    },
    findEmployeeId: (text) => {
      const t = plain(text)
      const found = employeeStore.directory.filter(e => plain(e.code) === t)
      return found.length === 1 ? found[0]!.id : undefined
    },
  }

  return {
    title: 'Horaires de travail',
    intro: "Importez les horaires du calendrier global, d'une catégorie ou d'un employé. La colonne Cible contient le code de la catégorie ou le matricule de l'employé (jamais le nom). Chaque ligne donne des jours (Lundi-Vendredi, Samedi, Lundi, Mercredi, Tous), l'heure de début et de fin, et une pause facultative. Laissez Début et Fin vides pour un jour de repos. Le calendrier d'une catégorie ou d'un employé est créé s'il n'existe pas ; sinon seuls les jours indiqués changent.",
    acceptExcel: true,
    createEndpoint: '/calendars/import-schedule',
    dependencies: [],
    columns: [
      {
        key: 'Scope', csvHeader: 'Portée', label: 'Portée', required: true, type: 'select', sample: 'Catégorie',
        options: () => [
          { value: 'global', label: 'Global', code: 'global' },
          { value: 'category', label: 'Catégorie', code: 'category' },
          { value: 'employee', label: 'Employé', code: 'employee' },
        ],
      },
      { key: 'Target', csvHeader: 'Cible', label: 'Cible (code catégorie ou matricule)', required: false, type: 'text', sample: 'PROD' },
      { key: 'Days', csvHeader: 'Jours', label: 'Jours', required: true, type: 'text', sample: 'Lundi-Vendredi' },
      { key: 'StartTime', csvHeader: 'Début', label: 'Début (HH:mm)', required: false, type: 'text', sample: '08:00' },
      { key: 'EndTime', csvHeader: 'Fin', label: 'Fin (HH:mm)', required: false, type: 'text', sample: '17:00' },
      { key: 'BreakStartTime', csvHeader: 'Début pause', label: 'Début pause', required: false, type: 'text', sample: '12:00' },
      { key: 'BreakEndTime', csvHeader: 'Fin pause', label: 'Fin pause', required: false, type: 'text', sample: '13:00' },
    ],
    sampleRows: [
      { 'Portée': 'Global', Cible: '', Jours: 'Lundi-Vendredi', 'Début': '08:00', Fin: '17:00', 'Début pause': '12:00', 'Fin pause': '13:00' },
      { 'Portée': 'Catégorie', Cible: 'PROD', Jours: 'Lundi-Vendredi', 'Début': '07:00', Fin: '16:00', 'Début pause': '12:00', 'Fin pause': '13:00' },
      { 'Portée': 'Global', Cible: '', Jours: 'Samedi', 'Début': '08:00', Fin: '12:00', 'Début pause': '', 'Fin pause': '' },
      { 'Portée': 'Global', Cible: '', Jours: 'Dimanche', 'Début': '', Fin: '', 'Début pause': '', 'Fin pause': '' },
      { 'Portée': 'Employé', Cible: 'EMP001', Jours: 'Lundi-Jeudi', 'Début': '07:00', Fin: '15:00', 'Début pause': '', 'Fin pause': '' },
    ],
    rowValidation: (row) => validateScheduleRow(row, lookups),
    transformPayload: (row) => {
      const scope = row.values.Scope
      const target = (row.values.Target ?? '').trim()
      const start = normalizeTime(row.values.StartTime)
      const end = normalizeTime(row.values.EndTime)
      const out: Record<string, unknown> = {
        Scope: scope,
        Days: parseDays(row.values.Days) ?? [],
        IsEnabled: !!(start || end),
      }
      // Le serveur retrouve la cible par son code / matricule (et nomme la valeur fautive).
      if (scope === 'category' || scope === 'employee') out.TargetCode = target
      if (start) out.StartTime = start
      if (end) out.EndTime = end
      const bStart = normalizeTime(row.values.BreakStartTime)
      const bEnd = normalizeTime(row.values.BreakEndTime)
      if (start && end && bStart && bEnd) {
        out.BreakStartTime = bStart
        out.BreakEndTime = bEnd
      }
      return out
    },
  }
}
