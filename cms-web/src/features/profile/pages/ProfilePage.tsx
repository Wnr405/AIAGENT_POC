import { Box, Button, Card, CardContent, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { PageHeader } from '../../../design-system/components';
import { api } from '../../../shared/api/client';
import { ApiError } from '../../../shared/api/api-error';
import { errorMessage } from '../../../shared/api/error-message';
import { t } from '../../../shared/i18n/t';
import { selectUser, useSessionStore } from '../../../shared/stores/session.store';
import { notify, useUiStore, type ThemeMode } from '../../../shared/stores/ui.store';

/** 03-DESIGN §12.9: account info, change password (revokes sessions), theme. */
export function ProfilePage() {
  const user = useSessionStore(selectUser);
  const clear = useSessionStore((s) => s.clear);
  const mode = useUiStore((s) => s.themeMode);
  const setMode = useUiStore((s) => s.setThemeMode);
  const { register, handleSubmit, setError, formState } = useForm<{ currentPassword: string; newPassword: string }>();
  const change = useMutation({
    mutationFn: (v: { currentPassword: string; newPassword: string }) => api.post('/admin/auth/me/password', v),
    onSuccess: () => { notify.success(t('profile.passwordChanged')); clear('logout'); },
    onError: (err) => {
      if (err instanceof ApiError) for (const [f, m] of Object.entries(err.fieldErrors())) if (f === 'currentPassword' || f === 'password') setError(f === 'password' ? 'newPassword' : f, { message: m });
      notify.error(errorMessage(err));
    },
  });
  return (
    <Box>
      <PageHeader title={t('profile.title')} />
      <Stack spacing={3} sx={{ maxWidth: 560 }}>
        <Card><CardContent>
          <Typography variant="h5" component="h2">{t('profile.account')}</Typography>
          <Typography>{user?.name}</Typography>
          <Typography color="text.secondary">{user?.email} · {user ? t(`users.roles.${user.role}`) : ''}</Typography>
        </CardContent></Card>
        <Card><CardContent>
          <Typography variant="h5" component="h2" sx={{ mb: 2 }}>{t('profile.changePassword')}</Typography>
          <Stack component="form" spacing={2} noValidate onSubmit={(e) => void handleSubmit((v) => change.mutate(v))(e)}>
            <TextField type="password" autoComplete="current-password" label={t('profile.currentPassword')} {...register('currentPassword', { required: t('common.required') })} error={!!formState.errors.currentPassword} helperText={formState.errors.currentPassword?.message} />
            <TextField type="password" autoComplete="new-password" label={t('auth.newPassword')} {...register('newPassword', { required: t('common.required') })} error={!!formState.errors.newPassword} helperText={formState.errors.newPassword?.message ?? t('auth.passwordHelp')} />
            <div><Button type="submit" variant="contained" disabled={change.isPending}>{t('profile.changePassword')}</Button></div>
          </Stack>
        </CardContent></Card>
        <Card><CardContent>
          <Typography variant="h5" component="h2" sx={{ mb: 2 }}>{t('profile.theme')}</Typography>
          <ToggleButtonGroup exclusive value={mode} onChange={(_, v: ThemeMode | null) => v && setMode(v)} aria-label={t('profile.theme')}>
            <ToggleButton value="light">{t('profile.light')}</ToggleButton>
            <ToggleButton value="dark">{t('profile.dark')}</ToggleButton>
            <ToggleButton value="system">{t('profile.system')}</ToggleButton>
          </ToggleButtonGroup>
        </CardContent></Card>
      </Stack>
    </Box>
  );
}
