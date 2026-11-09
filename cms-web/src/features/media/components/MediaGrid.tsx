import { Box, ButtonBase, Card, Tooltip, Typography } from '@mui/material';
import PictureAsPdf from '@mui/icons-material/PictureAsPdfRounded';
import type { MediaItem } from '../api/media.api';

/** 03-DESIGN §12.5: 160 dp outlined tiles, filename below (label-medium, truncated + tooltip). Presentational. */
export function MediaGrid({ items, onOpen }: { items: MediaItem[]; onOpen: (m: MediaItem) => void }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 2 }}>
      {items.map((m) => (
        <Card key={m.id}>
          <ButtonBase
            onClick={() => onOpen(m)}
            sx={{ display: 'block', width: '100%', textAlign: 'left' }}
            aria-label={m.altText ?? m.filename}
          >
            <Box sx={{ aspectRatio: '1', bgcolor: 'action.hover', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
              {m.mimeType === 'application/pdf' ? (
                <PictureAsPdf sx={{ fontSize: 48, color: 'text.secondary' }} />
              ) : (
                <Box
                  component="img"
                  src={m.variants.thumbnail?.url ?? m.url}
                  alt={m.altText ?? ''}
                  loading="lazy"
                  sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              )}
            </Box>
            <Tooltip title={m.filename}>
              <Typography variant="overline" component="p" noWrap sx={{ px: 1, py: 0.5, textTransform: 'none' }}>
                {m.filename}
              </Typography>
            </Tooltip>
          </ButtonBase>
        </Card>
      ))}
    </Box>
  );
}
