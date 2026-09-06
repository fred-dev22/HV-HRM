import type { ImportConfig } from '../importTypes'

export function buildCategoryImportConfig(): ImportConfig {
  return {
    title: 'Catégories d\'employés',
    intro: 'Importez plusieurs catégories en une fois. Chaque catégorie porte un paquet de permissions par défaut, configurable ensuite dans Classification.',
    createEndpoint: '/employee-categories',
    dependencies: [],
    columns: [
      { key: 'Code', csvHeader: 'Code', label: 'Code', required: true, type: 'text', sample: 'CAT-COM' },
      { key: 'Name', csvHeader: 'Nom', label: 'Nom', required: true, type: 'text', sample: 'Commercial' },
    ],
    sampleRows: [
      { Code: 'CAT-COM', Nom: 'Commercial' },
      { Code: 'CAT-TECH', Nom: 'Technicien' },
    ],
  }
}
