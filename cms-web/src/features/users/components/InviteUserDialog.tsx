import { Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField } from '@mui/material';
import { useForm } from 'react-hook-form';
import { t } from '../../../shared/i18n/t';
import type { Role } from '../../../shared/stores/session.store';

export interface InviteValues {
  email: string;
  name: string;
  role: Role;
}

/** UR-A01: email + name + role. Server-side field errors are passed back in `serverErrors`. */
export function InviteUserDialog({
  open,
  busy,
  serverErrors,
  onClose,
  onSubmit,
}: {
  open: boolean;
  busy: boolean;
  serverErrors: Record<string, string>;
  onClose: () => void;
  onSubmit: (v: InviteValues) => void;
}) {
  const { register, handleSubmit, formState, reset } = useForm<InviteValues>({ defaultValues: { email: '', name: '', role: 'author' } });
  const close = () => {
    reset();
    onClose();
  };
  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="sm" aria-labelledby="invite-title">
      <form noValidate onSubmit={(e) => void handleSubmit(onSubmit)(e)}>
        <DialogTitle id="invite-title">{t('users.invite')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t('users.email')}
              type="email"
              {...register('email', { required: t('common.required') })}
              error={!!formState.errors.email || !!serverErrors['email']}
              helperText={formState.errors.email?.message ?? serverErrors['email']}
            />
            <TextField
              label={t('users.name')}
              {...register('name', { required: t('common.required'), maxLength: 120 })}
              error={!!formState.errors.name}
              helperText={formState.errors.name?.message}
            />
            <TextField select label={t('users.role')} defaultValue="author" {...register('role')}>
              {(['author', 'editor', 'admin'] as const).map((r) => (
                <MenuItem key={r} value={r}>
                  {t(`users.roles.${r}`)}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={close}>{t('common.cancel')}</Button>
          <Button type="submit" variant="contained" disabled={busy}>
            {t('users.invite')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
