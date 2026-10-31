import { Global, Module } from '@nestjs/common'
import { ConsoleMailer } from './console.mailer'
import { MAILER, type Mailer } from './mailer'
import { SmtpMailer } from './smtp.mailer'

/** Có `SMTP_URL` thì gửi thật. Production thiếu biến này thì không khởi động, để quên mật khẩu không âm thầm mất thư. */
export function createMailer(env: NodeJS.ProcessEnv = process.env): Mailer {
  if (env.SMTP_URL) return new SmtpMailer(env.SMTP_URL, env.MAIL_FROM ?? 'Planning Poker <no-reply@localhost>')
  if (env.NODE_ENV === 'production') throw new Error('SMTP_URL is required in production')
  return new ConsoleMailer()
}

@Global()
@Module({ providers: [{ provide: MAILER, useFactory: () => createMailer() }], exports: [MAILER] })
export class MailModule {}
