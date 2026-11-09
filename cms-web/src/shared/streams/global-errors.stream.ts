import { Subject } from 'rxjs';
import type { ApiError } from '../api/api-error';

/** 04-ARCH §5.5.1: aggregated network / 5xx errors (rendered as a snackbar by <GlobalErrorToasts/>). */
export const globalErrors$ = new Subject<ApiError>();
