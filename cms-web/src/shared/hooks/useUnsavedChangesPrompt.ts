import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';
import { t } from '../i18n/t';

/** 02-SRS §4.1: prompt before navigating away with unsaved changes (in-app and tab close). */
export function useUnsavedChangesPrompt(dirty: boolean): void {
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname);

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (window.confirm(t('common.unsavedChanges'))) blocker.proceed();
    else blocker.reset();
  }, [blocker]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);
}
