import { t } from '../../shared/i18n/t';

/** Client-side mirror of FR-AUTH-02 for instant feedback (the server remains authoritative). */
export function passwordProblems(pw: string): string | null {
  const ok = pw.length >= 12 && pw.length <= 256 && /\p{L}/u.test(pw) && /\p{Nd}/u.test(pw);
  return ok ? null : t('auth.passwordHelp');
}
