import { Box, Breadcrumbs, Card, CardContent, Link as MuiLink, MenuItem, Stack, TextField, Typography } from '@mui/material';
import Grid from '@mui/material/Grid2';
import { Link } from 'react-router-dom';
import { ConfirmDialog, LoadingBlock } from '../../../design-system/components';
import { errorMessage } from '../../../shared/api/error-message';
import { t } from '../../../shared/i18n/t';
import { slugify, SLUG_PATTERN } from '../../../shared/utils/slug';
import { AutosaveIndicator } from '../components/AutosaveIndicator';
import { ImageField } from '../components/ImageField';
import { PublishPanel } from '../components/PublishPanel';
import { RichTextEditor } from '../components/RichTextEditor';
import { ScheduleDialog } from '../components/ScheduleDialog';
import { SeoPanel } from '../components/SeoPanel';
import { TagInput } from '../components/TagInput';
import { useContentEditor, type ContentEditor } from '../hooks/useContentEditor';

const dirty = { shouldDirty: true } as const;

function MainColumn({ e }: { e: ContentEditor }) {
  const { register, setValue, formState } = e.form;
  return (
    <Stack spacing={2}>
      <TextField
        placeholder={t('content.titlePlaceholder')}
        variant="standard"
        {...register('title', { required: t('common.required'), maxLength: 200 })}
        error={!!formState.errors.title}
        helperText={formState.errors.title?.message}
        slotProps={{ input: { disableUnderline: true, sx: { typography: 'h2' } }, htmlInput: { 'aria-label': t('content.title') } }}
        onBlur={(ev) => {
          if (!e.values.slug && ev.target.value) setValue('slug', slugify(ev.target.value), dirty);
        }}
      />
      <AutosaveIndicator state={e.autosaveState} />
      <TextField
        label={t('content.slug')}
        variant="filled"
        {...register('slug', { validate: (s) => !s || SLUG_PATTERN.test(s) || t('content.slugHelp') })}
        error={!!formState.errors.slug}
        helperText={formState.errors.slug?.message ?? t('content.slugHelp')}
      />
      <RichTextEditor value={e.values.body} revision={e.content?.updatedAt ?? 'new'} onChange={(doc) => setValue('body', doc, dirty)} />
    </Stack>
  );
}

function ArticleFields({ e }: { e: ContentEditor }) {
  const { setValue } = e.form;
  return (
    <>
      <TagInput value={e.values.tags} onChange={(tags) => setValue('tags', tags, dirty)} />
      <TextField
        select
        label={t('content.category')}
        value={e.values.category}
        onChange={(ev) => setValue('category', ev.target.value, dirty)}
      >
        <MenuItem value="">{t('common.none')}</MenuItem>
        {e.categories.map((c) => (
          <MenuItem key={c} value={c}>
            {c}
          </MenuItem>
        ))}
      </TextField>
    </>
  );
}

function SideColumn({ e }: { e: ContentEditor }) {
  const { setValue, formState } = e.form;
  return (
    <Stack spacing={2} sx={{ position: { lg: 'sticky' }, top: { lg: 88 } }}>
      <Card>
        <CardContent>
          <PublishPanel
            isNew={e.isNew}
            status={e.content?.status ?? 'draft'}
            scheduledAt={e.content?.scheduledAt ?? null}
            actions={e.actions}
            missing={e.missing}
            canSchedule={e.publisher}
            canDelete={e.publisher}
            busy={e.busy}
            onSave={() => void e.onSave()}
            onAction={(a) => void e.runAction(a)}
            onSchedule={() => e.setDialog('schedule')}
            onUnschedule={e.unschedule}
            onDelete={() => e.setDialog('delete')}
          />
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <SeoPanel
            seoTitle={e.values.seoTitle}
            seoDescription={e.values.seoDescription}
            defaultTitle={e.values.title}
            defaultDescription={e.bodyText}
            errors={{ seoTitle: formState.errors.seoTitle?.message, seoDescription: formState.errors.seoDescription?.message }}
            onChange={(p) => {
              if (p.seoTitle !== undefined) setValue('seoTitle', p.seoTitle, dirty);
              if (p.seoDescription !== undefined) setValue('seoDescription', p.seoDescription, dirty);
            }}
          />
          <Box sx={{ mt: 2 }}>
            <ImageField
              label="content.socialImage"
              value={e.values.socialImageId}
              onChange={(id) => setValue('socialImageId', id, dirty)}
            />
          </Box>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <ImageField
              label="content.featuredImage"
              value={e.values.featuredImageId}
              onChange={(id) => setValue('featuredImageId', id, dirty)}
            />
            {e.isArticle && <ArticleFields e={e} />}
            {!e.isNew && (
              <MuiLink component={Link} to={`/content/${e.routeType}/${e.idOrEmpty}/versions`}>
                {t('content.versions')}
              </MuiLink>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}

function EditorDialogs({ e }: { e: ContentEditor }) {
  return (
    <>
      <ScheduleDialog
        open={e.dialog === 'schedule'}
        busy={e.busy}
        onClose={() => e.setDialog(null)}
        onConfirm={(iso) => void e.confirmSchedule(iso)}
      />
      <ConfirmDialog
        open={e.dialog === 'delete'}
        title={t('content.deleteTitle')}
        body={t('content.deleteBody')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        destructive
        busy={e.busy}
        onCancel={() => e.setDialog(null)}
        onConfirm={e.confirmDelete}
      />
      <ConfirmDialog
        open={e.dialog === 'unpublish'}
        title={t('content.unpublishTitle')}
        body={t('content.unpublishBody')}
        confirmLabel={t('content.unpublish')}
        cancelLabel={t('common.cancel')}
        destructive
        busy={e.busy}
        onCancel={() => e.setDialog(null)}
        onConfirm={e.confirmUnpublish}
      />
    </>
  );
}

function newTitle(isArticle: boolean): string {
  return isArticle ? t('content.newArticle') : t('content.newPage');
}

/** Container page: queries + form + autosave stream + mutations (03-DESIGN §12.4). */
export function ContentEditorPage() {
  const e = useContentEditor();
  if (!e.isNew && e.query.isLoading) return <LoadingBlock label={t('app.loading')} />;
  if (!e.isNew && e.query.isError) return <Typography role="alert">{errorMessage(e.query.error)}</Typography>;

  return (
    <Box component="form" onSubmit={(ev) => void e.onSave(ev)} noValidate>
      <Breadcrumbs sx={{ mb: 2 }}>
        <MuiLink component={Link} to={`/content/${e.routeType}`} underline="hover">
          {e.isArticle ? t('content.articles') : t('content.pages')}
        </MuiLink>
        <Typography color="text.primary">{e.values.title || newTitle(e.isArticle)}</Typography>
      </Breadcrumbs>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <MainColumn e={e} />
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <SideColumn e={e} />
        </Grid>
      </Grid>
      <EditorDialogs e={e} />
    </Box>
  );
}
