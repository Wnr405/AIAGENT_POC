import type { AppSettings } from '../composition/infrastructure';
import type { Env } from './env.schema';

export function settingsFromEnv(env: Env): AppSettings {
  return {
    appName: env.APP_NAME,
    publicUrl: env.PUBLIC_URL.replace(/\/+$/, ''),
    accessTokenTtlSeconds: env.JWT_ACCESS_TTL,
    refreshTokenTtlSeconds: env.JWT_REFRESH_TTL,
    categories: env.CONTENT_CATEGORIES,
    softDeleteRetentionDays: env.SOFT_DELETE_RETENTION_DAYS,
    maxUploadBytes: Math.round(env.MEDIA_MAX_UPLOAD_MB * 1024 * 1024),
    presignTtlSeconds: 900,
    variantsEnabled: env.FEATURE_MEDIA_VARIANTS_ENABLED,
  };
}
