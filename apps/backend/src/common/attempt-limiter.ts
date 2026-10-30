import type { Clock } from './clock'

/** Đếm số lần thất bại theo key trong cửa sổ trượt. Lưu trong bộ nhớ (một instance server). */
export class AttemptLimiter {
  private readonly failures = new Map<string, number[]>()

  constructor(private readonly max: number, private readonly windowMs: number, private readonly now: Clock) {}

  isBlocked(key: string): boolean {
    return this.recent(key).length >= this.max
  }

  recordFailure(key: string): void {
    const list = this.recent(key)
    list.push(this.now())
    this.failures.set(key, list)
  }

  reset(key: string): void {
    this.failures.delete(key)
  }

  private recent(key: string): number[] {
    const cutoff = this.now() - this.windowMs
    const list = (this.failures.get(key) ?? []).filter(t => t > cutoff)
    if (list.length === 0) this.failures.delete(key)
    else this.failures.set(key, list)
    return list
  }
}
