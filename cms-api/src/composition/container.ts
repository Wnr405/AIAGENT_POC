import {
  AcceptInvite,
  ChangeOwnPassword,
  CompletePasswordReset,
  IssueOneTimeToken,
  RequestPasswordReset,
} from '../modules/auth/application/use-cases/password.use-cases';
import {
  AuthenticateAccessToken,
  Login,
  Logout,
  RefreshSession,
  RevokeUserSessions,
} from '../modules/auth/application/use-cases/session.use-cases';
import {
  AuthenticateApiKey,
  CreateApiKey,
  ListApiKeys,
  RevokeApiKey,
} from '../modules/auth/application/use-cases/api-keys.use-cases';
import type { AuthDeps } from '../modules/auth/application/use-cases/auth-deps';
import {
  ExportAuditCsv,
  ListAuditEvents,
  RecordAuditEvent,
} from '../modules/audit/application/use-cases/audit.use-cases';
import {
  ContentJobsImpl,
  ContentMediaUsage,
  CreateContent,
  DeleteContent,
  GetContent,
  GetContentStats,
  ListContent,
  ListVersions,
  PublishedContentQueryImpl,
  RevertContent,
  ScheduleContent,
  TransitionContent,
  UpdateContent,
} from '../modules/content/application/use-cases/content.use-cases';
import type { ContentDeps } from '../modules/content/application/use-cases/content-support';
import {
  DeleteMedia,
  FinalizeMedia,
  GenerateVariants,
  GetMedia,
  ListMedia,
  MediaPublicQuery,
  PresignUpload,
  PurgeDeletedMedia,
  UpdateMediaMetadata,
  type MediaDeps,
} from '../modules/media/application/use-cases/media.use-cases';
import { EmailAuthMailer } from '../modules/notifications/application/use-cases/email-auth-mailer';
import {
  GetPublicMedia,
  GetPublishedContentBySlug,
  InvalidatePublicCache,
  ListPublishedContent,
} from '../modules/public-api/application/use-cases/public.use-cases';
import {
  AdminResetPassword,
  DeactivateUser,
  GetUser,
  InviteUser,
  ListUsers,
  UpdateUser,
  type UsersDeps,
} from '../modules/users/application/use-cases/users.use-cases';
import type { AppSettings, Infrastructure } from './infrastructure';
import { PublishedContentReaderAdapter } from './published-content-reader.adapter';

function buildAuth(infra: Infrastructure, settings: AppSettings) {
  const { repos } = infra;
  // ── auth ────────────────────────────────────────────────────────────────
  const authDeps: AuthDeps = {
    accounts: repos.authAccounts,
    refreshTokens: repos.refreshTokens,
    oneTimeTokens: repos.oneTimeTokens,
    apiKeys: repos.apiKeys,
    hasher: infra.passwordHasher,
    signer: infra.tokenSigner,
    mailer: new EmailAuthMailer(infra.emailSender, settings.appName),
    secrets: infra.secrets,
    tokenHasher: infra.tokenHasher,
    ids: infra.ids,
    clock: infra.clock,
    events: infra.events,
    settings: {
      accessTokenTtlSeconds: settings.accessTokenTtlSeconds,
      refreshTokenTtlSeconds: settings.refreshTokenTtlSeconds,
      publicUrl: settings.publicUrl,
    },
  };
  const issueOneTimeToken = new IssueOneTimeToken(authDeps);
  const revokeUserSessions = new RevokeUserSessions(authDeps);
  const auth = {
    login: new Login(authDeps),
    refresh: new RefreshSession(authDeps),
    logout: new Logout(authDeps),
    requestPasswordReset: new RequestPasswordReset(authDeps, issueOneTimeToken),
    completePasswordReset: new CompletePasswordReset(authDeps),
    acceptInvite: new AcceptInvite(authDeps),
    changeOwnPassword: new ChangeOwnPassword(authDeps),
    authenticateAccessToken: new AuthenticateAccessToken(authDeps),
    authenticateApiKey: new AuthenticateApiKey(authDeps),
    createApiKey: new CreateApiKey(authDeps),
    listApiKeys: new ListApiKeys(authDeps),
    revokeApiKey: new RevokeApiKey(authDeps),
  };

  return { auth, issueOneTimeToken, revokeUserSessions };
}

function buildUsers(infra: Infrastructure, issueOneTimeToken: IssueOneTimeToken) {
  const { repos } = infra;
  // ── users ───────────────────────────────────────────────────────────────
  const usersDeps: UsersDeps = {
    users: repos.users,
    ids: infra.ids,
    clock: infra.clock,
    events: infra.events,
    tx: infra.tx,
    notifier: {
      invitationCreated: (u) => issueOneTimeToken.execute(u.id, 'invite'),
      passwordResetRequestedByAdmin: (u) => issueOneTimeToken.execute(u.id, 'password_reset'),
    },
  };
  const users = {
    invite: new InviteUser(usersDeps),
    update: new UpdateUser(usersDeps),
    deactivate: new DeactivateUser(usersDeps),
    list: new ListUsers(usersDeps),
    get: new GetUser(usersDeps),
    adminResetPassword: new AdminResetPassword(usersDeps),
  };

  return users;
}

