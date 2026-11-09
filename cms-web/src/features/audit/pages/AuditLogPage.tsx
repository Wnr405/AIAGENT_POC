import {
  Box,
  Button,
  Card,
  Chip,
  Pagination,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
} from '@mui/material';
import Download from '@mui/icons-material/DownloadRounded';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { EmptyState, LoadingBlock, PageHeader } from '../../../design-system/components';
import { api } from '../../../shared/api/client';
import { errorMessage } from '../../../shared/api/error-message';
import { useDebouncedValue } from '../../../shared/hooks/useDebouncedValue';
import { t } from '../../../shared/i18n/t';
import { notify } from '../../../shared/stores/ui.store';
import { formatDateTime } from '../../../shared/utils/format';

interface AuditRow {
  id: string;
  occurredAt: string;
  actorName: string | null;
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  summary: Record<string, unknown>;
}

/** FR-AUDIT-05/06 — read-only, filterable, paginated, CSV export. */
export function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const a = useDebouncedValue(action);
  const filter = {
    action: a || undefined,
    from: from ? new Date(from).toISOString() : undefined,
    to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
  };
  const rows = useQuery({
    queryKey: ['audit', filter, page],
    queryFn: () => api.get<{ data: AuditRow[]; pagination: { total_pages: number } }>('/admin/audit', { ...filter, page, page_size: 50 }),
    placeholderData: keepPreviousData,
  });
  const exportCsv = async () => {
    try {
      const blob = await api.download('/admin/audit/export.csv', filter);
      const url = URL.createObjectURL(blob);
      const link = Object.assign(document.createElement('a'), {
        href: url,
        download: `audit-${new Date().toISOString().slice(0, 10)}.csv`,
      });
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      notify.error(errorMessage(err));
    }
  };
  return (
    <Box>
      <PageHeader
        title={t('audit.title')}
        actions={
          <Button variant="outlined" startIcon={<Download />} onClick={() => void exportCsv()}>
            {t('audit.export')}
          </Button>
        }
      />
      <Stack direction="row" spacing={2} sx={{ mb: 2 }} useFlexGap flexWrap="wrap">
        <TextField
          sx={{ maxWidth: 320 }}
          label={t('audit.filterAction')}
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
        />
        <TextField
          sx={{ width: 180 }}
          type="date"
          label={t('audit.from')}
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          sx={{ width: 180 }}
          type="date"
          label={t('audit.to')}
          value={to}
          onChange={(e) => setTo(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
      </Stack>
      <Card>
        {rows.isLoading && <LoadingBlock label={t('app.loading')} />}
        {rows.data?.data.length === 0 && <EmptyState title={t('audit.empty')} />}
        {rows.data && rows.data.data.length > 0 && (
          <Table size="small" aria-label={t('audit.title')}>
            <TableHead>
              <TableRow>
                <TableCell>{t('audit.when')}</TableCell>
                <TableCell>{t('audit.actor')}</TableCell>
                <TableCell>{t('audit.action')}</TableCell>
                <TableCell>{t('audit.target')}</TableCell>
                <TableCell>{t('audit.summary')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.data.data.map((r) => (
                <TableRow key={r.id}>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(r.occurredAt)}</TableCell>
                  <TableCell>{r.actorName ?? t('audit.system')}</TableCell>
                  <TableCell>
                    <Chip size="small" label={r.action} variant="outlined" />
                  </TableCell>
                  <TableCell>
                    {r.targetType}
                    {r.targetId ? ` · ${r.targetId.slice(0, 8)}` : ''}
                  </TableCell>
                  <TableCell sx={{ maxWidth: 320 }}>
                    <Tooltip title={JSON.stringify(r.summary)}>
                      <Box
                        component="span"
                        sx={{
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontFamily: 'monospace',
                          fontSize: 12,
                        }}
                      >
                        {JSON.stringify(r.summary)}
                      </Box>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {rows.data && rows.data.pagination.total_pages > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 2 }}>
            <Pagination count={rows.data.pagination.total_pages} page={page} onChange={(_, p) => setPage(p)} />
          </Box>
        )}
      </Card>
    </Box>
  );
}
