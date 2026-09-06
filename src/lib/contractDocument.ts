/**
 * Generation du document d'un contrat (apercu ecran + "PDF"), module
 * Recrutement. Pas de bibliotheque PDF ni de backend : le contrat resolu est
 * un document HTML autonome (styles inline, aucune dependance au CSS de
 * l'appli) — utilise a la fois dans un <iframe srcdoc> pour l'apercu ecran
 * (ContractCard.vue, TrialEmployeeCard.vue) et ouvert dans un nouvel onglet
 * pour l'impression : "Enregistrer au format PDF" dans le dialogue
 * d'impression du navigateur produit un vrai fichier PDF, sans service
 * externe. Feasible des maintenant, sans attendre le backend du module.
 */

export interface ContractDocumentInput {
  candidateName: string
  jobTitle: string
  entityName: string
  templateName: string
  /** Contenu du modele deja resolu (placeholders remplaces), voir resolveContractContent */
  resolvedContent: string
}

// Remplace les placeholders {{...}} d'un modele de contrat (voir
// ContractTemplate.content) par les valeurs reelles du contrat genere —
// seule logique de resolution du module, partagee par tous les apercus.
// endDate est optionnel : absent pour un CDI (duree indeterminee), fourni
// pour tout autre type (voir ContractsView.vue).
export function resolveContractContent(
  content: string,
  vars: { candidateName: string; jobTitle: string; entityName: string; startDate: string; salary: string; endDate?: string },
): string {
  return content
    .replaceAll('{{nom_candidat}}', vars.candidateName)
    .replaceAll('{{poste}}', vars.jobTitle)
    .replaceAll('{{entite}}', vars.entityName)
    .replaceAll('{{date_debut}}', vars.startDate)
    .replaceAll('{{date_fin}}', vars.endDate ?? '')
    .replaceAll('{{salaire}}', vars.salary)
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function buildContractHtml(doc: ContractDocumentInput): string {
  const paragraphs = doc.resolvedContent
    .split(/\n{2,}/)
    .map(p => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('')

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>${escapeHtml(doc.templateName)} — ${escapeHtml(doc.candidateName)}</title>
<style>
  /* Force le portrait dans le dialogue d'impression — sans ça, certains
     navigateurs reprennent l'orientation du dernier document imprime
     (souvent paysage), quelle que soit la mise en page de celui-ci. */
  @page { size: A4 portrait; margin: 0; }
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0; background: #eef2f1; font-family: Georgia, 'Times New Roman', serif; color: #1f2937; }
  .page { max-width: 210mm; min-height: 290mm; margin: 24px auto; background: #fff; padding: 20mm 20mm 16mm; box-shadow: 0 2px 20px rgba(0,0,0,0.14); }
  .header { display: flex; align-items: center; gap: 14px; border-bottom: 2px solid #0f6b45; padding-bottom: 16px; margin-bottom: 30px; }
  .header img { height: 40px; }
  .header .company { font-family: Arial, Helvetica, sans-serif; }
  .header .company .name { font-size: 15px; font-weight: 700; letter-spacing: 0.05em; color: #111827; }
  .header .company .tagline { font-size: 10px; color: #6b7280; margin-top: 2px; }
  h1 { font-family: Arial, Helvetica, sans-serif; font-size: 15px; letter-spacing: 0.06em; text-transform: uppercase; text-align: center; margin: 0 0 6px; color: #111827; }
  .subtitle { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #6b7280; text-align: center; margin: 0 0 34px; }
  .body p { font-size: 13px; line-height: 1.9; text-align: justify; margin: 0 0 14px; }
  .signatures { display: flex; justify-content: space-between; gap: 40px; margin-top: 64px; }
  .signatures .block { flex: 1; font-family: Arial, Helvetica, sans-serif; font-size: 11px; }
  .signatures .block .role { font-weight: 700; margin-bottom: 48px; color: #111827; }
  .signatures .line { border-top: 1px solid #1f2937; padding-top: 4px; color: #6b7280; }
  @media print {
    body { background: #fff; }
    .page { box-shadow: none; margin: 0; max-width: none; min-height: auto; padding: 12mm 16mm; }
  }
</style>
</head>
<body>
  <div class="page">
    <div class="header">
      <img src="/hv-logo.png" alt="HV">
      <div class="company">
        <div class="name">HV</div>
        <div class="tagline">Ressources Humaines</div>
      </div>
    </div>
    <h1>${escapeHtml(doc.templateName)}</h1>
    <p class="subtitle">${escapeHtml(doc.candidateName)} — ${escapeHtml(doc.jobTitle)} — ${escapeHtml(doc.entityName)}</p>
    <div class="body">${paragraphs}</div>
    <div class="signatures">
      <div class="block">
        <div class="role">Pour HV</div>
        <div class="line">Nom, fonction et signature</div>
      </div>
      <div class="block">
        <div class="role">Le salarié</div>
        <div class="line">${escapeHtml(doc.candidateName)} — précédé de la mention « Lu et approuvé »</div>
      </div>
    </div>
  </div>
</body>
</html>`
}

// Ouvre le document dans un nouvel onglet et lance l'impression — c'est là
// que l'utilisateur choisit "Enregistrer au format PDF" comme destination
// dans le dialogue du navigateur pour obtenir un vrai fichier telecharge.
// Nouvel onglet plutot qu'impression de la page courante : evite tout
// conflit avec le CSS/la mise en page de l'appli (sidebar, modale…), le
// document est totalement autonome.
export function downloadContractPdf(doc: ContractDocumentInput): void {
  const win = window.open('', '_blank')
  if (!win) return
  win.document.open()
  win.document.write(buildContractHtml(doc))
  win.document.close()
  win.addEventListener('load', () => { win.focus(); win.print() })
}
