import type { CookieOptions, Response } from 'express'

export const GID_COOKIE = 'gid'
const YEAR_MS = 365 * 24 * 60 * 60_000

export function signedCookieOptions(maxAgeMs: number): CookieOptions {
  return { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', signed: true, maxAge: maxAgeMs }
}

export function setGuestCookie(res: Response, guestId: string): void {
  res.cookie(GID_COOKIE, guestId, signedCookieOptions(YEAR_MS))
}
