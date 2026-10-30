import type { TFunction } from 'i18next'
import { ApiError } from './api'

/** Maps an API failure to a translated message via `errors.<CODE>`, falling back to a generic one. */
export function errorMessage(t: TFunction, e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code !== 'HTTP_ERROR') {
      const key = `errors.${e.code}`
      const msg = t(key, { defaultValue: '' })
      if (msg) return msg
    }
    if (e.status === 400) return t('errors.VALIDATION')
    if (e.status === 429) return t('errors.TOO_MANY_ATTEMPTS')
  }
  return t('errors.generic')
}
