import { ThemeProvider } from '@mui/material';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { buildTheme } from '../theme/theme';
import { ConfirmDialog, EmptyState, PageHeader, StatCard, StatusChip } from './index';

const wrap = (ui: React.ReactElement) => render(<ThemeProvider theme={buildTheme('light')}>{ui}</ThemeProvider>);

describe('design-system primitives', () => {
  it('StatusChip shows text (never colour alone) and exposes the status', () => {
    wrap(<StatusChip status="in_review" label="In review" />);
    expect(screen.getByText('In review').closest('[data-status]')).toHaveAttribute('data-status', 'in_review');
  });

  it('ConfirmDialog focuses confirm and calls back (NFR-USE-02)', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    wrap(
      <ConfirmDialog
        open
        title="Delete?"
        body="Sure?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByRole('dialog', { name: 'Delete?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect([onCancel.mock.calls.length, onConfirm.mock.calls.length]).toEqual([1, 1]);
  });

  it('PageHeader, StatCard and EmptyState render their content', () => {
    wrap(
      <>
        <PageHeader title="Articles" subtitle="All of them" actions={<button>New</button>} />
        <StatCard label="Published" value={98} />
        <EmptyState title="Nothing" body="Add one" action={<button>Add</button>} />
      </>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Articles' })).toBeInTheDocument();
    expect(screen.getByText('98')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('NothingAdd oneAdd');
  });
});

describe('design-system variants', () => {
  it('EmptyState renders an optional icon and action; ConfirmDialog has a non-destructive style', () => {
    wrap(<EmptyState icon={<span>ICON</span>} title="Empty" action={<button>Go</button>} />);
    expect(screen.getByText('ICON')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go' })).toBeInTheDocument();
    wrap(
      <ConfirmDialog open title="Archive?" body="b" confirmLabel="Archive" cancelLabel="Cancel" onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Archive' })).toHaveClass('MuiButton-colorPrimary');
  });

  it('builds a dark theme from the MD3 dark tokens', () => {
    expect(buildTheme('dark').palette.mode).toBe('dark');
  });
});
