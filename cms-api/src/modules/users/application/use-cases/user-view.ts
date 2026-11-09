import type { User } from '../../domain/user.entity';
import type { UserView } from '../ports/in/users.ports';

export function toUserView(user: User): UserView {
  return {
    id: user.id,
    email: user.email.value,
    name: user.name,
    role: user.role,
    status: user.status,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}
