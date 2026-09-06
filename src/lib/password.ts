// Mot de passe temporaire généré côté client pour la création d'un compte
// utilisateur — jamais envoyé ailleurs qu'à POST /users, affiché une seule
// fois à l'admin RH. Garantit au moins un caractère de chaque catégorie pour
// satisfaire un minimum de complexité raisonnable.
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const LOWER = 'abcdefghijkmnopqrstuvwxyz'
const DIGITS = '23456789'
const SYMBOLS = '!@#$%*?'
const ALL = UPPER + LOWER + DIGITS + SYMBOLS

function randomChar(charset: string): string {
  const bytes = new Uint32Array(1)
  crypto.getRandomValues(bytes)
  return charset[bytes[0]! % charset.length]!
}

function shuffle(chars: string[]): string[] {
  const bytes = new Uint32Array(chars.length)
  crypto.getRandomValues(bytes)
  return chars
    .map((c, i) => ({ c, sort: bytes[i]! }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ c }) => c)
}

export function generatePassword(length = 12): string {
  const required = [randomChar(UPPER), randomChar(LOWER), randomChar(DIGITS), randomChar(SYMBOLS)]
  const rest = Array.from({ length: Math.max(length - required.length, 0) }, () => randomChar(ALL))
  return shuffle([...required, ...rest]).join('')
}
