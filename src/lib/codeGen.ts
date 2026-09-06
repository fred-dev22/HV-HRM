// Suggere un code court a partir d'un nom + le nombre d'elements du meme
// type deja existants (ex: "Comptable Senior" + 3 postes existants ->
// "COMP-SENI-004"). Reste une simple suggestion : toujours affichee dans un
// champ modifiable, jamais imposee (voir decision du 25/07 sur les codes des
// ecrans de configuration - Entite/Metier/Poste/Categorie/Type de frais).
export function suggestCode(name: string, existingCount: number): string {
  const words = name
    .toUpperCase()
    .replace(/[^A-Z0-9 -]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  const prefix = words.slice(0, 2).map(w => w.slice(0, 4)).join('-') || 'REF'
  return `${prefix}-${String(existingCount + 1).padStart(3, '0')}`
}
