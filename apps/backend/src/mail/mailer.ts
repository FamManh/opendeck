export const MAILER = Symbol('MAILER')
export interface Mailer { send(to: string, subject: string, body: string): Promise<void> }
