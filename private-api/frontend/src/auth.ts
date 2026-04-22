const TOKEN_KEY = 'rpacm-admin-token'

export type TokenPayload = {
  username: string
  exp: number
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // Ignore quota / privacy-mode errors; user will just be asked to log in again.
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Ignore.
  }
}

/** Decode a JWT payload without verifying the signature. Returns `null` on malformed input. */
export function decodeJwt(token: string): TokenPayload | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const raw = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = raw + '='.repeat((4 - (raw.length % 4)) % 4)
    const json = atob(padded)
    const data = JSON.parse(
      decodeURIComponent(
        json
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join(''),
      ),
    )
    if (
      data &&
      typeof data === 'object' &&
      typeof data.username === 'string' &&
      typeof data.exp === 'number'
    ) {
      return { username: data.username, exp: data.exp }
    }
    return null
  } catch {
    return null
  }
}

/** Whether a token is non-null and not yet expired (with 5s clock skew allowance). */
export function isTokenValid(token: string | null): boolean {
  if (!token) return false
  const payload = decodeJwt(token)
  if (!payload) return false
  const nowSec = Math.floor(Date.now() / 1000)
  return payload.exp - 5 > nowSec
}
