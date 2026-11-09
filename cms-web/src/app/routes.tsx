import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ApiKeysPage } from '../features/api-keys/pages/ApiKeysPage';
import { AuditLogPage } from '../features/audit/pages/AuditLogPage';
import { ForgotPasswordPage } from '../features/auth/pages/ForgotPasswordPage';
import { LoginPage } from '../features/auth/pages/LoginPage';
import { SetPasswordPage } from '../features/auth/pages/SetPasswordPage';
import { ContentEditorPage } from '../features/content/pages/ContentEditorPage';
import { ContentListPage } from '../features/content/pages/ContentListPage';
import { VersionHistoryPage } from '../features/content/pages/VersionHistoryPage';
import { DashboardPage } from '../features/dashboard/pages/DashboardPage';
import { MediaLibraryPage } from '../features/media/pages/MediaLibraryPage';
import { ProfilePage } from '../features/profile/pages/ProfilePage';
import { UsersPage } from '../features/users/pages/UsersPage';
import { AppShell } from './layouts/AppShell';
import { AuthGate, RequireRole } from './providers/AuthGate';

/** 03-DESIGN §11.2 navigation hierarchy. */
export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <SetPasswordPage mode="reset" /> },
  { path: '/accept-invite', element: <SetPasswordPage mode="invite" /> },
  {
    element: <AuthGate />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'content/:type', element: <ContentListPage /> },
          { path: 'content/:type/new', element: <ContentEditorPage /> },
          { path: 'content/:type/:id', element: <ContentEditorPage /> },
          { path: 'content/:type/:id/versions', element: <VersionHistoryPage /> },
          { path: 'media', element: <MediaLibraryPage /> },
          {
            path: 'users',
            element: (
              <RequireRole roles={['admin']}>
                <UsersPage />
              </RequireRole>
            ),
          },
          {
            path: 'audit',
            element: (
              <RequireRole roles={['admin']}>
                <AuditLogPage />
              </RequireRole>
            ),
          },
          {
            path: 'api-keys',
            element: (
              <RequireRole roles={['admin']}>
                <ApiKeysPage />
              </RequireRole>
            ),
          },
          { path: 'settings', element: <ProfilePage /> },
          { path: '*', element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
]);
