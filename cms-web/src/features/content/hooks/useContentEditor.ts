import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../../../shared/api/api-error';
import { errorMessage } from '../../../shared/api/error-message';
import { useUnsavedChangesPrompt } from '../../../shared/hooks/useUnsavedChangesPrompt';
import { t } from '../../../shared/i18n/t';
import { canPublish, selectUser, useSessionStore } from '../../../shared/stores/session.store';
import { notify } from '../../../shared/stores/ui.store';
import { availableActions, docText, missingForPublish } from '../types/content.logic';
import {
  routeToType,
  type Content,
  type ContentFields,
  type RichTextDoc,
  type RouteType,
  type TransitionAction,
} from '../types/content.types';
import {
  useCategories,
  useContent,
  useCreateContent,
  useDeleteContent,
  useSchedule,
  useTransition,
  useUpdateContent,
} from './content.hooks';
import { useAutosave } from './useAutosave';

export interface EditorValues {
  title: string;
  slug: string;
  body: RichTextDoc;
  seoTitle: string;
  seoDescription: string;
  tags: string[];
  category: string;
  featuredImageId: string | null;
  socialImageId: string | null;
}

export type EditorDialog = 'schedule' | 'delete' | 'unpublish' | null;

const EMPTY_VALUES: EditorValues = {
  title: '',
  slug: '',
  body: { type: 'doc', content: [] },
  seoTitle: '',
  seoDescription: '',
  tags: [],
  category: '',
  featuredImageId: null,
  socialImageId: null,
};

/** Server content → form values (null-safe strings for inputs). Pure. */
export function toValues(c?: Content): EditorValues {
  if (!c) return EMPTY_VALUES;
  return {
    title: c.title,
    slug: c.slug,
    body: c.body,
    seoTitle: c.seo.title ?? '',
    seoDescription: c.seo.description ?? '',
    tags: c.tags,
    category: c.category ?? '',
    featuredImageId: c.featuredImageId,
    socialImageId: c.socialImageId,
  };
}

/** Form values → API fields: empty strings become null/undefined; tags/category only for articles. Pure. */
export function toFields(v: EditorValues, isArticle: boolean): ContentFields & { title: string } {
  return {
    title: v.title,
    slug: v.slug || undefined,
    body: v.body,
    seoTitle: v.seoTitle || null,
    seoDescription: v.seoDescription || null,
    featuredImageId: v.featuredImageId,
    socialImageId: v.socialImageId,
    ...(isArticle ? { tags: v.tags, category: v.category || null } : {}),
  };
}

function useEditorRoute() {
  const params = useParams<{ type: RouteType; id?: string }>();
  const routeType = params.type ?? 'articles';
  const type = routeToType(routeType);
  return { id: params.id, idOrEmpty: params.id ?? '', isNew: !params.id, routeType, type, isArticle: type === 'article' };
}

function useEditorMutations(route: ReturnType<typeof useEditorRoute>) {
  const create = useCreateContent(route.type);
  const update = useUpdateContent(route.idOrEmpty);
  const transition = useTransition(route.idOrEmpty);
  const schedule = useSchedule(route.idOrEmpty);
  const remove = useDeleteContent();
  const busy = [create, update, transition, schedule, remove].some((m) => m.isPending);
  return { create, update, transition, schedule, remove, busy };
}

/**
 * Controller for the content editor page (03-DESIGN §12.4): queries, form,
 * autosave stream, mutations and dialogs. The page only renders what this returns.
 */
export function useContentEditor() {
  const route = useEditorRoute();
  const navigate = useNavigate();
  const user = useSessionStore(selectUser);
  const publisher = canPublish(user?.role ?? null);
  const query = useContent(route.id);
  const content = query.data;
  const categories = useCategories();
  const m = useEditorMutations(route);
  const [dialog, setDialog] = useState<EditorDialog>(null);

  const form = useForm<EditorValues>({ defaultValues: toValues(content), mode: 'onChange' });
  const { watch, reset, handleSubmit, setError, formState } = form;
  const values = watch();
  useEffect(() => {
    if (content) reset(toValues(content));
  }, [content, reset]);

  useUnsavedChangesPrompt(formState.isDirty && !formState.isSubmitting);

  const applyServerErrors = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError) {
        for (const [field, message] of Object.entries(err.fieldErrors())) {
          if (field in EMPTY_VALUES) setError(field as keyof EditorValues, { message });
        }
      }
      notify.error(errorMessage(err));
    },
    [setError],
  );

  const save = useCallback(
    async (v: EditorValues): Promise<Content> => {
      if (route.isNew) {
        const created = await m.create.mutateAsync(toFields(v, route.isArticle));
        reset(toValues(created));
        navigate(`/content/${route.routeType}/${created.id}`, { replace: true });
        return created;
      }
      const saved = await m.update.mutateAsync(toFields(v, route.isArticle));
      reset(v, { keepValues: true });
      return saved;
    },
    [route.isNew, route.isArticle, route.routeType, m.create, m.update, reset, navigate],
  );

  const autosave = useAutosave<EditorValues>(!route.isNew && content?.status !== 'archived', (v) => save(v));
  useEffect(() => {
    autosave.push({ value: values, dirty: formState.isDirty, valid: values.title.trim().length > 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- push on every form change only
  }, [JSON.stringify(values), formState.isDirty]);

  const bodyText = useMemo(() => docText(values.body), [values.body]);
  const saveIfDirty = async (): Promise<void> => {
    if (formState.isDirty) await save(values);
  };

  return {
    ...route,
    form,
    values,
    content,
    query,
    publisher,
    categories: categories.data ?? [],
    autosaveState: autosave.state,
    bodyText,
    missing: missingForPublish({ title: values.title, bodyText, seoDescription: values.seoDescription }),
    actions: content ? availableActions(content.status, publisher, content.author.id === user?.id) : [],
    busy: m.busy,
    dialog,
    setDialog,
    onSave: handleSubmit(async (v) => {
      try {
        await save(v);
        notify.success(t('content.saved'));
      } catch (err) {
        applyServerErrors(err);
      }
    }),
    runAction: async (a: TransitionAction): Promise<void> => {
      if (a === 'unpublish') {
        setDialog('unpublish');
        return;
      }
      try {
        await saveIfDirty();
        await m.transition.mutateAsync(a);
      } catch (err) {
        applyServerErrors(err);
      }
    },
    confirmSchedule: async (iso: string): Promise<void> => {
      try {
        await saveIfDirty();
        await m.schedule.mutateAsync(iso);
        setDialog(null);
      } catch (err) {
        applyServerErrors(err);
      }
    },
    unschedule: () => m.schedule.mutate(null),
    confirmDelete: () => {
      m.remove.mutate(route.idOrEmpty, {
        onSuccess: () => {
          reset(values);
          navigate(`/content/${route.routeType}`);
        },
      });
    },
    confirmUnpublish: () => m.transition.mutate('unpublish', { onSettled: () => setDialog(null) }),
  };
}

export type ContentEditor = ReturnType<typeof useContentEditor>;
