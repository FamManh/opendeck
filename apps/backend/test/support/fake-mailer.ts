import type { Mailer } from '../../src/mail/mailer'

export class FakeMailer implements Mailer {
  readonly sent: { to: string; subject: string; body: string }[] = []
  async send(to: string, subject: string, body: string): Promise<void> { this.sent.push({ to, subject, body }) }
}
