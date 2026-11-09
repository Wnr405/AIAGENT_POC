import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Fab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/AddRounded';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ConfirmDialog, EmptyState, LoadingBlock, PageHeader } from '../../../design-system/components';
import { api } from '../../../shared/api/client';
import { errorMessage } from '../../../shared/api/error-message';
import { t } from '../../../shared/i18n/t';
import { notify } from '../../../shared/stores/ui.store';
import { formatRelative } from '../../../shared/utils/format';

interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

/** 03-DESIGN §12.8 / FR-PUBAPI-02: the full key is shown once, with a copy button and warning. */
export function ApiKeysPage() {
  const qc = useQueryClient();
  const keys = useQuery({ queryKey: ['api-keys'], queryFn: () => api.get<{ data: ApiKeyRow[] }>('/admin/api-keys').then((r) => r.data) });
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [created, setCreated] = useState<string | null>(null);
  const [revoke, setRevoke] = useState<ApiKeyRow | null>(null);
  const create = useMutation({
    mutationFn: () => api.post<ApiKeyRow & { key: string }>('/admin/api-keys', { name }),
    onSuccess: (k) => {
      setCreating(false);
      setName('');
      setCreated(k.key);
      void qc.invalidateQueries({ queryKey: ['api-keys'] });
    },
    onError: (err) => notify.error(errorMessage(err)),
  });
  const revokeKey = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/api-keys/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['api-keys'] }),
    onError: (err) => notify.error(errorMessage(err)),
    onSettled: () => setRevoke(null),
  });
  return (
    <Box>
      <PageHeader
        title={t('apiKeys.title')}
        actions={
          <Fab variant="extended" color="primary" onClick={() => setCreating(true)}>
            <AddIcon sx={{ mr: 1 }} />
            {t('apiKeys.create')}
          </Fab>
        }
      />
      <Card>
        {keys.isLoading && <LoadingBlock label={t('app.loading')} />}
        {keys.data?.length === 0 && <EmptyState title={t('apiKeys.empty')} />}
        {keys.data && keys.data.length > 0 && (
          <Table aria-label={t('apiKeys.title')}>
            <TableHead>
              <TableRow>
                <TableCell>{t('apiKeys.name')}</TableCell>
                <TableCell>{t('apiKeys.prefix')}</TableCell>
                <TableCell>{t('apiKeys.lastUsed')}</TableCell>
                <TableCell>{t('apiKeys.status')}</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {keys.data.map((k) => (
                <TableRow key={k.id}>
                  <TableCell component="th" scope="row">
                    {k.name}
                  </TableCell>
                  <TableCell sx={{ fontFamily: 'monospace' }}>{k.prefix}…</TableCell>
                  <TableCell>{k.lastUsedAt ? formatRelative(k.lastUsedAt) : t('users.never')}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      variant="outlined"
                      color={k.revokedAt ? 'default' : 'success'}
                      label={k.revokedAt ? t('apiKeys.revoked') : t('apiKeys.active')}
                    />
                  </TableCell>
                  <TableCell align="right">
                    {!k.revokedAt && (
                      <Button color="error" onClick={() => setRevoke(k)}>
                        {t('apiKeys.revoke')}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      <Dialog open={creating} onClose={() => setCreating(false)} fullWidth maxWidth="xs" aria-labelledby="new-key-title">
        <DialogTitle id="new-key-title">{t('apiKeys.create')}</DialogTitle>
        <DialogContent>
          <TextField
            sx={{ mt: 1 }}
            label={t('apiKeys.name')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 100 } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreating(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}>
            {t('apiKeys.create')}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={!!created} fullWidth maxWidth="sm" aria-labelledby="created-key-title">
        <DialogTitle id="created-key-title">{t('apiKeys.createdTitle')}</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            {t('apiKeys.createdWarning')}
          </Alert>
          <Typography
            component="code"
            sx={{ display: 'block', p: 2, bgcolor: 'action.hover', borderRadius: 1, wordBreak: 'break-all', fontFamily: 'monospace' }}
          >
            {created}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              void navigator.clipboard.writeText(created ?? '');
              notify.success(t('common.copied'));
            }}
          >
            {t('common.copy')}
          </Button>
          <Button variant="contained" onClick={() => setCreated(null)}>
            {t('common.close')}
          </Button>
        </DialogActions>
      </Dialog>
      <ConfirmDialog
        open={!!revoke}
        title={t('apiKeys.revokeTitle')}
        body={t('apiKeys.revokeBody')}
        confirmLabel={t('apiKeys.revoke')}
        cancelLabel={t('common.cancel')}
        destructive
        busy={revokeKey.isPending}
        onCancel={() => setRevoke(null)}
        onConfirm={() => revoke && revokeKey.mutate(revoke.id)}
      />
    </Box>
  );
}
