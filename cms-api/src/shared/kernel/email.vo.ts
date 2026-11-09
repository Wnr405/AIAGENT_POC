import { ValidationError } from './errors';

/**
 * Email value object (FR-USER-07). Practical RFC 5322 subset: dot-atom local
 * part, domain with at least one dot, total length ≤ 254. Normalised to lower case.
 */
const LOCAL = "[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*";
const LABEL = '[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?';
const EMAIL_RE = new RegExp(`^${LOCAL}@${LABEL}(?:\\.${LABEL})+$`);

export class Email {
  private constructor(public readonly value: string) {}

  static create(input: string): Email {
    const normalized = input.trim().toLowerCase();
    const local = normalized.replace(/@.*$/s, '');
    if (normalized.length > 254 || local.length > 64 || !EMAIL_RE.test(normalized)) {
      throw new ValidationError('Invalid email address', { field: 'email' });
    }
    return new Email(normalized);
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }
}
