import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { aContent, ADMIN, AUTHOR } from '../../../../test/mocks/fake-api';
import { renderPage } from '../../../../test/utils/app';
import { DashboardPage } from './DashboardPage';

describe('DashboardPage (03-DESIGN §12.2)', () => {
  it('admins see stat cards and the audit feed with a link to the log', async () => {
    renderPage(<DashboardPage />, {
      user: ADMIN,
      seed: (a) => {
        a.state.contents.push(aContent({ status: 'published' }), aContent({ status: 'draft' }));
        a.state.audit.push(
          {
            id: 'e1',
            occurredAt: new Date().toISOString(),
            actorName: 'Ada',
            actorId: 'a',
            action: 'content.publish',
            targetType: 'content',
            targetId: null,
            summary: {},
          },
          {
            id: 'e2',
            occurredAt: new Date().toISOString(),
            actorName: null,
            actorId: null,
            action: 'auth.login_failed',
            targetType: 'user',
            targetId: null,
            summary: {},
          },
        );
      },
    });
    expect(screen.getByRole('heading', { name: 'Hello, Ada' })).toBeInTheDocument();
    expect(await screen.findByText('Ada · content.publish')).toBeInTheDocument();
    expect(screen.getByText('System · auth.login_failed')).toBeInTheDocument();
    const total = screen.getByText('Total items').parentElement as HTMLElement;
    expect(await within(total).findByText('2')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View audit log' })).toHaveAttribute('href', '/audit');
    expect(screen.getByRole('link', { name: 'New article' })).toHaveAttribute('href', '/content/articles/new');
  });

  it('others see their recent content, or an empty state', async () => {
    const view = renderPage(<DashboardPage />, { user: AUTHOR, seed: (a) => a.state.contents.push(aContent({ title: 'My recent post' })) });
    expect(await screen.findByText('My recent post')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'View audit log' })).not.toBeInTheDocument();
    view.unmount();
    renderPage(<DashboardPage />, { user: AUTHOR });
    expect(await screen.findByText('No activity yet.')).toBeInTheDocument();
  });

  it('renders placeholders while signed out data is unavailable', () => {
    renderPage(<DashboardPage />);
    expect(screen.getByRole('heading', { name: 'Hello,' })).toBeInTheDocument();
    expect(screen.getAllByText('–')).toHaveLength(4);
  });
});
