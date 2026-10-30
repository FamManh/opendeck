export const CMD_MAX_PER_WINDOW = 10
export const CMD_WINDOW_MS = 1000

/** Tối đa 10 cmd/giây mỗi socket (cửa sổ trượt, đo bằng đồng hồ thật vì đây là chống spam, không phải thời gian nghiệp vụ). */
export class CmdRateLimiter {
  private readonly hits = new Map<string, number[]>()

  constructor(private readonly now: () => number = () => performance.now(), private readonly max = CMD_MAX_PER_WINDOW, private readonly windowMs = CMD_WINDOW_MS) {}

  allow(socketId: string): boolean {
    const t = this.now()
    const recent = (this.hits.get(socketId) ?? []).filter(h => h > t - this.windowMs)
    const ok = recent.length < this.max
    if (ok) recent.push(t)
    this.hits.set(socketId, recent)
    return ok
  }

  forget(socketId: string): void {
    this.hits.delete(socketId)
  }
}
