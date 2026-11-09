import { Alert, Button, Link as MuiLink, Stack, TextField } from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router-dom';
import { errorMessage } from '../../../shared/api/error-message';
import { t } from '../../../shared/i18n/t';
import { authApi } from '../api/auth.api';
import { AuthCard } from '../components/AuthCard';
import { passwordProblems } from '../password-rules';

/** Shared by /reset-password (FR-AUTH-07) and /accept-invite (FR-USER-02). */
export function SetPasswordPage({ mode }: { mode: 'reset' | 'invite' }) {
  const token = useSearchParams()[0].get('token') ?? '';
  const { register, handleSubmit, watch, formState } = useForm<{ password: string; confirm: string }>({ mode: 'onBlur' });
  const submit = useMutation({
    mutationFn: (pw: string) => (mode === 'reset' ? authApi.reset(token, pw) : authApi.acceptInvite(token, pw)),
  });
  const serverError = submit.error ? errorMessage(submit.error) : null;

  return (
    <AuthCard title={mode === 'reset' ? t('auth.forgotTitle') : t('auth.acceptInviteTitle')} subtitle={t('auth.passwordHelp')}>
      {submit.isSuccess ? (
        <Stack spacing={2}>
          <Alert severity="success">{t('auth.passwordSet')}</Alert>
          <Button component={Link} to="/login" variant="contained">
            {t('auth.signIn')}
          </Button>
        </Stack>
      ) : (
        <Stack component="form" spacing={2} noValidate onSubmit={(e) => void handleSubmit((v) => submit.mutate(v.password))(e)}>
          {serverError && (
            <Alert severity="error" role="alert">
              {serverError}
            </Alert>
          )}
          <TextField
            label={t('auth.newPassword')}
            type="password"
            autoComplete="new-password"
            {...register('password', { validate: (v) => passwordProblems(v) ?? true })}
            error={!!formState.errors.password}
            helperText={formState.errors.password?.message ?? t('auth.passwordHelp')}
          />
          <TextField
            label={t('auth.confirmPassword')}
            type="password"
            autoComplete="new-password"
            {...register('confirm', { validate: (v) => v === watch('password') || t('auth.passwordMismatch') })}
            error={!!formState.errors.confirm}
            helperText={formState.errors.confirm?.message}
          />
          <Button type="submit" variant="contained" disabled={submit.isPending || !token}>
            {t('auth.setPassword')}
          </Button>
          <MuiLink component={Link} to="/login" variant="body2">
            {t('auth.backToLogin')}
          </MuiLink>
        </Stack>
      )}
    </AuthCard>
  );
}
