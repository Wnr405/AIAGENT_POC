import { Stack, TextField, Typography } from '@mui/material';
import { t } from '../../../shared/i18n/t';

export interface SeoPanelProps {
  seoTitle: string;
  seoDescription: string;
  defaultTitle: string;
  defaultDescription: string;
  errors: { seoTitle?: string; seoDescription?: string };
  onChange: (patch: { seoTitle?: string; seoDescription?: string }) => void;
}

/** FR-SEO-01/02: counters (70 / 160) and the defaults that apply when left empty. Presentational. */
export function SeoPanel(p: SeoPanelProps) {
  return (
    <Stack spacing={2}>
      <Typography variant="subtitle1" component="h2">
        {t('content.seo')}
      </Typography>
      <TextField
        label={t('content.seoTitle')}
        value={p.seoTitle}
        onChange={(e) => p.onChange({ seoTitle: e.target.value })}
        error={!!p.errors.seoTitle || p.seoTitle.length > 70}
        helperText={p.errors.seoTitle ?? `${p.seoTitle.length}/70 · ${t('content.seoDefault', { value: p.defaultTitle.slice(0, 40) })}`}
        slotProps={{ htmlInput: { maxLength: 70 } }}
      />
      <TextField
        label={t('content.seoDescription')}
        value={p.seoDescription}
        onChange={(e) => p.onChange({ seoDescription: e.target.value })}
        multiline
        minRows={3}
        error={!!p.errors.seoDescription || p.seoDescription.length > 160}
        helperText={
          p.errors.seoDescription ??
          `${p.seoDescription.length}/160${p.seoDescription ? '' : ` · ${t('content.seoDefault', { value: p.defaultDescription.slice(0, 60) })}`}`
        }
        slotProps={{ htmlInput: { maxLength: 160 } }}
      />
    </Stack>
  );
}
