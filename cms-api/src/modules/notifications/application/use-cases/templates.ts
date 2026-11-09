import { escapeHtml } from '../../../../shared/kernel/html';
import type { EmailMessage } from '../ports/out/email-sender.port';

/** CN-02: English-only for MVP; strings kept here so they can be externalised later. */
export function inviteEmail(to: { email: string; name: string }, link: string, appName: string): EmailMessage {
  return {
    to: to.email,
    subject: `You're invited to ${appName}`,
    text: `Hi ${to.name},\n\nYou have been invited to ${appName}. Set your password within 7 days:\n${link}\n\nIf you did not expect this email you can ignore it.`,
    html: `<p>Hi ${escapeHtml(to.name)},</p><p>You have been invited to ${escapeHtml(appName)}. Set your password within 7 days:</p><p><a href="${escapeHtml(link)}">Accept invitation</a></p><p>If you did not expect this email you can ignore it.</p>`,
  };
}

export function passwordResetEmail(to: { email: string; name: string }, link: string, appName: string): EmailMessage {
  return {
    to: to.email,
    subject: `Reset your ${appName} password`,
    text: `Hi ${to.name},\n\nUse this link within 60 minutes to choose a new password:\n${link}\n\nIf you did not request a reset, ignore this email — your password is unchanged.`,
    html: `<p>Hi ${escapeHtml(to.name)},</p><p>Use this link within 60 minutes to choose a new password:</p><p><a href="${escapeHtml(link)}">Reset password</a></p><p>If you did not request a reset, ignore this email — your password is unchanged.</p>`,
  };
}
