import { Chip } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { statusColors, type DisplayStatus } from '../tokens/status';

/** Presentational: colours from tokens, text from the caller (i18n). Never colour-only (WCAG 1.4.1). */
export function StatusChip({ status, label }: { status: DisplayStatus; label: string }) {
  const theme = useTheme();
  const { bg, fg, italic } = statusColors(theme.md.color, status);
  return (
    <Chip
      size="small"
      label={label}
      data-status={status}
      sx={{ bgcolor: bg, color: fg, fontStyle: italic ? 'italic' : 'normal', fontWeight: 500 }}
    />
  );
}
