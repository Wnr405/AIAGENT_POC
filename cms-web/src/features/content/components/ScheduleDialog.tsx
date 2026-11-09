import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';
import { useState } from 'react';
import { t } from '../../../shared/i18n/t';
import { fromLocalInputValue, toLocalInputValue } from '../../../shared/utils/format';

/** FR-CONTENT-07: pick a future local date/time; sent to the API as UTC. */
export function ScheduleDialog({
  open,
  onClose,
  onConfirm,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (iso: string) => void;
  busy: boolean;
}) {
  const [value, setValue] = useState(() => toLocalInputValue(new Date(Date.now() + 3600_000)));
  const valid = value !== '' && new Date(value).getTime() > Date.now();
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth aria-labelledby="schedule-title">
      <DialogTitle id="schedule-title">{t('content.scheduleTitle')}</DialogTitle>
      <DialogContent>
        <TextField
          type="datetime-local"
          label={t('content.scheduleAt')}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          error={!valid}
          sx={{ mt: 1 }}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: toLocalInputValue(new Date()) } }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="contained" disabled={!valid || busy} onClick={() => onConfirm(fromLocalInputValue(value))}>
          {t('content.schedule').replace('…', '')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
