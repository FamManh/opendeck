import { Injectable, Logger } from '@nestjs/common'
import type { Mailer } from './mailer'

/** Dev mailer: chưa có SMTP, chỉ log thư ra console. */
@Injectable()
export class ConsoleMailer implements Mailer {
  private readonly log = new Logger('Mail')
  async send(to: string, subject: string, body: string): Promise<void> {
    this.log.log(`to=${to} subject=${subject}\n${body}`)
  }
}
