import type { ImportConfig } from '../importTypes'

export function buildJobImportConfig(): ImportConfig {
  return {
    title: 'Métiers',
    intro: 'Importez plusieurs métiers en une fois. Ils pourront ensuite être rattachés à des postes.',
    createEndpoint: '/jobs',
    dependencies: [],
    columns: [
      { key: 'Code', csvHeader: 'Code', label: 'Code', required: true, type: 'text', sample: 'MET-DEV' },
      { key: 'Title', csvHeader: 'Intitulé', label: 'Intitulé', required: true, type: 'text', sample: 'Développeur' },
      { key: 'Description', csvHeader: 'Description', label: 'Description', required: false, type: 'text', sample: 'Développement logiciel' },
    ],
    sampleRows: [
      { Code: 'MET-DEV', Intitulé: 'Développeur', Description: 'Développement logiciel' },
      { Code: 'MET-COMPTA', Intitulé: 'Comptable', Description: '' },
    ],
  }
}
