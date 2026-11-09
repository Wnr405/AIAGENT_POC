import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** NFR-USE-02 / 03-DESIGN §13.5: every destructive action is confirmed. */
export function ConfirmDialog(p: ConfirmDialogProps) {
  return (
    <Dialog open={p.open} onClose={p.onCancel} aria-labelledby="confirm-title" maxWidth="xs" fullWidth>
      <DialogTitle id="confirm-title">{p.title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{p.body}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={p.onCancel} disabled={p.busy}>
          {p.cancelLabel}
        </Button>
        <Button
          onClick={p.onConfirm}
          variant="contained"
          color={p.destructive ? 'error' : 'primary'}
          disabled={p.busy}
          // eslint-disable-next-line jsx-a11y/no-autofocus -- WAI-ARIA dialog pattern: move focus into the modal on open (NFR-USE-02)
          autoFocus
        >
          {p.confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
