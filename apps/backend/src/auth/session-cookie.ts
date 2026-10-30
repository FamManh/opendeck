import type { CookieOptions, Response } from 'express'

export const SID_COOKIE = 'sid'

function baseOptions(): CookieOptions {
  return { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' }
}

export function setSessionCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(SID_COOKIE, token, { ...baseOptions(), expires: expiresAt })
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SID_COOKIE, baseOptions())
}
