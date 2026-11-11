import {
  extendZodWithOpenApi,
  OpenAPIRegistry,
  OpenApiGeneratorV31,
  type RouteConfig,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import {
  ChangePasswordRequest,
  CreateApiKeyRequest,
  ForgotPasswordRequest,
  LoginRequest,
  SessionResponse,
  SetPasswordWithTokenRequest,
} from '../modules/auth/adapters/in/http/auth.dto';
import { AuditQuery } from '../modules/audit/adapters/in/http/audit.controller';
import {
  CreateContentRequest,
  ListContentQuery,
  ScheduleRequest,
  UpdateContentRequest,
} from '../modules/content/adapters/in/http/content.dto';
import {
  FinalizeRequest,
  ListMediaQuery,
  PresignRequest,
  UpdateMediaRequest,
} from '../modules/media/adapters/in/http/media.controller';
import { PublicListQuery } from '../modules/public-api/adapters/in/http/public.controller';
import {
  InviteUserRequest,
  ListUsersQuery,
  UpdateUserRequest,
} from '../modules/users/adapters/in/http/users.controller';

extendZodWithOpenApi(z);

/**
 * FR-PUBAPI-07: OpenAPI 3.1 generated from the SAME Zod schemas the
 * controllers validate with, so spec and implementation cannot drift.
 * `pnpm openapi:generate` writes openapi.json; CI fails if it changed.
 */
const ErrorEnvelope = z.object({
  error: z.object({ code: z.string(), message: z.string(), details: z.record(z.unknown()).optional() }),
});
const Pagination = z.object({ page: z.number(), page_size: z.number(), total: z.number(), total_pages: z.number() });
const ListOf = (item: z.ZodTypeAny) => z.object({ data: z.array(item), pagination: Pagination });

const PublicMedia = z.object({
  id: z.string().uuid(),
  url: z.string(),
  alt: z.string().nullable(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  variants: z.record(z.object({ url: z.string(), width: z.number(), height: z.number() })),
});
const PublicSummary = z.object({
  id: z.string().uuid(),
  type: z.enum(['article', 'page']),
  title: z.string(),
  slug: z.string(),
  excerpt: z.string(),
  author: z.object({ name: z.string() }).nullable(),
  featured_image: PublicMedia.nullable(),
  tags: z.array(z.string()).optional(),
  category: z.string().nullable().optional(),
  parent_id: z.string().uuid().nullable().optional(),
  published_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
const PublicDetail = PublicSummary.extend({
  body: z.record(z.unknown()).describe('Sanitised ProseMirror/TipTap JSON document'),
  body_html: z.string(),
  seo: z.object({ title: z.string(), description: z.string(), social_image: PublicMedia.nullable() }),
});

const json = (schema: z.ZodTypeAny) => ({ content: { 'application/json': { schema } } });
const errors = {
  400: { description: 'Malformed request', ...json(ErrorEnvelope) },
  401: { description: 'Unauthenticated', ...json(ErrorEnvelope) },
  403: { description: 'Forbidden', ...json(ErrorEnvelope) },
  404: { description: 'Not found', ...json(ErrorEnvelope) },
  409: { description: 'Conflict (slug collision, invalid transition)', ...json(ErrorEnvelope) },
  422: { description: 'Validation error', ...json(ErrorEnvelope) },
  429: { description: 'Rate limited', ...json(ErrorEnvelope) },
};
const ok = (schema: z.ZodTypeAny = z.record(z.unknown()), description = 'OK') => ({ description, ...json(schema) });

type Spec = Omit<RouteConfig, 'responses'> & { responses?: RouteConfig['responses'] };

type Security = { [name: string]: string[] }[];
type Add = (tag: string, security: Security | undefined, spec: Spec) => void;
const id = z.object({ id: z.string().uuid() });

function registerAuthRoutes(add: Add, admin: Security): void {
  add('Auth', undefined, {
    method: 'post',
    path: '/api/admin/auth/login',
    request: { body: json(LoginRequest) },
    responses: { 200: ok(SessionResponse, 'Access token; refresh token set as httpOnly cookie') },
  });
  add('Auth', undefined, {
    method: 'post',
    path: '/api/admin/auth/refresh',
    summary: 'Rotate refresh cookie (requires X-CMS-CSRF: 1)',
    responses: { 200: ok(SessionResponse) },
  });
  add('Auth', undefined, {
    method: 'post',
    path: '/api/admin/auth/logout',
    responses: { 204: { description: 'Logged out' } },
  });
  add('Auth', undefined, {
    method: 'post',
    path: '/api/admin/auth/password/forgot',
    request: { body: json(ForgotPasswordRequest) },
    responses: { 202: { description: 'Accepted (always)' } },
  });
  add('Auth', undefined, {
    method: 'post',
    path: '/api/admin/auth/password/reset',
    request: { body: json(SetPasswordWithTokenRequest) },
    responses: { 204: { description: 'Password changed' } },
  });
  add('Auth', undefined, {
    method: 'post',
    path: '/api/admin/auth/invite/accept',
    request: { body: json(SetPasswordWithTokenRequest) },
    responses: { 204: { description: 'Account activated' } },
  });
  add('Auth', admin, { method: 'get', path: '/api/admin/auth/me' });
  add('Auth', admin, {
    method: 'post',
    path: '/api/admin/auth/me/password',
    request: { body: json(ChangePasswordRequest) },
    responses: { 204: { description: 'Changed; all sessions revoked' } },
  });
}

function registerUsersRoutes(add: Add, admin: Security): void {
  add('Users', admin, { method: 'get', path: '/api/admin/users', request: { query: ListUsersQuery } });
  add('Users', admin, { method: 'post', path: '/api/admin/users', request: { body: json(InviteUserRequest) } });
  add('Users', admin, {
    method: 'patch',
    path: '/api/admin/users/{id}',
    request: { params: id, body: json(UpdateUserRequest) },
  });
  add('Users', admin, { method: 'post', path: '/api/admin/users/{id}/deactivate', request: { params: id } });
  add('Users', admin, {
    method: 'post',
    path: '/api/admin/users/{id}/reset-password',
    request: { params: id },
    responses: { 202: { description: 'Email sent' } },
  });
}

function registerContentRoutes(add: Add, admin: Security): void {
  add('Content', admin, { method: 'get', path: '/api/admin/content', request: { query: ListContentQuery } });
  add('Content', admin, { method: 'post', path: '/api/admin/content', request: { body: json(CreateContentRequest) } });
  add('Content', admin, { method: 'get', path: '/api/admin/content/stats' });
  add('Content', admin, { method: 'get', path: '/api/admin/content/categories' });
  add('Content', admin, { method: 'get', path: '/api/admin/content/{id}', request: { params: id } });
  add('Content', admin, {
    method: 'patch',
    path: '/api/admin/content/{id}',
    request: { params: id, body: json(UpdateContentRequest) },
  });
  for (const action of ['submit', 'reject', 'publish', 'unpublish', 'archive']) {
    add('Content', admin, { method: 'post', path: `/api/admin/content/{id}/${action}`, request: { params: id } });
  }
  add('Content', admin, {
    method: 'post',
    path: '/api/admin/content/{id}/schedule',
    request: { params: id, body: json(ScheduleRequest) },
  });
  add('Content', admin, {
    method: 'delete',
    path: '/api/admin/content/{id}',
    request: { params: id },
    responses: { 204: { description: 'Soft-deleted' } },
  });
  add('Content', admin, { method: 'get', path: '/api/admin/content/{id}/versions', request: { params: id } });
  add('Content', admin, {
    method: 'post',
    path: '/api/admin/content/{id}/revert/{version}',
    request: { params: id.extend({ version: z.coerce.number().int() }) },
  });
}

function registerMediaAuditKeys(add: Add, admin: Security): void {
  // ── Media ─────────────────────────────────────────────────────────────
  add('Media', admin, { method: 'post', path: '/api/admin/media/presign', request: { body: json(PresignRequest) } });
  add('Media', admin, { method: 'post', path: '/api/admin/media', request: { body: json(FinalizeRequest) } });
  add('Media', admin, { method: 'get', path: '/api/admin/media', request: { query: ListMediaQuery } });
  add('Media', admin, { method: 'get', path: '/api/admin/media/{id}', request: { params: id } });
  add('Media', admin, {
    method: 'patch',
    path: '/api/admin/media/{id}',
    request: { params: id, body: json(UpdateMediaRequest) },
  });
  add('Media', admin, {
    method: 'delete',
    path: '/api/admin/media/{id}',
    request: { params: id, query: z.object({ force: z.enum(['true', 'false']).optional() }) },
    responses: { 204: { description: 'Deleted' } },
  });

  // ── Audit & API keys ─────────────────────────────────────────────────
  add('Audit', admin, { method: 'get', path: '/api/admin/audit', request: { query: AuditQuery } });
  add('Audit', admin, {
    method: 'get',
    path: '/api/admin/audit/export.csv',
    request: { query: AuditQuery },
    responses: { 200: { description: 'CSV', content: { 'text/csv': { schema: z.string() } } } },
  });
  add('API keys', admin, { method: 'get', path: '/api/admin/api-keys' });
  add('API keys', admin, {
    method: 'post',
    path: '/api/admin/api-keys',
    request: { body: json(CreateApiKeyRequest) },
    responses: { 200: ok(z.object({ id: z.string(), key: z.string().describe('Shown once') })) },
  });
  add('API keys', admin, {
    method: 'delete',
    path: '/api/admin/api-keys/{id}',
    request: { params: id },
    responses: { 204: { description: 'Revoked' } },
  });
}

function registerPublicRoutes(add: Add, pub: Security): void {
  // ── Public API v1 ─────────────────────────────────────────────────────
  const slug = z.object({ slug: z.string() });
  const cached = { 304: { description: 'Not modified (If-None-Match)' } };
  add('Public', pub, {
    method: 'get',
    path: '/api/v1/articles',
    request: { query: PublicListQuery },
    responses: { 200: ok(ListOf(PublicSummary)), ...cached },
  });
  add('Public', pub, {
    method: 'get',
    path: '/api/v1/articles/{slug}',
    request: { params: slug },
    responses: { 200: ok(z.object({ data: PublicDetail })), ...cached },
  });
  add('Public', pub, {
    method: 'get',
    path: '/api/v1/pages',
    request: { query: PublicListQuery },
    responses: { 200: ok(ListOf(PublicSummary)), ...cached },
  });
  add('Public', pub, {
    method: 'get',
    path: '/api/v1/pages/{slug}',
    request: { params: slug },
    responses: { 200: ok(z.object({ data: PublicDetail })), ...cached },
  });
  add('Public', pub, {
    method: 'get',
    path: '/api/v1/media/{id}',
    request: { params: id },
    responses: { 200: ok(z.object({ data: PublicMedia })), ...cached },
  });
}

export function buildOpenApiDocument(version: string): ReturnType<OpenApiGeneratorV31['generateDocument']> {
  const r = new OpenAPIRegistry();
  const bearer = r.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
  });
  const apiKey = r.registerComponent('securitySchemes', 'apiKey', { type: 'apiKey', in: 'header', name: 'X-API-Key' });
  const add: Add = (tag, security, spec) => {
    r.registerPath({ tags: [tag], security, ...spec, responses: { 200: ok(), ...errors, ...spec.responses } });
  };
  const admin: Security = [{ [bearer.name]: [] }];
  registerAuthRoutes(add, admin);
  registerUsersRoutes(add, admin);
  registerContentRoutes(add, admin);
  registerMediaAuditKeys(add, admin);
  registerPublicRoutes(add, [{ [apiKey.name]: [] }]);

  return new OpenApiGeneratorV31(r.definitions).generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'CMS API',
      version,
      description: 'Admin API (Bearer JWT) and public read-only API (X-API-Key). See 02-SRS §7.',
    },
    servers: [{ url: '/' }],
  });
}
