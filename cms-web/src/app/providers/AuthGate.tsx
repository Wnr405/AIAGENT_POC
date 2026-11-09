import { useEffect, useMemo, type ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { LoadingBlock } from '../../design-system/components';
import { refreshSession } from '../../shared/api/session';
import { useObservable } from '../../shared/hooks/useObservable';
import { t } from '../../shared/i18n/t';
import { notify } from '../../shared/stores/ui.store';
import { useSessionStore, type Role } from '../../shared/stores/session.store';
import { domActivity$, idleState$ } from '../../shared/streams/idle-session.stream';
import { useLogout } from '../../features/auth/hooks/auth.hooks';

/**
 * Restores the session from the refresh cookie on first load, protects every
 * child route, and enforces the 30-minute idle timeout (SEC-12).
 */
export function AuthGate() {
  const status = useSessionStore((s) => s.status);
  const location = useLocation();
  const logout = useLogout();
  const idle$ = useMemo(() => idleState$(domActivity$()), []);
  const idle = useObservable(idle$, 'active');

  useEffect(() => {
    if (status === 'unknown') void refreshSession();
  }, [status]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    if (idle === 'warning') notify.info(t('errors.idleWarning'));
    if (idle === 'idle') void logout('idle');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- react only to idle-state transitions
  }, [idle]);

  if (status === 'unknown') return <LoadingBlock label={t('app.loading')} />;
  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

/** Route-level role check (the API enforces it again). */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const role = useSessionStore((s) => s.user?.role);
  return role && roles.includes(role) ? <>{children}</> : <Navigate to="/" replace />;
}
