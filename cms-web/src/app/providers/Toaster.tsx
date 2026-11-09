import { Alert, Button, Snackbar } from '@mui/material';
import { useEffect } from 'react';
import { t } from '../../shared/i18n/t';
import { notify, useUiStore } from '../../shared/stores/ui.store';
import { globalErrors$ } from '../../shared/streams/global-errors.stream';

/** 03-DESIGN §15.1 snackbars: one at a time, 4 s (errors 6 s), optional single action. */
export function Toaster() {
  const toasts = useUiStore((s) => s.toasts);
  const dismiss = useUiStore((s) => s.dismiss);
  const current = toasts[0];

  useEffect(() => {
    const sub = globalErrors$.subscribe((err) =>
      notify.error(err.status === 0 ? t('errors.network') : t('errors.generic'), {
        label: t('common.retry'),
        onClick: () => window.location.reload(),
      }),
    );
    return () => sub.unsubscribe();
  }, []);

  if (!current) return null;
  return (
    <Snackbar
      key={current.id}
      open
      autoHideDuration={current.severity === 'error' ? 6000 : 4000}
      onClose={(_, reason) => reason !== 'clickaway' && dismiss(current.id)}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert
        severity={current.severity}
        variant="filled"
        onClose={() => dismiss(current.id)}
        action={
          current.action ? (
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                current.action?.onClick();
                dismiss(current.id);
              }}
            >
              {current.action.label}
            </Button>
          ) : undefined
        }
      >
        {current.message}
      </Alert>
    </Snackbar>
  );
}
