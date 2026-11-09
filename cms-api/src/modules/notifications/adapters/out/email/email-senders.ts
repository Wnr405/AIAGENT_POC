import nodemailer, { type Transporter } from 'nodemailer';
import type { Logger } from '../../../../../shared/ports/logger.port';
import type { EmailMessage, EmailSender } from '../../../application/ports/out/email-sender.port';

/** SES via SMTP or any SMTP relay (02-SRS §4.2). */
export class SmtpEmailSender implements EmailSender {
  private readonly transport: Transporter;

  constructor(
    cfg: { host: string; port: number; secure: boolean; user?: string; password?: string },
    private readonly from: string,
  ) {
    this.transport = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: cfg.user ? { user: cfg.user, pass: cfg.password } : undefined,
    });
  }

  async send(m: EmailMessage): Promise<void> {
    await this.transport.sendMail({ from: this.from, to: m.to, subject: m.subject, text: m.text, html: m.html });
  }
}

/**
 * Development only: prints the email (including the link) to the log so the
 * invite / reset flows can be exercised without an SMTP server.
 */
export class ConsoleEmailSender implements EmailSender {
  constructor(private readonly logger: Logger) {}

  send(m: EmailMessage): Promise<void> {
    this.logger.info('DEV EMAIL (not sent)', { devEmail: { to: m.to, subject: m.subject, text: m.text } });
    return Promise.resolve();
  }
}
