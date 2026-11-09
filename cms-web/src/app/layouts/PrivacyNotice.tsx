import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import { useState } from 'react';
import { t } from '../../shared/i18n/t';
import { selectUser, useSessionStore } from '../../shared/stores/session.store';
import { preferences } from '../../shared/utils/storage';

/** 02-SRS §10.1: privacy notice on first login (acknowledgement remembered per user, per browser). */
export function PrivacyNotice() {
  const user = useSessionStore(selectUser);
  const key = `privacy-ack:${user?.id ?? ''}`;
  const [ack, setAck] = useState(() => preferences.get(key) === '1');
  if (!user || ack) return null;
  return (
    <Dialog open aria-labelledby="privacy-title">
      <DialogTitle id="privacy-title">{t('auth.privacyTitle')}</DialogTitle>
      <DialogContent>
        <DialogContentText>{t('auth.privacyBody')}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          onClick={() => {
            preferences.set(key, '1');
            setAck(true);
          }}
        >
          {t('auth.privacyAccept')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
