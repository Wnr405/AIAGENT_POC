import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ADMIN } from '../../../../test/mocks/fake-api';
import { renderPage } from '../../../../test/utils/app';
import { AuditLogPage } from './AuditLogPage';

const row = (i: number, over: Record<string, unknown> = {}) => ({
  id: `e${i}`,
  occurredAt: '2026-05-01T09:00:00.000Z',
  actorName: 'Ada',
  actorId: 'a1',
  action: 'content.publish',
  targetType: 'content',
  targetId: '12345678-aaaa-4000-8000-000000000001',
  summary: { from: 'draft', to: 'published' },
  ...over,
});

describe('AuditLogPage (FR-AUDIT-05/06)', () => {
  it('lists events (system actor, target id prefix, summary) and paginates', async () => {
    const { user, api } = renderPage(<AuditLogPage />, {
      user: ADMIN,
      seed: (a) => {
        a.state.audit.push(row(0, { actorName: null, targetId: null, action: 'auth.login_failed', targetType: 'user' }));
        for (let i = 1; i <= 55; i++) a.state.audit.push(row(i));
      },
    });
    expect(await screen.findByText('System')).toBeInTheDocument();
    expect(screen.getAllByText('content · 12345678').length).toBeGreaterThan(0);
    expect(screen.getAllByText('{"from":"draft","to":"published"}').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Go to page 2' }));
    await waitFor(() => expect(api.state.requests.some((r) => r.url.includes('page=2'))).toBe(true));
  });

  it('filters by action prefix and date range; shows the empty state', async () => {
    const { user, api } = renderPage(<AuditLogPage />, { user: ADMIN, seed: (a) => a.state.audit.push(row(1)) });
    await screen.findByText('Ada');
    await user.type(screen.getByRole('textbox', { name: 'Action (e.g. content. or content.publish)' }), 'user.');
    expect(await screen.findByText('No events match these filters.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('From'), '2026-05-01');
    await user.type(screen.getByLabelText('To'), '2026-05-02');
    await waitFor(() => expect(api.state.requests.some((r) => r.url.includes('from=') && r.url.includes('to='))).toBe(true));
  });

  it('FR-AUDIT-06: exports CSV with the current filters, and reports failures', async () => {
    const createObjectURL = vi.fn(() => 'blob:csv');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const clicked = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const { user, api, toasts } = renderPage(<AuditLogPage />, { user: ADMIN });
    await screen.findByText('No events match these filters.');
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));
    await waitFor(() => expect(clicked).toHaveBeenCalled());
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:csv');
    api.failNext('GET', /export\.csv$/, 500);
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));
    await waitFor(() => expect(toasts()).toContain('Something went wrong.'));
  });
});
