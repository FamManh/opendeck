const DEV_SECRET = 'opendeck-dev-cookie-secret'

/** Khoá ký cookie `gid` và `rj_<slug>`; production bắt buộc đặt COOKIE_SECRET. */
export function cookieSecret(): string {
  const s = process.env.COOKIE_SECRET
  if (s) return s
  if (process.env.NODE_ENV === 'production') throw new Error('COOKIE_SECRET is required in production')
  return DEV_SECRET
}
