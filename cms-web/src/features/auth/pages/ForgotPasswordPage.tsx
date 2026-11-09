import { Alert, Button, Link as MuiLink, Stack, TextField } from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { errorMessage } from '../../../shared/api/error-message';
import { t } from '../../../shared/i18n/t';
import { authApi } from '../api/auth.api';
import { AuthCard } from '../components/AuthCard';

/** FR-AUTH-07: same confirmation whether or not the account exists. */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const send = useMutation({ mutationFn: () => authApi.forgot(email) });
  return (
    <AuthCard title={t('auth.forgotTitle')} subtitle={t('auth.forgotBody')}>
      <Stack
        component="form"
        spacing={2}
        onSubmit={(e) => {
          e.preventDefault();
          send.mutate();
        }}
      >
        {send.isSuccess && <Alert severity="success">{t('auth.linkSent')}</Alert>}
        {send.isError && <Alert severity="error">{errorMessage(send.error)}</Alert>}
        <TextField label={t('auth.email')} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button type="submit" variant="contained" disabled={send.isPending || !email}>
          {t('auth.sendLink')}
        </Button>
        <MuiLink component={Link} to="/login" variant="body2">
          {t('auth.backToLogin')}
        </MuiLink>
      </Stack>
    </AuthCard>
  );
}
