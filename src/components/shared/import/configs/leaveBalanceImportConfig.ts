import { useEmployeeStore } from '../../../../stores/employees'
import { useLeaveTypesStore } from '../../../../stores/leaveTypes'
import type { ImportConfig } from '../importTypes'

// Import des soldes de conges initiaux (demande client, 01/09) : avant la
// mise en service, chaque employe a deja un solde acquis dans l'ancien
// systeme, qu'il faut reprendre. Chaque ligne REMPLACE le solde de
// l'employe pour ce type (confirme par le client le 08/09 : "remplacer" et
// non "ajouter") — endpoint dedie /leave-transactions/set-balance, distinct
// du bouton "Ajuster un solde" (credit ponctuel, lui reste un delta
// relatif). Reimporter le meme fichier plusieurs fois reste donc sans danger.
export function buildLeaveBalanceImportConfig(): ImportConfig {
  const employeeStore = useEmployeeStore()
  const leaveTypesStore = useLeaveTypesStore()
  if (employeeStore.directory.length === 0) employeeStore.fetchDirectory()

  return {
    title: 'Soldes de congés initiaux',
    intro: "Fixez en une fois le solde initial de plusieurs employés pour un type de congé donné, par exemple pour reprendre les soldes acquis dans un ancien système avant la mise en service. Chaque ligne remplace le solde actuel de l'employé pour ce type par le nombre de jours indiqué (n'ajoute pas dessus).",
    createEndpoint: '/leave-transactions/set-balance',
    dependencies: [
      {
        label: 'Au moins un employé doit déjà exister',
        ok: () => employeeStore.directory.length > 0,
        routeTo: { name: 'hr-employees' },
        required: true,
      },
      {
        label: 'Au moins un type de congé doit déjà exister',
        ok: () => leaveTypesStore.leaveTypes.length > 0,
        routeTo: { name: 'hr-config-calendar' },
        required: true,
      },
    ],
    columns: [
      {
        key: 'EmployeeId', csvHeader: 'Code employé', label: 'Employé', required: true, type: 'select', sample: '',
        options: () => employeeStore.directory.map(e => ({ value: e.id, label: e.name, code: e.code })),
      },
      {
        key: 'LeaveTypeId', csvHeader: 'Code type de congé', label: 'Type de congé', required: true, type: 'select', sample: '',
        options: () => leaveTypesStore.leaveTypes.map(lt => ({ value: lt.id, label: lt.name, code: lt.code })),
      },
      { key: 'Amount', csvHeader: 'Solde (jours)', label: 'Solde', required: true, type: 'number', sample: '18' },
      { key: 'Reason', csvHeader: 'Motif', label: 'Motif', required: false, type: 'text', sample: 'Solde initial (reprise)' },
    ],
    sampleRows: [
      { 'Code employé': 'EMP001', 'Code type de congé': 'ANNUAL', 'Solde (jours)': '18', Motif: 'Solde initial (reprise)' },
    ],
    // Avertissement, pas un blocage : un solde de reprise superieur a
    // "Jours/an" peut etre legitime (report de conges non pris d'une annee
    // sur l'autre, ancien systeme qui accumulait differemment) — on alerte
    // pour permettre une relecture, sans empecher un cas reel. Types a
    // dotation illimitee (daysPerYear <= 0) : aucune comparaison possible.
    rowValidation(row) {
      const leaveType = leaveTypesStore.leaveTypes.find(lt => lt.id === row.values.LeaveTypeId)
      if (!leaveType || leaveType.daysPerYear <= 0) return undefined
      const amount = Number(row.values.Amount)
      if (Number.isFinite(amount) && amount > leaveType.daysPerYear) {
        return `Solde (${amount} j) supérieur aux ${leaveType.daysPerYear} j/an alloués pour ${leaveType.name} — vérifiez la valeur avant de continuer.`
      }
      return undefined
    },
  }
}
