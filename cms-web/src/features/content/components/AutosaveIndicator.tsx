import { Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { t } from '../../../shared/i18n/t';
import { formatRelative } from '../../../shared/utils/format';
import type { AutosaveEvent } from '../streams/autosave.stream';

/** "Saving…" → "Saved 5 seconds ago" → "Couldn't save" (04-ARCH §5.4.2). Presentational. */
export function AutosaveIndicator({ state }: { state: AutosaveEvent | null }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 10_000);
    return () => clearInterval(id);
  }, []);
  if (!state) return null;
  const text =
    state.kind === 'saving'
      ? t('content.saving')
      : state.kind === 'saved'
        ? t('content.savedAgo', { when: formatRelative(new Date(state.at)) })
        : t('content.saveFailed');
  return (
    <Typography variant="caption" color={state.kind === 'error' ? 'error' : 'text.secondary'} role="status" aria-live="polite">
      {text}
    </Typography>
  );
}
