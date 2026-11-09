import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ADMIN, aUser } from '../../../../test/mocks/fake-api';
import { dialogsGone, renderPage } from '../../../../test/utils/app';
import { UsersPage } from './UsersPage';

describe('UsersPage (UR-A01..A05, 03-DESIGN §12.6)', () => {
  it('FR-USER-06: lists users with role, status and last login; paginates', async () => {
    const { user, api } = renderPage(<UsersPage />, {
      user: ADMIN,
      seed: (a) => {
        a.state.users.push(aUser({ name: 'Ada', email: 'ada@example.com', role: 'admin', lastLoginAt: new Date().toISOString() }));
        a.state.users.push(aUser({ name: 'Gone', email: 'gone@example.com', status: 'deactivated' }));
        for (let i = 0; i < 25; i++) a.state.users.push(aUser({ name: `User ${i}`, email: `u${i}@example.com` }));
      },
    });
    const row = (await screen.findByText('Ada')).closest('tr') as HTMLElement;
    expect(within(row).getByText('Admin')).toBeInTheDocument();
    expect(within(row).getByText('Active')).toBeInTheDocument();
    const gone = screen.getByText('Gone').closest('tr') as HTMLElement;
    expect(within(gone).getByText('Never')).toBeInTheDocument();
    expect(within(gone).queryByRole('button')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Go to page 2' }));
    expect(await screen.findByText('User 24')).toBeInTheDocument();
    expect(api.state.requests.some((r) => r.url.includes('page=2'))).toBe(true);
  });

  it('UR-A01: invites a user; validation and server errors (email taken) show on the form', async () => {
    const { user, api, toasts } = renderPage(<UsersPage />, {
      user: ADMIN,
      seed: (a) => a.state.users.push(aUser({ email: 'taken@example.com', name: 'Taken' })),
    });
    await screen.findByText('Taken');
    await user.click(screen.getByRole('button', { name: 'Invite user' }));
    const dialog = await screen.findByRole('dialog', { name: 'Invite user' });
    await user.click(within(dialog).getByRole('button', { name: 'Invite user' }));
    expect(await within(dialog).findAllByText('Required')).toHaveLength(2);
    await user.type(within(dialog).getByRole('textbox', { name: 'Email' }), 'taken@example.com');
    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Dup');
    await user.click(within(dialog).getByRole('button', { name: 'Invite user' }));
    expect(await within(dialog).findByText('Email is already in use')).toBeInTheDocument();
    await user.clear(within(dialog).getByRole('textbox', { name: 'Email' }));
    await user.type(within(dialog).getByRole('textbox', { name: 'Email' }), 'new@example.com');
    await user.click(within(dialog).getByRole('combobox', { name: 'Role' }));
    await user.click(await screen.findByRole('option', { name: 'Editor' }));
    await user.click(within(dialog).getByRole('button', { name: 'Invite user' }));
    await waitFor(() => expect(api.state.users.map((u) => u.email)).toContain('new@example.com'));
    expect(api.state.users.find((u) => u.email === 'new@example.com')?.role).toBe('editor');
    expect(toasts()).toContain('Invitation sent');
    await dialogsGone();
    await user.click(screen.getByRole('button', { name: 'Invite user' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Invite user' })).getByRole('button', { name: 'Cancel' }));
    await dialogsGone();
  });

  it('UR-A02/A03/A05: change role, send reset / resend invite, deactivate after confirming', async () => {
    const { user, api, toasts } = renderPage(<UsersPage />, {
      user: ADMIN,
      seed: (a) =>
        a.state.users.push(aUser({ id: 'u1', name: 'Bob', role: 'author' }), aUser({ id: 'u2', name: 'Ivy', status: 'invited' })),
    });
    await user.click(await screen.findByRole('button', { name: 'Actions: Bob' }));
    await user.click(screen.getByRole('menuitem', { name: 'Change role: Editor' }));
    await waitFor(() => expect(api.state.users[0]?.role).toBe('editor'));
    await user.click(await screen.findByRole('button', { name: 'Actions: Bob' }));
    await user.click(screen.getByRole('menuitem', { name: 'Send password reset' }));
    await waitFor(() => expect(toasts()).toContain('Email sent'));
    await user.click(await screen.findByRole('button', { name: 'Actions: Ivy' }));
    expect(screen.getByRole('menuitem', { name: 'Resend invite' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await user.click(await screen.findByRole('button', { name: 'Actions: Bob' }));
    await user.click(screen.getByRole('menuitem', { name: 'Deactivate' }));
    const confirm = await screen.findByRole('dialog', { name: 'Deactivate Bob?' });
    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    await dialogsGone();
    await user.click(await screen.findByRole('button', { name: 'Actions: Bob' }));
    await user.click(screen.getByRole('menuitem', { name: 'Deactivate' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Deactivate Bob?' })).getByRole('button', { name: 'Deactivate' }));
    await waitFor(() => expect(api.state.users[0]?.status).toBe('deactivated'));
  });

  it('FR-USER-04: shows the server message when a change is refused', async () => {
    const { user, api, toasts } = renderPage(<UsersPage />, {
      user: ADMIN,
      seed: (a) => a.state.users.push(aUser({ id: 'u1', name: 'Last Admin', role: 'admin' })),
    });
    api.failNext('PATCH', /\/users\/u1$/, 409, { error: { code: 'CONFLICT', message: 'At least one active admin is required' } });
    await user.click(await screen.findByRole('button', { name: 'Actions: Last Admin' }));
    await user.click(screen.getByRole('menuitem', { name: 'Change role: Author' }));
    await waitFor(() => expect(toasts()).toContain('At least one active admin is required'));
  });
});
