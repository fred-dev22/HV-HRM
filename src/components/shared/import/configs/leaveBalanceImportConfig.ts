import { useEmployeeStore } from '../../../../stores/employees'
import { useLeaveTypesStore } from '../../../../stores/leaveTypes'
import type { ImportConfig } from '../importTypes'

// Import des soldes de conges initiaux (demande client, 01/09) :
// avant la mise en service, chaque employe a deja un solde acquis dans
// l'ancien systeme, qu'il faut reprendre. Un seul mouvement de credit par
// ligne (meme endpoint que le bouton "Ajuster un solde"), pas de nouvel
// endpoint backend necessaire.
export function buildLeaveBalanceImportConfig(): ImportConfig {
  const employeeStore = useEmployeeStore()
  const leaveTypesStore = useLeaveTypesStore()
  if (employeeStore.directory.length === 0) employeeStore.fetchDirectory()

  return {
    title: 'Soldes de congés initiaux',
    intro: "Créditez en une fois le solde initial de plusieurs employés pour un type de congé donné, par exemple pour reprendre les soldes acquis dans un ancien système avant la mise en service. Chaque ligne ajoute le nombre de jours indiqué au solde actuel de l'employé pour ce type (0 s'il n'en a pas encore).",
    createEndpoint: '/leave-transactions/credit',
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
      { key: 'Amount', csvHeader: 'Jours', label: 'Jours', required: true, type: 'number', sample: '18' },
      { key: 'Reason', csvHeader: 'Motif', label: 'Motif', required: false, type: 'text', sample: 'Solde initial (reprise)' },
    ],
    sampleRows: [
      { 'Code employé': 'EMP001', 'Code type de congé': 'ANNUAL', Jours: '18', Motif: 'Solde initial (reprise)' },
    ],
  }
}
