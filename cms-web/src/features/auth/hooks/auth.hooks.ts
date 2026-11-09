import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '../../../shared/stores/session.store';
import { authApi } from '../api/auth.api';

export function useLogin() {
  const setSession = useSessionStore((s) => s.setSession);
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => authApi.login(email, password),
    onSuccess: (r) => setSession(r.accessToken, r.user),
  });
}

export function useLogout() {
  const clear = useSessionStore((s) => s.clear);
  const qc = useQueryClient();
  const navigate = useNavigate();
  return (reason: 'logout' | 'idle' = 'logout') =>
    authApi.logout().finally(() => {
      clear(reason);
      qc.clear();
      navigate('/login', { replace: true });
    });
}
