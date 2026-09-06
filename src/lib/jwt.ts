export interface JwtPayload {
  sub: string        // User.Id
  employeeId: string
  categoryName: string
  mustChangePassword: boolean
  iat: number
  exp: number
}

// Client-side decode only — never trust this for authorization decisions,
// the backend re-validates the signature on every request. This just reads
// the payload to avoid an extra round-trip after login.
export function decodeJwt(token: string): JwtPayload {
  const base64Url = token.split('.')[1]
  if (!base64Url) throw new Error('Jeton invalide')
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
  const json = decodeURIComponent(
    atob(base64)
      .split('')
      .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
      .join(''),
  )
  return JSON.parse(json)
}

export function isTokenExpired(payload: JwtPayload): boolean {
  return Date.now() >= payload.exp * 1000
}
