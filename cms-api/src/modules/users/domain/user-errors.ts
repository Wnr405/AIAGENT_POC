import { ConflictError } from '../../../shared/kernel/errors';

/** FR-USER-04: the system must always keep at least one active Admin. */
export class LastAdminError extends ConflictError {
  constructor() {
    super('The last active Admin cannot be removed, deactivated or demoted');
  }
}

export class EmailTakenError extends ConflictError {
  constructor() {
    super('A user with this email already exists', { field: 'email' });
  }
}
