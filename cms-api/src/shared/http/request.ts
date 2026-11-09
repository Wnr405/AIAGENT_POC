import type { Request } from 'express';
import type { ActorContext } from '../kernel/actor';

export interface CmsRequest extends Request {
  requestId?: string;
  actor?: ActorContext;
  apiKeyId?: string;
}

/** With `trust proxy` set, Express resolves the client IP from X-Forwarded-For. */
export const clientIp = (req: Request): string => req.ip ?? req.socket.remoteAddress ?? '0.0.0.0';

/** The matched Express route pattern (e.g. `/api/admin/content/:id`), if any — never the raw URL. */
export function routePath(req: Request): string | undefined {
  const route = req.route as { path?: unknown } | undefined;
  return typeof route?.path === 'string' ? route.path : undefined;
}
