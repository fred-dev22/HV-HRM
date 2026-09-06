import { useEntityStore } from '../../../../stores/entities'
import type { ImportConfig } from '../importTypes'

const WORKFLOW_OPTIONS = [
  { value: 'Standard', label: 'Standard (avec validation)' },
  { value: 'Medical', label: 'Médical (déclaration a posteriori)' },
]
// Memes options que EligibilityFields.vue (formulaire manuel) — colonne
// facultative, valeur vide = "Tous" (comportement identique a aujourd'hui,
// voir eligibility.util.ts cote backend).
const GENDER_OPTIONS = [
  { value: 'M', label: 'Homme' },
  { value: 'F', label: 'Femme' },
]

export function buildLeaveTypeImportConfig(): ImportConfig {
  const entityStore = useEntityStore()

  return {
    title: "Types d'absence",
    intro: "Importez plusieurs types de congé/absence en une fois. La couleur est un code hexadécimal (ex: #EF463B), utilisée pour l'afficher dans le calendrier.",
    createEndpoint: '/leave-types',
    dependencies: [],
    columns: [
      { key: 'Code', csvHeader: 'Code', label: 'Code', required: true, type: 'text', sample: 'ANNUAL' },
      { key: 'Name', csvHeader: 'Nom', label: 'Nom', required: true, type: 'text', sample: 'Congé annuel' },
      { key: 'WorkflowType', csvHeader: 'Workflow', label: 'Workflow', required: true, type: 'select', sample: 'Standard (avec validation)', options: () => WORKFLOW_OPTIONS },
      { key: 'DaysPerYear', csvHeader: 'Jours par an', label: 'Jours/an', required: true, type: 'number', sample: '30' },
      { key: 'MonthlyAccrual', csvHeader: 'Acquisition mensuelle', label: 'Mensuel', required: false, type: 'boolean', sample: 'oui' },
      { key: 'DocumentRequired', csvHeader: 'Justificatif requis', label: 'Justificatif', required: false, type: 'boolean', sample: 'non' },
      { key: 'MinNoticeDays', csvHeader: 'Préavis minimum (jours)', label: 'Préavis', required: false, type: 'number', sample: '7' },
      { key: 'Color', csvHeader: 'Couleur', label: 'Couleur', required: true, type: 'text', sample: '#EF463B' },
      // Ciblage d'eligibilite (demande client, 01/09) — les 3 colonnes sont
      // facultatives, laissees vides = s'applique a tout le monde, exactement
      // comme un type de conge cree sans toucher a la section Eligibilite du
      // formulaire manuel.
      { key: 'AppliesToGender', csvHeader: 'Genre concerné', label: 'Genre concerné', required: false, type: 'select', sample: '', options: () => GENDER_OPTIONS },
      { key: 'AppliesToExpatriate', csvHeader: 'Statut expatrié', label: 'Statut expatrié', required: false, type: 'boolean', sample: '' },
      {
        key: 'OrganizationUnitId', csvHeader: 'Code entité', label: 'Entité', required: false, type: 'select', sample: '',
        options: () => entityStore.approvedEntities.map(e => ({ value: e.id, label: e.name, code: e.code })),
      },
    ],
    sampleRows: [
      { Code: 'ANNUAL', Nom: 'Congé annuel', Workflow: 'Standard (avec validation)', 'Jours par an': '30', 'Acquisition mensuelle': 'oui', 'Justificatif requis': 'non', 'Préavis minimum (jours)': '7', Couleur: '#EF463B', 'Genre concerné': '', 'Statut expatrié': '', 'Code entité': '' },
      { Code: 'SICK', Nom: 'Congé maladie', Workflow: 'Médical (déclaration a posteriori)', 'Jours par an': '15', 'Acquisition mensuelle': 'non', 'Justificatif requis': 'oui', 'Préavis minimum (jours)': '0', Couleur: '#C8102E', 'Genre concerné': '', 'Statut expatrié': '', 'Code entité': '' },
    ],
    // Sans ça, un type de congé importé ne créditait aucun employé déjà en
    // poste — ils ne recevaient ce type qu'à la prochaine génération
    // automatique. Même comportement par défaut que la création manuelle
    // (voir LeaveTypeFormModal.vue, case pré-cochée).
    //
    // DaysPerMonth n'est pas une colonne du CSV (pas plus qu'un champ saisi
    // dans le formulaire manuel, voir LeaveTypeFormModal.vue) — calculé ici
    // pour rester cohérent avec "Jours par an" dès que "Acquisition
    // mensuelle" vaut oui, plutôt que de laisser un type à accumulation
    // mensuelle sans valeur mensuelle en base.
    transformPayload: (row, payload) => ({
      ...payload,
      CreditExistingEmployees: true,
      DaysPerMonth: payload.MonthlyAccrual ? Math.round((Number(payload.DaysPerYear) / 12) * 100) / 100 : undefined,
    }),
  }
}