function buildMedia(infra: Infrastructure, settings: AppSettings) {
  const { repos } = infra;
  // ── media (needs content usage → built lazily below) ───────────────────
  const contentUsage = new ContentMediaUsage({ contents: repos.contents });
  const mediaDeps: MediaDeps = {
    media: repos.media,
    storage: infra.storage,
    images: infra.images,
    usage: { isReferenced: (id) => contentUsage.isMediaReferenced(id) },
    jobs: infra.jobs,
    ids: infra.ids,
    clock: infra.clock,
    events: infra.events,
    settings: {
      maxUploadBytes: settings.maxUploadBytes,
      presignTtlSeconds: settings.presignTtlSeconds,
      variantsEnabled: settings.variantsEnabled,
      softDeleteRetentionDays: settings.softDeleteRetentionDays,
    },
  };
  const mediaPublic = new MediaPublicQuery(mediaDeps);
  const media = {
    presign: new PresignUpload(mediaDeps),
    finalize: new FinalizeMedia(mediaDeps),
    update: new UpdateMediaMetadata(mediaDeps),
    delete: new DeleteMedia(mediaDeps),
    list: new ListMedia(mediaDeps),
    get: new GetMedia(mediaDeps),
    generateVariants: new GenerateVariants(mediaDeps),
    purge: new PurgeDeletedMedia(mediaDeps),
  };

  return { media, mediaPublic };
}

function buildContent(infra: Infrastructure, settings: AppSettings, mediaPublic: MediaPublicQuery) {
  const { repos } = infra;
  // ── content ─────────────────────────────────────────────────────────────
  const contentDeps: ContentDeps = {
    contents: repos.contents,
    versions: repos.versions,
    users: repos.users,
    media: mediaPublic,
    ids: infra.ids,
    clock: infra.clock,
    events: infra.events,
    tx: infra.tx,
    settings: { categories: settings.categories, softDeleteRetentionDays: settings.softDeleteRetentionDays },
  };
  const content = {
    create: new CreateContent(contentDeps),
    update: new UpdateContent(contentDeps),
    get: new GetContent(contentDeps),
    list: new ListContent(contentDeps),
    transition: new TransitionContent(contentDeps),
    schedule: new ScheduleContent(contentDeps),
    delete: new DeleteContent(contentDeps),
    listVersions: new ListVersions(contentDeps),
    revert: new RevertContent(contentDeps),
    stats: new GetContentStats(contentDeps),
    categories: settings.categories,
  };
  const contentJobs = new ContentJobsImpl(contentDeps);

  return { content, contentJobs, contentDeps };
}

function buildAuditAndPublic(infra: Infrastructure, contentDeps: ContentDeps, mediaPublic: MediaPublicQuery) {
  const { repos } = infra;
  // ── audit ───────────────────────────────────────────────────────────────
  const recordAudit = new RecordAuditEvent({ audit: repos.audit, ids: infra.ids });
  const audit = {
    list: new ListAuditEvents({ audit: repos.audit, actors: repos.users }),
    exportCsv: new ExportAuditCsv({ audit: repos.audit, actors: repos.users }),
  };

  // ── public api ──────────────────────────────────────────────────────────
  const reader = new PublishedContentReaderAdapter(
    new PublishedContentQueryImpl(contentDeps),
    mediaPublic,
    repos.users,
  );
  const publicDeps = { reader, media: reader, cache: infra.cache, clock: infra.clock };
  const invalidatePublicCache = new InvalidatePublicCache(publicDeps);
  const publicApi = {
    list: new ListPublishedContent(publicDeps),
    getBySlug: new GetPublishedContentBySlug(publicDeps),
    getMedia: new GetPublicMedia(publicDeps),
  };

  return { recordAudit, audit, invalidatePublicCache, publicApi };
}

/**
 * Composition root (04-ARCH §4.10): the ONLY place that knows every module.
 * Pure TypeScript — NestJS modules just expose what this returns, and the
 * worker and the tests reuse it unchanged.
 */
export function buildContainer(infra: Infrastructure, settings: AppSettings) {
  const { auth, issueOneTimeToken, revokeUserSessions } = buildAuth(infra, settings);
  const users = buildUsers(infra, issueOneTimeToken);
  const { media, mediaPublic } = buildMedia(infra, settings);
  const { content, contentJobs, contentDeps } = buildContent(infra, settings, mediaPublic);
  const { recordAudit, audit, invalidatePublicCache, publicApi } = buildAuditAndPublic(infra, contentDeps, mediaPublic);

  // ── event wiring (04-ARCH §4.5.4) ───────────────────────────────────────
  infra.events.subscribe('*', (e) => recordAudit.execute(e));
  infra.events.subscribe('*', (e) => invalidatePublicCache.execute(e));
  infra.events.subscribe('user.deactivate', async (e) => {
    if (e.target.id) await revokeUserSessions.execute(e.target.id);
  });

  return {
    auth,
    users,
    content,
    media,
    audit,
    publicApi,
    jobs: {
      publishDue: contentJobs,
      purgeContent: contentJobs,
      purgeMedia: media.purge,
      generateVariants: media.generateVariants,
    },
    infra,
    settings,
  };
}

export type Container = ReturnType<typeof buildContainer>;
