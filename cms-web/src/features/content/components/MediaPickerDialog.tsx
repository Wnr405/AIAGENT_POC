import { Box, Dialog, DialogContent, DialogTitle, ImageList, ImageListItem, ImageListItemBar, ButtonBase, TextField } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { EmptyState, LoadingBlock } from '../../../design-system/components';
import { useDebouncedValue } from '../../../shared/hooks/useDebouncedValue';
import { t } from '../../../shared/i18n/t';
import { contentApi } from '../api/content.api';

export interface PickedImage {
  id: string;
  url: string;
  alt: string | null;
}

/** Picks an image from the media library (featured / social / inline). */
export function MediaPickerDialog({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (img: PickedImage) => void }) {
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search);
  const images = useQuery({ queryKey: ['media', 'picker', q], queryFn: () => contentApi.images(q), enabled: open });
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" aria-labelledby="media-picker-title">
      <DialogTitle id="media-picker-title">{t('media.pick')}</DialogTitle>
      <DialogContent>
        <TextField label={t('common.search')} value={search} onChange={(e) => setSearch(e.target.value)} sx={{ mb: 2, mt: 1 }} />
        {images.isLoading && <LoadingBlock label={t('app.loading')} />}
        {images.data && images.data.data.length === 0 && <EmptyState title={t('media.emptyTitle')} body={t('media.emptyBody')} />}
        <ImageList cols={4} gap={12}>
          {(images.data?.data ?? []).map((m) => (
            <ImageListItem key={m.id}>
              <ButtonBase
                onClick={() => onPick({ id: m.id, url: m.url, alt: m.altText })}
                aria-label={m.altText ?? m.filename}
                sx={{ display: 'block' }}
              >
                <Box
                  component="img"
                  src={m.variants.thumbnail?.url ?? m.url}
                  alt={m.altText ?? ''}
                  loading="lazy"
                  sx={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 1 }}
                />
              </ButtonBase>
              <ImageListItemBar title={m.filename} position="below" />
            </ImageListItem>
          ))}
        </ImageList>
      </DialogContent>
    </Dialog>
  );
}
