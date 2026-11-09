import { Box, Card, Chip, Fab, InputAdornment, Pagination, Stack, TextField } from '@mui/material';
import AddIcon from '@mui/icons-material/AddRounded';
import SearchIcon from '@mui/icons-material/SearchRounded';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ConfirmDialog, EmptyState, LoadingBlock, PageHeader } from '../../../design-system/components';
import { useDebouncedValue } from '../../../shared/hooks/useDebouncedValue';
import { t } from '../../../shared/i18n/t';
import { canPublish, selectUser, useSessionStore } from '../../../shared/stores/session.store';
import { ContentTable } from '../components/ContentTable';
import { useContentList, useDeleteContent } from '../hooks/content.hooks';
import { routeToType, type ContentStatus, type ContentSummary, type ListEnvelope, type RouteType } from '../types/content.types';

type StatusFilter = ContentStatus | 'all';
type SortField = 'updatedAt' | 'title' | 'status';
const STATUS_FILTERS: StatusFilter[] = ['all', 'draft', 'in_review', 'published', 'unpublished', 'archived'];

/** List state: filters, debounced search, sort and paging (FR-CONTENT-10/11). */
function useListState(routeType: RouteType, userId: string | undefined) {
  const [status, setStatusState] = useState<StatusFilter>('all');
  const [mine, setMine] = useState(false);
  const [search, setSearchState] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortField>('updatedAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const q = useDebouncedValue(search);
  const list = useContentList({
    type: routeToType(routeType),
    status: status === 'all' ? undefined : status,
    search: q || undefined,
    authorId: mine ? userId : undefined,
    page,
    sort,
    order,
  });
  return {
    list,
    status,
    mine,
    search,
    page,
    sort,
    order,
    filtered: status !== 'all' || mine || q !== '',
    setPage,
    toggleMine: () => setMine((m) => !m),
    setStatus: (s: StatusFilter) => {
      setStatusState(s);
      setPage(1);
    },
    setSearch: (s: string) => {
      setSearchState(s);
      setPage(1);
    },
    toggleSort: (field: SortField) => {
      setOrder(sort === field && order === 'asc' ? 'desc' : 'asc');
      setSort(field);
    },
  };
}

interface FiltersProps {
  search: string;
  status: StatusFilter;
  mine: boolean;
  showMine: boolean;
  onSearch: (s: string) => void;
  onStatus: (s: StatusFilter) => void;
  onToggleMine: () => void;
}

function ContentFilters(p: FiltersProps) {
  return (
    <Stack direction="row" spacing={2} sx={{ mb: 2, flexWrap: 'wrap', alignItems: 'center' }} useFlexGap>
      <TextField
        sx={{ maxWidth: 320 }}
        placeholder={t('content.searchPlaceholder')}
        value={p.search}
        onChange={(e) => p.onSearch(e.target.value)}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          },
          htmlInput: { 'aria-label': t('common.search') },
        }}
      />
      <Stack direction="row" spacing={1} role="group" aria-label={t('content.status')} useFlexGap sx={{ flexWrap: 'wrap' }}>
        {STATUS_FILTERS.map((s) => (
          <Chip
            key={s}
            label={s === 'all' ? t('common.all') : t(`status.${s}`)}
            variant={p.status === s ? 'filled' : 'outlined'}
            color={p.status === s ? 'primary' : 'default'}
            onClick={() => p.onStatus(s)}
            aria-pressed={p.status === s}
          />
        ))}
        {p.showMine && (
          <Chip
            label={t('content.mine')}
            variant={p.mine ? 'filled' : 'outlined'}
            color={p.mine ? 'primary' : 'default'}
            onClick={p.onToggleMine}
            aria-pressed={p.mine}
          />
        )}
      </Stack>
    </Stack>
  );
}

interface ResultsProps {
  data: ListEnvelope<ContentSummary>;
  filtered: boolean;
  page: number;
  sort: SortField;
  order: 'asc' | 'desc';
  onPage: (p: number) => void;
  onSort: (f: SortField) => void;
  onOpen: (item: ContentSummary) => void;
  onDelete?: (item: ContentSummary) => void;
}

function ContentResults({ data, filtered, page, onPage, ...table }: ResultsProps) {
  if (data.data.length === 0) {
    return (
      <EmptyState
        title={filtered ? t('content.emptyFiltered') : t('content.emptyTitle')}
        body={filtered ? undefined : t('content.emptyBody')}
      />
    );
  }
  return (
    <>
      <ContentTable items={data.data} {...table} />
      {data.pagination.total_pages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 2 }}>
          <Pagination count={data.pagination.total_pages} page={page} onChange={(_, p) => onPage(p)} />
        </Box>
      )}
    </>
  );
}

/** UR-E05 / FR-CONTENT-10/11: filter chips, debounced title search, sortable table, pagination. */
export function ContentListPage() {
  const routeType = useParams<{ type: RouteType }>().type ?? 'articles';
  const isArticle = routeType === 'articles';
  const navigate = useNavigate();
  const user = useSessionStore(selectUser);
  const publisher = canPublish(user?.role ?? null);
  const s = useListState(routeType, user?.id);
  const [toDelete, setToDelete] = useState<ContentSummary | null>(null);
  const remove = useDeleteContent();

  return (
    <Box>
      <PageHeader
        title={isArticle ? t('content.articles') : t('content.pages')}
        actions={
          <Fab variant="extended" color="primary" onClick={() => navigate(`/content/${routeType}/new`)}>
            <AddIcon sx={{ mr: 1 }} />
            {isArticle ? t('content.newArticle') : t('content.newPage')}
          </Fab>
        }
      />
      <ContentFilters
        search={s.search}
        status={s.status}
        mine={s.mine}
        showMine={publisher}
        onSearch={s.setSearch}
        onStatus={s.setStatus}
        onToggleMine={s.toggleMine}
      />
      <Card>
        {s.list.isLoading && <LoadingBlock label={t('app.loading')} />}
        {s.list.data && (
          <ContentResults
            data={s.list.data}
            filtered={s.filtered}
            page={s.page}
            sort={s.sort}
            order={s.order}
            onPage={s.setPage}
            onSort={s.toggleSort}
            onOpen={(item) => navigate(`/content/${routeType}/${item.id}`)}
            onDelete={publisher ? setToDelete : undefined}
          />
        )}
      </Card>
      <ConfirmDialog
        open={toDelete !== null}
        title={t('content.deleteTitle')}
        body={t('content.deleteBody')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        destructive
        busy={remove.isPending}
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) remove.mutate(toDelete.id, { onSettled: () => setToDelete(null) });
        }}
      />
    </Box>
  );
}
