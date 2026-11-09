import type { EmailSender } from '../ports/out/email-sender.port';
import { inviteEmail, passwordResetEmail } from './templates';

/**
 * Sends auth emails. Structurally satisfies the auth module's AuthMailer port;
 * the composition root plugs it in (no direct module-to-module import).
 */
export class EmailAuthMailer {
  constructor(
    private readonly sender: EmailSender,
    private readonly appName: string,
  ) {}

  sendInvite(to: { email: string; name: string }, link: string): Promise<void> {
    return this.sender.send(inviteEmail(to, link, this.appName));
  }

  sendPasswordReset(to: { email: string; name: string }, link: string): Promise<void> {
    return this.sender.send(passwordResetEmail(to, link, this.appName));
  }
}
