import { createTransport, type Transporter } from 'nodemailer'
import type { Mailer } from './mailer'

export class SmtpMailer implements Mailer {
  private readonly transport: Transporter

  constructor(url: string, private readonly from: string) {
    this.transport = createTransport(url)
  }

  async send(to: string, subject: string, body: string): Promise<void> {
    await this.transport.sendMail({ from: this.from, to, subject, text: body })
  }
}
