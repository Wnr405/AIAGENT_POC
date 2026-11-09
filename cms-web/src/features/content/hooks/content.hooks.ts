import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { errorMessage } from '../../../shared/api/error-message';
import { t } from '../../../shared/i18n/t';
import { notify } from '../../../shared/stores/ui.store';
import { contentApi } from '../api/content.api';
import type { Content, ContentFields, ContentFilter, ContentType, TransitionAction } from '../types/content.types';

export const contentKeys = {
  all: ['content'] as const,
  list: (f: ContentFilter) => ['content', 'list', f] as const,
  detail: (id: string) => ['content', 'detail', id] as const,
  versions: (id: string) => ['content', 'versions', id] as const,
  stats: ['content', 'stats'] as const,
  categories: ['content', 'categories'] as const,
};

export const useContentList = (f: ContentFilter) =>
  useQuery({ queryKey: contentKeys.list(f), queryFn: () => contentApi.list(f), placeholderData: keepPreviousData });

export const useContent = (id: string | undefined) =>
  useQuery({ queryKey: contentKeys.detail(id ?? 'new'), queryFn: () => contentApi.get(id as string), enabled: !!id });

export const useVersions = (id: string) => useQuery({ queryKey: contentKeys.versions(id), queryFn: () => contentApi.versions(id) });

export const useCategories = () => useQuery({ queryKey: contentKeys.categories, queryFn: contentApi.categories, staleTime: Infinity });

/** After any mutation: refresh lists/stats and seed the detail cache (04-ARCH §5.4.1). */
function useContentCacheSync() {
  const qc = useQueryClient();
  return (saved?: Content) => {
    if (saved) qc.setQueryData(contentKeys.detail(saved.id), saved);
    void qc.invalidateQueries({ queryKey: ['content', 'list'] });
    void qc.invalidateQueries({ queryKey: contentKeys.stats });
  };
}

export function useCreateContent(type: ContentType) {
  const sync = useContentCacheSync();
  return useMutation({
    mutationFn: (fields: ContentFields & { title: string }) => contentApi.create(type, fields),
    onSuccess: (c) => {
      sync(c);
      notify.success(t('content.created'));
    },
  });
}

/** Used by autosave and the Save button; toasts are left to the caller. */
export function useUpdateContent(id: string) {
  const sync = useContentCacheSync();
  return useMutation({ mutationFn: (fields: ContentFields) => contentApi.update(id, fields), onSuccess: sync });
}

const TRANSITION_TOAST: Record<TransitionAction, Parameters<typeof t>[0]> = {
  submit: 'content.submitted',
  publish: 'content.published',
  unpublish: 'content.unpublished',
  reject: 'content.saved',
  archive: 'content.saved',
};

export function useTransition(id: string) {
  const sync = useContentCacheSync();
  return useMutation({
    mutationFn: (action: TransitionAction) => contentApi.transition(id, action),
    onSuccess: (c, action) => {
      sync(c);
      notify.success(t(TRANSITION_TOAST[action]));
    },
    onError: (err) => notify.error(errorMessage(err)),
  });
}

export function useSchedule(id: string) {
  const sync = useContentCacheSync();
  return useMutation({
    mutationFn: (at: string | null) => contentApi.schedule(id, at),
    onSuccess: (c) => sync(c),
    onError: (err) => notify.error(errorMessage(err)),
  });
}

export function useDeleteContent() {
  const sync = useContentCacheSync();
  return useMutation({
    mutationFn: (id: string) => contentApi.remove(id),
    onSuccess: () => {
      sync();
      notify.success(t('content.deleted'));
    },
    onError: (err) => notify.error(errorMessage(err)),
  });
}

export function useRevert(id: string) {
  const sync = useContentCacheSync();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (version: number) => contentApi.revert(id, version),
    onSuccess: (c) => {
      sync(c);
      void qc.invalidateQueries({ queryKey: contentKeys.versions(id) });
      notify.success(t('content.reverted'));
    },
    onError: (err) => notify.error(errorMessage(err)),
  });
}
