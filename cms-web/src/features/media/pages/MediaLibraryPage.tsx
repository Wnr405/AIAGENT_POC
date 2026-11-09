import { Box, Button, LinearProgress, MenuItem, Pagination, Stack, TextField, Typography } from '@mui/material';
import UploadIcon from '@mui/icons-material/UploadRounded';
import { useRef, useState, type DragEvent } from 'react';
import { EmptyState, LoadingBlock, PageHeader } from '../../../design-system/components';
import { useDebouncedValue } from '../../../shared/hooks/useDebouncedValue';
import { t } from '../../../shared/i18n/t';
import { canPublish, isAdmin, selectUser, useSessionStore } from '../../../shared/stores/session.store';
import { MediaDetailsDrawer } from '../components/MediaDetailsDrawer';
import { MediaGrid } from '../components/MediaGrid';
import { useDeleteMedia, useMediaItem, useMediaList, useUpdateMedia, useUploads } from '../hooks/media.hooks';

const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml,application/pdf';

type KindFilter = '' | 'image' | 'document';

function useMediaLibrary() {
  const user = useSessionStore(selectUser);
  const [search, setSearchState] = useState('');
  const [kind, setKind] = useState<KindFilter>('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const q = useDebouncedValue(search);
  const list = useMediaList({ search: q || undefined, kind: kind || undefined, page });
  const detail = useMediaItem(openId);
  const update = useUpdateMedia();
  const remove = useDeleteMedia();
  const role = user?.role ?? null;
  const own = detail.data !== undefined && detail.data.uploadedBy === user?.id;
  return {
    search,
    kind,
    page,
    list,
    detail,
    uploads: useUploads(),
    busy: update.isPending || remove.isPending,
    canDelete: canPublish(role) || own,
    canForce: isAdmin(role),
    setKind,
    setPage,
    setSearch: (s: string) => {
      setSearchState(s);
      setPage(1);
    },
    open: (id: string) => setOpenId(id),
    close: () => setOpenId(null),
    save: (patch: { altText?: string | null; caption?: string | null }) => {
      if (openId) update.mutate({ id: openId, ...patch });
    },
    remove: (force: boolean) => {
      if (openId) remove.mutate({ id: openId, force }, { onSuccess: () => setOpenId(null) });
    },
  };
}

function UploadProgress({ progress }: { progress: Record<string, number> }) {
  return (
    <>
      {Object.entries(progress).map(([name, pct]) => (
        <Box key={name} sx={{ mb: 1 }}>
          <Typography variant="caption">{t('media.uploading', { name, percent: pct })}</Typography>
          <LinearProgress variant="determinate" value={pct} />
        </Box>
      ))}
    </>
  );
}

function MediaResults({ m }: { m: ReturnType<typeof useMediaLibrary> }) {
  const data = m.list.data;
  if (m.list.isLoading) return <LoadingBlock label={t('app.loading')} />;
  if (!data) return null;
  if (data.data.length === 0) return <EmptyState title={t('media.emptyTitle')} body={t('media.emptyBody')} />;
  return (
    <>
      <MediaGrid items={data.data} onOpen={(item) => m.open(item.id)} />
      {data.pagination.total_pages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
          <Pagination count={data.pagination.total_pages} page={m.page} onChange={(_, p) => m.setPage(p)} />
        </Box>
      )}
    </>
  );
}

/** UR-U05 / UR-E04 / FR-MEDIA-*: grid, search, type filter, drag-and-drop upload with progress. */
export function MediaLibraryPage() {
  const m = useMediaLibrary();
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    m.uploads.start([...e.dataTransfer.files]);
  };

  return (
    <Box
      data-testid="media-dropzone"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <PageHeader
        title={t('media.title')}
        actions={
          <Button variant="contained" startIcon={<UploadIcon />} onClick={() => input.current?.click()}>
            {t('media.upload')}
          </Button>
        }
      />
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        data-testid="media-file-input"
        onChange={(e) => {
          m.uploads.start([...(e.target.files ?? [])]);
          e.target.value = '';
        }}
      />
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <TextField sx={{ maxWidth: 360 }} placeholder={t('media.searchPlaceholder')} value={m.search} onChange={(e) => m.setSearch(e.target.value)} slotProps={{ htmlInput: { 'aria-label': t('common.search') } }} />
        <TextField select sx={{ width: 180 }} label={t('media.allTypes')} value={m.kind} onChange={(e) => m.setKind(e.target.value as KindFilter)}>
          <MenuItem value="">{t('media.allTypes')}</MenuItem>
          <MenuItem value="image">{t('media.images')}</MenuItem>
          <MenuItem value="document">{t('media.documents')}</MenuItem>
        </TextField>
      </Stack>
      <UploadProgress progress={m.uploads.progress} />
      {dragging && (
        <Box sx={{ border: 2, borderStyle: 'dashed', borderColor: 'primary.main', borderRadius: 3, p: 4, mb: 2, textAlign: 'center' }}>
          {t('media.dropHere')}
        </Box>
      )}
      <MediaResults m={m} />
      <MediaDetailsDrawer
        item={m.detail.data ?? null}
        canDelete={m.canDelete}
        canForce={m.canForce}
        busy={m.busy}
        onClose={m.close}
        onSave={m.save}
        onDelete={m.remove}
      />
    </Box>
  );
}
