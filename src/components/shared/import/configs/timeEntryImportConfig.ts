import { useEmployeeStore } from '../../../../stores/employees'
import { ENTRY_TYPE_LABELS } from '../../../../stores/time'
import type { ImportConfig, ParsedRow } from '../importTypes'

// Import des saisies manuelles de temps (sites sans pointeuse, missions, reunions,
// paniers, permanences) depuis un fichier Excel ou CSV. Chaque ligne est creee comme
// une saisie normale : elle suit le circuit de validation de l'employe. Reserve au RH
// (saisie pour le compte d'un autre employe).

const NO_TIMES = ['panier', 'permanence'] // comptent pour 1 par jour : ni horaires ni duree

// "8:00", "08:00", "8h30", "8h" -> "08:00" ; autre chose : renvoye tel quel (la
// validation de la ligne le signale).
export function normalizeTime(value: string | undefined): string {
  const v = (value ?? '').trim().toLowerCase()
  if (!v) return ''
  const m = v.match(/^(\d{1,2})\s*[:h]\s*(\d{2})?$/)
  if (!m) return v
  return `${m[1]!.padStart(2, '0')}:${m[2] ?? '00'}`
}

const TIME_OK = /^([01]\d|2[0-3]):[0-5]\d$/
const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3))
const parseHours = (v: string | undefined) => Number((v ?? '').replace(',', '.'))

export function validateTimeEntryRow(row: ParsedRow): string | undefined {
  const type = row.values.EntryType
  if (!type || NO_TIMES.includes(type)) return undefined
  const start = normalizeTime(row.values.StartTime)
  const end = normalizeTime(row.values.EndTime)
  const hours = row.values.Hours
  if (!start && !end) {
    return parseHours(hours) > 0 && parseHours(hours) <= 24 ? undefined : "Indiquez l'heure de début et de fin, ou la durée en heures (entre 0 et 24)."
  }
  if (!start || !end) return "Renseignez l'heure de début ET l'heure de fin."
  if (!TIME_OK.test(start) || !TIME_OK.test(end)) return 'Les heures doivent être au format HH:mm (ex : 08:30).'
  if (toMinutes(end) <= toMinutes(start)) return "L'heure de fin doit être après l'heure de début."
  return undefined
}

export function buildTimeEntryImportConfig(): ImportConfig {
  const employeeStore = useEmployeeStore()
  if (employeeStore.directory.length === 0) employeeStore.fetchDirectory().catch(() => {})

  return {
    title: 'Saisies manuelles de temps',
    intro: "Importez en une fois les heures de plusieurs employés (sites sans pointeuse, missions, réunions extérieures, paniers, permanences). Chaque ligne devient une saisie en attente, validée par le circuit de l'employé. Renseignez l'heure de début et de fin, ou seulement la durée ; un panier ou une permanence compte pour 1 par jour, sans horaires.",
    acceptExcel: true,
    createEndpoint: '/time/entries',
    dependencies: [
      {
        label: 'Au moins un employé doit déjà exister',
        ok: () => employeeStore.directory.length > 0,
        routeTo: { name: 'hr-employees' },
        required: true,
      },
    ],
    columns: [
      {
        key: 'EmployeeId', csvHeader: 'Matricule', label: 'Employé (matricule)', required: true, type: 'select', matchCodeOnly: true, sample: 'EMP001',
        options: () => employeeStore.directory.map(e => ({ value: e.id, label: e.name, code: e.code })),
      },
      {
        key: 'EntryType', csvHeader: 'Type de saisie', label: 'Type de saisie', required: true, type: 'select', sample: 'Mission',
        options: () => Object.entries(ENTRY_TYPE_LABELS).map(([value, label]) => ({ value, label, code: value })),
      },
      { key: 'Date', csvHeader: 'Date', label: 'Date', required: true, type: 'date', sample: '2026-11-03' },
      { key: 'StartTime', csvHeader: 'Début', label: 'Début (HH:mm)', required: false, type: 'text', sample: '08:00' },
      { key: 'EndTime', csvHeader: 'Fin', label: 'Fin (HH:mm)', required: false, type: 'text', sample: '17:00' },
      { key: 'Hours', csvHeader: 'Durée (h)', label: 'Durée (h)', required: false, type: 'text', sample: '' },
      { key: 'Comments', csvHeader: 'Commentaire', label: 'Commentaire', required: false, type: 'text', sample: 'Chantier site Nord' },
    ],
    sampleRows: [
      { Matricule: 'EMP001', 'Type de saisie': 'Mission', Date: '2026-11-03', 'Début': '08:00', Fin: '17:00', 'Durée (h)': '', Commentaire: 'Chantier site Nord' },
      { Matricule: 'EMP002', 'Type de saisie': 'Travail hors site', Date: '2026-11-03', 'Début': '', Fin: '', 'Durée (h)': '6,5', Commentaire: '' },
      { Matricule: 'EMP003', 'Type de saisie': 'Panier', Date: '2026-11-03', 'Début': '', Fin: '', 'Durée (h)': '', Commentaire: '' },
    ],
    rowValidation: validateTimeEntryRow,
    // Horaires normalises, duree convertie (virgule decimale), panier/permanence = 1.
    transformPayload: (row, payload) => {
      const type = row.values.EntryType ?? ''
      const out: Record<string, unknown> = { ...payload }
      delete out.StartTime
      delete out.EndTime
      delete out.Hours
      if (NO_TIMES.includes(type)) {
        out.Hours = 1
        return out
      }
      const start = normalizeTime(row.values.StartTime)
      const end = normalizeTime(row.values.EndTime)
      if (start && end) {
        out.StartTime = start
        out.EndTime = end
      } else {
        out.Hours = parseHours(row.values.Hours)
      }
      return out
    },
  }
}
