import { ThemeProvider } from '@mui/material';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { buildTheme } from '../../../design-system/theme/theme';
import { PublishPanel, type PublishPanelProps } from './PublishPanel';

const props = (over: Partial<PublishPanelProps> = {}): PublishPanelProps => ({
  isNew: false,
  status: 'draft',
  scheduledAt: null,
  actions: ['submit', 'publish'],
  missing: [],
  canSchedule: true,
  canDelete: true,
  busy: false,
  onSave: vi.fn(),
  onAction: vi.fn(),
  onSchedule: vi.fn(),
  onUnschedule: vi.fn(),
  onDelete: vi.fn(),
  ...over,
});
const wrap = (p: PublishPanelProps) =>
  render(
    <ThemeProvider theme={buildTheme('light')}>
      <PublishPanel {...p} />
    </ThemeProvider>,
  );

describe('PublishPanel (03-DESIGN §12.4)', () => {
  it('offers the allowed actions and reports clicks', async () => {
    const p = props();
    wrap(p);
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
    expect(p.onAction).toHaveBeenCalledWith('publish');
    expect(screen.getByRole('button', { name: 'Schedule…' })).toBeEnabled();
  });

  it('disables publishing and explains why when requirements are missing (FR-CONTENT-06)', () => {
    wrap(props({ missing: ['body', 'meta description'] }));
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled();
    expect(screen.getByText('Before publishing, add: body, meta description')).toBeInTheDocument();
  });

  it('authors see no publish/schedule/delete controls (RK-06)', () => {
    wrap(props({ actions: ['submit'], canSchedule: false, canDelete: false }));
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Schedule…' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  });

  it('shows the scheduled chip and a cancel action when scheduled', async () => {
    const p = props({ scheduledAt: '2026-06-01T10:00:00Z' });
    wrap(p);
    expect(screen.getByText('Scheduled')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel schedule' }));
    expect(p.onUnschedule).toHaveBeenCalled();
  });

  it('new items only offer Save draft', () => {
    wrap(props({ isNew: true }));
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Save draft']);
  });
});
