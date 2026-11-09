import { Box, Button, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { t, type MessageKey } from '../../../shared/i18n/t';
import { contentApi } from '../api/content.api';
import { MediaPickerDialog } from './MediaPickerDialog';

/** Featured / social image selector (03-DESIGN §12.4 side panel). */
export function ImageField({ label, value, onChange }: { label: MessageKey; value: string | null; onChange: (id: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const media = useQuery({ queryKey: ['media', 'detail', value], queryFn: () => contentApi.mediaItem(value as string), enabled: !!value });
  return (
    <Box>
      <Typography variant="subtitle2" component="p" sx={{ mb: 1 }}>
        {t(label)}
      </Typography>
      {value && media.data && (
        <Box
          component="img"
          src={media.data.variants.thumbnail?.url ?? media.data.url}
          alt={media.data.altText ?? ''}
          sx={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 1, mb: 1 }}
        />
      )}
      <Stack direction="row" spacing={1}>
        <Button variant="outlined" size="small" onClick={() => setOpen(true)}>
          {t('content.selectImage')}
        </Button>
        {value && (
          <Button size="small" onClick={() => onChange(null)}>
            {t('content.removeImage')}
          </Button>
        )}
      </Stack>
      <MediaPickerDialog
        open={open}
        onClose={() => setOpen(false)}
        onPick={(img) => {
          onChange(img.id);
          setOpen(false);
        }}
      />
    </Box>
  );
}
