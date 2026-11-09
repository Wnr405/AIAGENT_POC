import { Alert, Button, Link as MuiLink, Stack, TextField } from '@mui/material';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { errorMessage } from '../../../shared/api/error-message';
import { ApiError } from '../../../shared/api/api-error';
import { t } from '../../../shared/i18n/t';
import { useSessionStore } from '../../../shared/stores/session.store';
import { AuthCard } from '../components/AuthCard';
import { useLogin } from '../hooks/auth.hooks';

/** 401 → the server's generic message (no lockout disclosure, FR-AUTH-06); anything else → friendly text. */
function failureMessage(error: unknown): string | null {
  if (!error) return null;
  return error instanceof ApiError && error.status === 401 ? error.message : errorMessage(error);
}

/** FR-AUTH-01. Shows the generic server message on failure (no lockout disclosure). */
export function LoginPage() {
  const status = useSessionStore((s) => s.status);
  const endReason = useSessionStore((s) => s.endReason);
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/';
  const login = useLogin();
  const { register, handleSubmit, formState } = useForm<{ email: string; password: string }>();

  if (status === 'authenticated') return <Navigate to={from} replace />;
  const failure = failureMessage(login.error);
  const sessionEnded = (endReason === 'expired' || endReason === 'idle') && !failure;

  return (
    <AuthCard title={t('auth.title')} subtitle={t('auth.subtitle')}>
      <Stack component="form" spacing={2} noValidate onSubmit={(e) => void handleSubmit((v) => login.mutate(v))(e)}>
        {sessionEnded && <Alert severity="info">{t('errors.sessionExpired')}</Alert>}
        {failure && (
          <Alert severity="error" role="alert">
            {failure}
          </Alert>
        )}
        <TextField
          label={t('auth.email')}
          type="email"
          autoComplete="username"
          {...register('email', { required: t('common.required') })}
          error={!!formState.errors.email}
          helperText={formState.errors.email?.message}
        />
        <TextField
          label={t('auth.password')}
          type="password"
          autoComplete="current-password"
          {...register('password', { required: t('common.required') })}
          error={!!formState.errors.password}
          helperText={formState.errors.password?.message}
        />
        <Button type="submit" variant="contained" size="large" disabled={login.isPending}>
          {t('auth.signIn')}
        </Button>
        <MuiLink component={Link} to="/forgot-password" variant="body2">
          {t('auth.forgot')}
        </MuiLink>
      </Stack>
    </AuthCard>
  );
}
