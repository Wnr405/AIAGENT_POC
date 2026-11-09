import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { errorMessage } from '../../../shared/api/error-message';
import { t } from '../../../shared/i18n/t';
import { notify } from '../../../shared/stores/ui.store';
import { mediaApi, type MediaFilter } from '../api/media.api';
import { uploadAll$, xhrPut, type UploadEvent } from '../streams/upload.stream';

export const useMediaList = (f: MediaFilter) =>
  useQuery({ queryKey: ['media', 'list', f], queryFn: () => mediaApi.list(f), placeholderData: keepPreviousData });

export const useMediaItem = (id: string | null) =>
  useQuery({ queryKey: ['media', 'detail', id], queryFn: () => mediaApi.get(id as string), enabled: !!id });

/** Drives uploadAll$ and exposes per-file progress for the UI. */
export function useUploads() {
  const qc = useQueryClient();
  const [progress, setProgress] = useState<Record<string, number>>({});
  const start = useCallback(
    (files: File[]) => {
      uploadAll$(files, { presign: mediaApi.presign, finalize: mediaApi.finalize, put: xhrPut }).subscribe({
        next: (e: UploadEvent) => {
          if (e.kind === 'progress') setProgress((p) => ({ ...p, [e.file]: e.percent }));
          else {
            setProgress((p) => Object.fromEntries(Object.entries(p).filter(([name]) => name !== e.file)));
            if (e.kind === 'done') notify.success(t('media.uploaded', { name: e.file }));
            else notify.error(t('media.uploadFailed', { name: e.file, reason: errorMessage(e.error) }));
          }
        },
        complete: () => void qc.invalidateQueries({ queryKey: ['media'] }),
      });
    },
    [qc],
  );
  return { start, progress };
}

export function useUpdateMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string; altText?: string | null; caption?: string | null }) => mediaApi.update(id, patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['media'] });
      notify.success(t('content.saved'));
    },
    onError: (err) => notify.error(errorMessage(err)),
  });
}

export function useDeleteMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, force }: { id: string; force: boolean }) => mediaApi.remove(id, force),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['media'] });
      notify.success(t('content.deleted'));
    },
    onError: (err) => notify.error(errorMessage(err)),
  });
}
