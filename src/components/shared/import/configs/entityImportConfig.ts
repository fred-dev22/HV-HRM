import { useEntityStore } from '../../../../stores/entities'
import { useEmployeeStore } from '../../../../stores/employees'
import type { ImportConfig } from '../importTypes'

// `code` = valeur backend (celle qu'un CSV généré par export ou par un autre
// outil utiliserait) — permet à resolveSelect() de matcher soit ce code, soit
// le libellé français, au lieu d'exiger le libellé exact (voir bug où
// "Department" ne matchait pas "Département").
const TYPE_OPTIONS = [
  { value: 'Direction', label: 'Direction', code: 'Direction' },
  { value: 'Department', label: 'Département', code: 'Department' },
  { value: 'Service', label: 'Service', code: 'Service' },
]
const STATUS_OPTIONS = [
  { value: 'Active', label: 'Actif', code: 'Active' },
  { value: 'Draft', label: 'Brouillon', code: 'Draft' },
  { value: 'PendingApproval', label: 'En attente d\'approbation', code: 'PendingApproval' },
  { value: 'Inactive', label: 'Désactivée', code: 'Inactive' },
]

export function buildEntityImportConfig(): ImportConfig {
  const entityStore = useEntityStore()
  const employeeStore = useEmployeeStore()

  return {
    title: 'Structure organisationnelle',
    intro: 'Importez plusieurs entités en une fois. Si une entité a un parent, celui-ci doit déjà exister (créé à la main ou importé dans un lot précédent) — un import en plusieurs passes est nécessaire pour une hiérarchie profonde. Si vous voulez rattacher un responsable, celui-ci doit aussi déjà exister comme employé.',
    createEndpoint: '/organization-units',
    dependencies: [],
    columns: [
      { key: 'Code', csvHeader: 'Code', label: 'Code', required: true, type: 'text', sample: 'ENT-FIN' },
      { key: 'Name', csvHeader: 'Nom', label: 'Nom', required: true, type: 'text', sample: 'Finance' },
      { key: 'Type', csvHeader: 'Type', label: 'Type', required: true, type: 'select', sample: 'Département', options: () => TYPE_OPTIONS },
      {
        key: 'ParentId', csvHeader: 'Code entité parente', label: 'Entité parente', required: false, type: 'select', sample: 'DG',
        options: () => entityStore.entities.map(e => ({ value: e.id, label: e.name, code: e.code })),
      },
      { key: 'Status', csvHeader: 'Statut', label: 'Statut', required: true, type: 'select', sample: 'Actif', options: () => STATUS_OPTIONS },
      {
        key: 'ManagerId', csvHeader: 'Responsable', label: 'Responsable', required: false, type: 'select', sample: '',
        options: () => employeeStore.employees.map(e => ({ value: e.id, label: e.name, code: e.code })),
      },
      { key: 'LegalIdentifier', csvHeader: 'Identifiant légal', label: 'Identifiant légal', required: false, type: 'text', sample: '' },
      { key: 'Address', csvHeader: 'Adresse', label: 'Adresse', required: false, type: 'text', sample: '' },
      { key: 'Phone', csvHeader: 'Téléphone', label: 'Téléphone', required: false, type: 'text', sample: '' },
      { key: 'Email', csvHeader: 'Email', label: 'Email', required: false, type: 'text', sample: '' },
    ],
    sampleRows: [
      { Code: 'ENT-FIN', Nom: 'Finance', Type: 'Département', 'Code entité parente': 'DG', Statut: 'Actif', 'Responsable': '', 'Identifiant légal': '', Adresse: '', 'Téléphone': '', Email: '' },
      { Code: 'ENT-COMPTA', Nom: 'Comptabilité', Type: 'Service', 'Code entité parente': 'ENT-FIN', Statut: 'Actif', 'Responsable': '', 'Identifiant légal': '', Adresse: '', 'Téléphone': '', Email: '' },
    ],
  }
}
