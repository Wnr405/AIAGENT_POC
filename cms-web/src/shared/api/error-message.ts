import { t } from '../i18n/t';
import { ApiError } from './api-error';

/** 04-ARCH §6.4 FE behaviour per error class → human message for a toast. */
export function errorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return t('errors.generic');
  switch (err.status) {
    case 0:
      return t('errors.network');
    case 403:
      return t('errors.forbidden');
    case 404:
      return t('errors.notFound');
    case 409:
    case 422:
      return err.message;
    case 429:
      return t('errors.rateLimited', { seconds: err.retryAfterSeconds ?? 60 });
    default:
      return t('errors.generic');
  }
}
