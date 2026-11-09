import type { PageRequest, PagedResult } from '../../../../../shared/kernel/paged-result';
import type { Role } from '../../../../../shared/kernel/role';
import type { User, UserStatus } from '../../../domain/user.entity';

export interface UserSearchCriteria {
  readonly search?: string; // name or email, case-insensitive partial
  readonly role?: Role;
  readonly status?: UserStatus;
}

export interface UserRepository {
  save(user: User): Promise<void>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findMany(criteria: UserSearchCriteria, page: PageRequest): Promise<PagedResult<User>>;
  countActiveAdmins(): Promise<number>;
  /** Display names for attribution (dashboard, content lists, audit). */
  namesByIds(ids: readonly string[]): Promise<Map<string, string>>;
}
