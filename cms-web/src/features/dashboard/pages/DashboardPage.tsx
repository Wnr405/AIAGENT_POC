import { Box, Button, Card, CardContent, List, ListItem, ListItemText, Stack, Typography } from '@mui/material';
import Grid from '@mui/material/Grid2';
import ArticleIcon from '@mui/icons-material/ArticleRounded';
import CheckIcon from '@mui/icons-material/CheckCircleRounded';
import HourglassIcon from '@mui/icons-material/HourglassTopRounded';
import EditIcon from '@mui/icons-material/EditNoteRounded';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { EmptyState, PageHeader, StatCard } from '../../../design-system/components';
import { api } from '../../../shared/api/client';
import { t } from '../../../shared/i18n/t';
import { isAdmin, selectUser, useSessionStore } from '../../../shared/stores/session.store';
import { formatRelative } from '../../../shared/utils/format';

interface Stats {
  total: number;
  published: number;
  in_review: number;
  draft: number;
}
interface Activity {
  id: string;
  primary: string;
  at: string;
}

/** Admins see the audit feed; everyone else their latest content changes. */
async function fetchRecent(admin: boolean): Promise<Activity[]> {
  if (admin) {
    const r = await api.get<{ data: { id: string; actorName: string | null; action: string; occurredAt: string }[] }>('/admin/audit', {
      page_size: 10,
    });
    return r.data.map((e) => ({ id: e.id, primary: `${e.actorName ?? t('audit.system')} · ${e.action}`, at: e.occurredAt }));
  }
  const r = await api.get<{ data: { id: string; title: string; status: string; updatedAt: string }[] }>('/admin/content', {
    page_size: 10,
  });
  return r.data.map((c) => ({ id: c.id, primary: c.title, at: c.updatedAt }));
}

function StatsRow({ stats }: { stats: Stats | undefined }) {
  const cards = [
    { label: t('dashboard.total'), value: stats?.total, icon: <ArticleIcon /> },
    { label: t('dashboard.published'), value: stats?.published, icon: <CheckIcon /> },
    { label: t('dashboard.inReview'), value: stats?.in_review, icon: <HourglassIcon /> },
    { label: t('dashboard.drafts'), value: stats?.draft, icon: <EditIcon /> },
  ];
  return (
    <Grid container spacing={3} sx={{ mb: 3 }}>
      {cards.map((c) => (
        <Grid key={c.label} size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard label={c.label} value={c.value ?? '–'} icon={c.icon} />
        </Grid>
      ))}
    </Grid>
  );
}

function RecentActivity({ items, admin }: { items: Activity[] | undefined; admin: boolean }) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h5" component="h2">
          {t('dashboard.recent')}
        </Typography>
        {items?.length === 0 && <EmptyState title={t('dashboard.recentEmpty')} />}
        <List>
          {items?.map((a) => (
            <ListItem key={a.id} divider>
              <ListItemText primary={a.primary} secondary={formatRelative(a.at)} />
            </ListItem>
          ))}
        </List>
        {admin && (
          <Button component={Link} to="/audit">
            {t('dashboard.viewAudit')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/** 03-DESIGN §12.2 dashboard: stat cards, recent activity, quick actions. */
export function DashboardPage() {
  const user = useSessionStore(selectUser);
  const admin = isAdmin(user?.role ?? null);
  const stats = useQuery({ queryKey: ['content', 'stats'], queryFn: () => api.get<Stats>('/admin/content/stats') });
  const recent = useQuery({ queryKey: ['dashboard', 'recent', admin], queryFn: () => fetchRecent(admin) });
  return (
    <Box>
      <PageHeader title={t('dashboard.greeting', { name: user?.name ?? '' })} subtitle={t('dashboard.subtitle')} />
      <StatsRow stats={stats.data} />
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <RecentActivity items={recent.data} admin={admin} />
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="h5" component="h2" sx={{ mb: 2 }}>
                {t('dashboard.quick')}
              </Typography>
              <Stack spacing={1}>
                <Button variant="outlined" component={Link} to="/content/articles/new">
                  {t('dashboard.newArticle')}
                </Button>
                <Button variant="outlined" component={Link} to="/content/pages/new">
                  {t('dashboard.newPage')}
                </Button>
                <Button variant="outlined" component={Link} to="/media">
                  {t('dashboard.uploadMedia')}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
