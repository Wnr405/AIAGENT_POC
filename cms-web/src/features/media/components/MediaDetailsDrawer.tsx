import { Alert, Box, Button, Drawer, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { ConfirmDialog } from '../../../design-system/components';
import { t } from '../../../shared/i18n/t';
import { formatBytes, formatDateTime } from '../../../shared/utils/format';
import type { MediaItem } from '../api/media.api';

export interface MediaDetailsDrawerProps {
  item: MediaItem | null;
  canDelete: boolean;
  canForce: boolean;
  busy: boolean;
  onClose: () => void;
  onSave: (patch: { altText: string | null; caption: string | null }) => void;
  onDelete: (force: boolean) => void;
}

/** §12.5 side drawer: metadata (FR-MEDIA-06), copy URL, delete with reference guard (FR-MEDIA-07). */
export function MediaDetailsDrawer({ item, canDelete, canForce, busy, onClose, onSave, onDelete }: MediaDetailsDrawerProps) {
  const [alt, setAlt] = useState('');
  const [caption, setCaption] = useState('');
  const [confirm, setConfirm] = useState<null | { force: boolean }>(null);
  useEffect(() => {
    setAlt(item?.altText ?? '');
    setCaption(item?.caption ?? '');
  }, [item]);
  return (
    <Drawer anchor="right" open={!!item} onClose={onClose} slotProps={{ paper: { sx: { width: 380, p: 3 } } }}>
      {item && (
        <Stack spacing={2}>
          <Typography variant="h5" component="h2">
            {t('media.details')}
          </Typography>
          {item.mimeType !== 'application/pdf' && (
            <Box
              component="img"
              src={item.variants.medium?.url ?? item.url}
              alt={item.altText ?? ''}
              sx={{ width: '100%', borderRadius: 2 }}
            />
          )}
          <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
            {item.filename}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('media.size')}: {formatBytes(item.sizeBytes)}
            {item.width ? ` · ${t('media.dimensions')}: ${item.width}×${item.height}` : ''}
            <br />
            {t('media.uploadedAt')}: {formatDateTime(item.createdAt)}
          </Typography>
          <TextField
            label={t('media.altText')}
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 500 } }}
          />
          <TextField
            label={t('media.caption')}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            multiline
            minRows={2}
            slotProps={{ htmlInput: { maxLength: 1000 } }}
          />
          <Stack direction="row" spacing={1}>
            <Button variant="contained" disabled={busy} onClick={() => onSave({ altText: alt || null, caption: caption || null })}>
              {t('common.save')}
            </Button>
            <Button onClick={() => void navigator.clipboard.writeText(item.url)}>{t('media.copyUrl')}</Button>
          </Stack>
          {item.referenced && <Alert severity="info">{t('media.inUse')}</Alert>}
          {canDelete && (!item.referenced || canForce) && (
            <Button color="error" onClick={() => setConfirm({ force: !!item.referenced })}>
              {item.referenced ? t('media.forceDelete') : t('common.delete')}
            </Button>
          )}
          <ConfirmDialog
            open={!!confirm}
            title={t('media.deleteTitle')}
            body={t('media.deleteBody')}
            confirmLabel={t('common.delete')}
            cancelLabel={t('common.cancel')}
            destructive
            busy={busy}
            onCancel={() => setConfirm(null)}
            onConfirm={() => {
              onDelete(confirm?.force ?? false);
              setConfirm(null);
            }}
          />
        </Stack>
      )}
    </Drawer>
  );
}
