// Textes de l'alerte "effectif demande superieur aux places restantes du poste"
// d'une expression de besoin. Purement informatifs : l'alerte ne bloque jamais
// la demande, elle est seulement affichee partout ou la demande apparait.

export function availableSlotsHint(available: number, capacity: number): string {
  return `Places disponibles sur ce poste : ${available} sur ${capacity}`
}

export function capacityWarningText(headcount: number, available: number, capacity: number): string {
  return `L'effectif demandé (${headcount}) dépasse les places disponibles sur ce poste (${available} sur ${capacity}). La demande reste possible mais elle est signalée.`
}
