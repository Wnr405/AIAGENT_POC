import {
  Box,
  Card,
  Chip,
  Fab,
  IconButton,
  Menu,
  MenuItem,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material';
import PersonAdd from '@mui/icons-material/PersonAddRounded';
import MoreVertIcon from '@mui/icons-material/MoreVertRounded';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ConfirmDialog, LoadingBlock, PageHeader } from '../../../design-system/components';
import { ApiError } from '../../../shared/api/api-error';
import { errorMessage } from '../../../shared/api/error-message';
import { t } from '../../../shared/i18n/t';
import { notify } from '../../../shared/stores/ui.store';
import type { Role } from '../../../shared/stores/session.store';
import { formatRelative } from '../../../shared/utils/format';
import { usersApi, type UserRow } from '../api/users.api';
import { InviteUserDialog } from '../components/InviteUserDialog';

/** 03-DESIGN §12.6 — Admin only (route-guarded + API-enforced). */
export function UsersPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [menu, setMenu] = useState<{ anchor: HTMLElement; user: UserRow } | null>(null);
  const [confirm, setConfirm] = useState<UserRow | null>(null);
  const users = useQuery({ queryKey: ['users', page], queryFn: () => usersApi.list(page) });
  const done = (msg: string) => {
    void qc.invalidateQueries({ queryKey: ['users'] });
    notify.success(msg);
  };
  const onError = (err: unknown) => notify.error(errorMessage(err));
  const invite = useMutation({
    mutationFn: usersApi.invite,
    onSuccess: () => {
      setInviteOpen(false);
      done(t('users.invited'));
    },
  });
  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) => usersApi.update(id, { role }),
    onSuccess: () => done(t('content.saved')),
    onError,
  });
  const deactivate = useMutation({
    mutationFn: usersApi.deactivate,
    onSuccess: () => done(t('content.saved')),
    onError,
    onSettled: () => setConfirm(null),
  });
  const reset = useMutation({ mutationFn: usersApi.resetPassword, onSuccess: () => notify.success(t('users.resetSent')), onError });
  const inviteErrors = invite.error instanceof ApiError ? invite.error.fieldErrors() : {};

  return (
    <Box>
      <PageHeader
        title={t('users.title')}
        actions={
          <Fab variant="extended" color="primary" onClick={() => setInviteOpen(true)}>
            <PersonAdd sx={{ mr: 1 }} />
            {t('users.invite')}
          </Fab>
        }
      />
      <Card>
        {users.isLoading && <LoadingBlock label={t('app.loading')} />}
        {users.data && (
          <Table aria-label={t('users.title')}>
            <TableHead>
              <TableRow>
                <TableCell>{t('users.name')}</TableCell>
                <TableCell>{t('users.email')}</TableCell>
                <TableCell>{t('users.role')}</TableCell>
                <TableCell>{t('users.status')}</TableCell>
                <TableCell>{t('users.lastLogin')}</TableCell>
                <TableCell align="right">
                  <span className="visually-hidden">{t('common.actions')}</span>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.data.data.map((u) => (
                <TableRow key={u.id}>
                  <TableCell component="th" scope="row">
                    {u.name}
                  </TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{t(`users.roles.${u.role}`)}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={t(`users.statuses.${u.status}`)}
                      color={u.status === 'active' ? 'success' : 'default'}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>{u.lastLoginAt ? formatRelative(u.lastLoginAt) : t('users.never')}</TableCell>
                  <TableCell align="right">
                    {u.status !== 'deactivated' && (
                      <IconButton
                        aria-label={`${t('common.actions')}: ${u.name}`}
                        onClick={(e) => setMenu({ anchor: e.currentTarget, user: u })}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {users.data && users.data.pagination.total_pages > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 2 }}>
            <Pagination count={users.data.pagination.total_pages} page={page} onChange={(_, p) => setPage(p)} />
          </Box>
        )}
      </Card>
      <Menu anchorEl={menu?.anchor} open={!!menu} onClose={() => setMenu(null)}>
        {(['author', 'editor', 'admin'] as const)
          .filter((r) => r !== menu?.user.role)
          .map((r) => (
            <MenuItem
              key={r}
              onClick={() => {
                if (menu) changeRole.mutate({ id: menu.user.id, role: r });
                setMenu(null);
              }}
            >
              {t('users.changeRole')}: {t(`users.roles.${r}`)}
            </MenuItem>
          ))}
        <MenuItem
          onClick={() => {
            if (menu) reset.mutate(menu.user.id);
            setMenu(null);
          }}
        >
          {menu?.user.status === 'invited' ? t('users.resendInvite') : t('users.resetPassword')}
        </MenuItem>
        <MenuItem
          sx={{ color: 'error.main' }}
          onClick={() => {
            setConfirm(menu?.user ?? null);
            setMenu(null);
          }}
        >
          {t('users.deactivate')}
        </MenuItem>
      </Menu>
      <InviteUserDialog
        open={inviteOpen}
        busy={invite.isPending}
        serverErrors={inviteErrors}
        onClose={() => {
          setInviteOpen(false);
          invite.reset();
        }}
        onSubmit={(v) => invite.mutate(v)}
      />
      <ConfirmDialog
        open={!!confirm}
        title={t('users.deactivateTitle', { name: confirm?.name ?? '' })}
        body={t('users.deactivateBody')}
        confirmLabel={t('users.deactivate')}
        cancelLabel={t('common.cancel')}
        destructive
        busy={deactivate.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm && deactivate.mutate(confirm.id)}
      />
    </Box>
  );
}
