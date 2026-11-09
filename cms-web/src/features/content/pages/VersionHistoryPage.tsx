import { Box, Button, Card, List, ListItem, ListItemText } from '@mui/material';
import { useParams } from 'react-router-dom';
import { EmptyState, LoadingBlock, PageHeader } from '../../../design-system/components';
import { t } from '../../../shared/i18n/t';
import { formatDateTime } from '../../../shared/utils/format';
import { useRevert, useVersions } from '../hooks/content.hooks';

/** FR-CONTENT-08/09: list snapshots, restore any (creates a new version). No visual diff in MVP. */
export function VersionHistoryPage() {
  const { id = '' } = useParams<{ id: string }>();
  const versions = useVersions(id);
  const revert = useRevert(id);
  return (
    <Box>
      <PageHeader title={t('content.versions')} />
      <Card>
        {versions.isLoading && <LoadingBlock label={t('app.loading')} />}
        {versions.data?.length === 0 && <EmptyState title={t('common.none')} />}
        <List>
          {versions.data?.map((v, i) => (
            <ListItem
              key={v.versionNo}
              divider
              secondaryAction={
                i > 0 ? (
                  <Button onClick={() => revert.mutate(v.versionNo)} disabled={revert.isPending}>
                    {t('content.revert')}
                  </Button>
                ) : undefined
              }
            >
              <ListItemText
                primary={`${t('content.version', { n: v.versionNo })} — ${v.snapshot.title}`}
                secondary={`${v.editor.name ?? t('audit.system')} · ${formatDateTime(v.createdAt)}`}
              />
            </ListItem>
          ))}
        </List>
      </Card>
    </Box>
  );
}
