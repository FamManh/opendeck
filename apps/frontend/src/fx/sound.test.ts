import { expect, test, vi } from 'vitest'
import { SoundBank } from './sound'

const makeCtx = () => {
  const start = vi.fn()
  const ctx = {
    sampleRate: 8000,
    destination: {} as AudioDestinationNode,
    resume: vi.fn().mockResolvedValue(undefined),
    createBuffer: vi.fn((_c: number, len: number) => ({ getChannelData: () => new Float32Array(len) }) as unknown as AudioBuffer),
    createBufferSource: vi.fn(() => ({ connect: vi.fn(), start, buffer: null })),
  }
  return { ctx, start }
}

test('nothing is created before unlock; play is a silent no-op', () => {
  const factory = vi.fn()
  const bank = new SoundBank(factory)
  expect(() => bank.play('drum')).not.toThrow()
  expect(factory).not.toHaveBeenCalled()
})

test('unlock synthesizes the sounds and play starts a source', async () => {
  const { ctx, start } = makeCtx()
  const bank = new SoundBank(() => ctx as never)
  await bank.unlock()
  expect(ctx.resume).toHaveBeenCalled()
  expect(ctx.createBuffer).toHaveBeenCalledTimes(8)
  bank.play('flip')
  expect(start).toHaveBeenCalledTimes(1)
})

test('a broken audio context does not throw and plays nothing', async () => {
  const bank = new SoundBank(() => { throw new Error('no audio') })
  await expect(bank.unlock()).resolves.toBeUndefined()
  expect(() => bank.play('drum')).not.toThrow()
})
