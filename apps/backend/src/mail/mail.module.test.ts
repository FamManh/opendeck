import { ConsoleMailer } from './console.mailer'
import { createMailer } from './mail.module'
import { SmtpMailer } from './smtp.mailer'

test('dev without SMTP_URL logs to the console', () => {
  expect(createMailer({ NODE_ENV: 'development' })).toBeInstanceOf(ConsoleMailer)
})
test('SMTP_URL selects the real mailer', () => {
  expect(createMailer({ SMTP_URL: 'smtp://user:pass@localhost:587' })).toBeInstanceOf(SmtpMailer)
})
test('production without SMTP_URL refuses to start', () => {
  expect(() => createMailer({ NODE_ENV: 'production' })).toThrow('SMTP_URL is required')
})
