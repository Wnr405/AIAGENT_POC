/**
 * Outbound port: after an invite is created, someone must issue an invite
 * token and email it. Implemented in the composition root by delegating to the
 * auth module's IssueOneTimeToken use case (cross-module via inbound port).
 */
export interface UserInvitationNotifier {
  invitationCreated(user: { id: string; email: string; name: string }): Promise<void>;
  passwordResetRequestedByAdmin(user: { id: string; email: string; name: string }): Promise<void>;
}
