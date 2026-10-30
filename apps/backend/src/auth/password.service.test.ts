import { PasswordService } from './password.service'

const svc = new PasswordService()

test('hash is argon2id and never contains plaintext', async () => {
  const h = await svc.hash('correct horse')
  expect(h.startsWith('$argon2id$')).toBe(true)
  expect(h).not.toContain('correct horse')
})

test('verify accepts the right password and rejects others', async () => {
  const h = await svc.hash('correct horse')
  expect(await svc.verify(h, 'correct horse')).toBe(true)
  expect(await svc.verify(h, 'wrong horse')).toBe(false)
})

test('verify returns false on a malformed hash instead of throwing', async () => {
  expect(await svc.verify('not-a-hash', 'x')).toBe(false)
})
