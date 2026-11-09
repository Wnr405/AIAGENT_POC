import { Alert, Button, Stack, Typography } from '@mui/material';
import { StatusChip } from '../../../design-system/components';
import { t } from '../../../shared/i18n/t';
import { formatDateTime } from '../../../shared/utils/format';
import { displayStatus } from '../types/content.logic';
import type { ContentStatus, TransitionAction } from '../types/content.types';

export interface PublishPanelProps {
  isNew: boolean;
  status: ContentStatus;
  scheduledAt: string | null;
  actions: TransitionAction[];
  missing: string[];
  canSchedule: boolean;
  canDelete: boolean;
  busy: boolean;
  onSave: () => void;
  onAction: (a: TransitionAction) => void;
  onSchedule: () => void;
  onUnschedule: () => void;
  onDelete: () => void;
}

const LABEL: Record<TransitionAction, Parameters<typeof t>[0]> = {
  submit: 'content.submit',
  publish: 'content.approve',
  reject: 'content.reject',
  unpublish: 'content.unpublish',
  archive: 'content.archive',
};

const isPrimary = (a: TransitionAction): boolean => a === 'publish' || a === 'submit';
const isDestructive = (a: TransitionAction): boolean => a === 'unpublish' || a === 'archive';

function ActionButtons({
  actions,
  busy,
  blocked,
  onAction,
}: {
  actions: TransitionAction[];
  busy: boolean;
  blocked: boolean;
  onAction: (a: TransitionAction) => void;
}) {
  return (
    <>
      {actions.map((a) => (
        <Button
          key={a}
          variant={isPrimary(a) ? 'contained' : 'text'}
          color={isDestructive(a) ? 'error' : 'primary'}
          disabled={busy || (isPrimary(a) && blocked)}
          onClick={() => onAction(a)}
        >
          {t(LABEL[a])}
        </Button>
      ))}
    </>
  );
}

function ScheduleButton(
  p: Pick<PublishPanelProps, 'status' | 'scheduledAt' | 'busy' | 'onSchedule' | 'onUnschedule'> & { blocked: boolean },
) {
  if (p.status !== 'draft' && p.status !== 'in_review') return null;
  return p.scheduledAt ? (
    <Button onClick={p.onUnschedule} disabled={p.busy}>
      {t('content.unschedule')}
    </Button>
  ) : (
    <Button onClick={p.onSchedule} disabled={p.busy || p.blocked}>
      {t('content.schedule')}
    </Button>
  );
}

/** Lifecycle controls that only exist once the item has been saved. */
function SavedItemControls(p: PublishPanelProps & { blocked: boolean }) {
  return (
    <>
      <ActionButtons actions={p.actions} busy={p.busy} blocked={p.blocked} onAction={p.onAction} />
      {p.blocked && p.actions.includes('publish') && (
        <Alert severity="info" variant="outlined">
          {t('content.publishBlocked', { missing: p.missing.join(', ') })}
        </Alert>
      )}
      {p.canSchedule && <ScheduleButton {...p} />}
      {p.canDelete && (
        <Button color="error" onClick={p.onDelete} disabled={p.busy}>
          {t('common.delete')}
        </Button>
      )}
    </>
  );
}

/** Side panel "Publish" card (03-DESIGN §12.4). Presentational — all effects via callbacks. */
export function PublishPanel(p: PublishPanelProps) {
  const ds = displayStatus({ status: p.status, scheduledAt: p.scheduledAt });
  return (
    <Stack spacing={1.5}>
      <Typography variant="subtitle1" component="h2">
        {t('content.publishPanel')}
      </Typography>
      <div>
        <StatusChip status={ds} label={t(`status.${ds}`)} />
      </div>
      {p.scheduledAt && <Typography variant="body2">{t('content.scheduledFor', { when: formatDateTime(p.scheduledAt) })}</Typography>}
      <Button variant="outlined" onClick={p.onSave} disabled={p.busy}>
        {t('content.saveDraft')}
      </Button>
      {!p.isNew && <SavedItemControls {...p} blocked={p.missing.length > 0} />}
    </Stack>
  );
}
