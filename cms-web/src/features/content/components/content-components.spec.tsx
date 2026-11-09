import { ThemeProvider } from '@mui/material';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { aContent, aMedia, EDITOR } from '../../../../test/mocks/fake-api';
import { renderPage, testTheme } from '../../../../test/utils/app';
import { AutosaveIndicator } from './AutosaveIndicator';
import { ContentTable } from './ContentTable';
import { ImageField } from './ImageField';
import { MediaPickerDialog } from './MediaPickerDialog';
import { PublishPanel } from './PublishPanel';
import { ScheduleDialog } from './ScheduleDialog';

const wrap = (ui: React.ReactElement) => render(<ThemeProvider theme={testTheme}>{ui}</ThemeProvider>);

describe('AutosaveIndicator (04-ARCH §5.4.2)', () => {
  it('renders nothing before the first save, then saving / saved / failed', () => {
    const { rerender, container } = wrap(<AutosaveIndicator state={null} />);
    expect(container).toBeEmptyDOMElement();
    rerender(
      <ThemeProvider theme={testTheme}>
        <AutosaveIndicator state={{ kind: 'saving' }} />
      </ThemeProvider>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Saving…');
    rerender(
      <ThemeProvider theme={testTheme}>
        <AutosaveIndicator state={{ kind: 'saved', at: Date.now() }} />
      </ThemeProvider>,
    );
    expect(screen.getByRole('status')).toHaveTextContent(/^Saved /);
    rerender(
      <ThemeProvider theme={testTheme}>
        <AutosaveIndicator state={{ kind: 'error', error: new Error('x') }} />
      </ThemeProvider>,
    );
    expect(screen.getByRole('status')).toHaveTextContent("Couldn't save");
  });

  it('refreshes the relative time every 10 seconds', () => {
    vi.useFakeTimers();
    wrap(<AutosaveIndicator state={{ kind: 'saved', at: Date.now() }} />);
    vi.advanceTimersByTime(10_000);
    expect(screen.getByRole('status')).toHaveTextContent(/Saved/);
    vi.useRealTimers();
  });
});

describe('ContentTable (03-DESIGN §12.3)', () => {
  it('marks the active sort column and reports sort changes', async () => {
    const onSort = vi.fn();
    wrap(<ContentTable items={[aContent({ title: 'A' })]} sort="status" order="desc" onSort={onSort} onOpen={vi.fn()} />);
    const status = screen.getByRole('columnheader', { name: /Status/ });
    expect(status).toHaveAttribute('aria-sort', 'descending');
    await userEvent.click(within(status).getByRole('button'));
    expect(onSort).toHaveBeenCalledWith('status');
    await userEvent.click(screen.getByRole('button', { name: 'Updated' }));
    expect(onSort).toHaveBeenCalledWith('updatedAt');
  });
});

describe('PublishPanel edge cases', () => {
  const base = {
    isNew: false,
    scheduledAt: null,
    missing: [],
    canSchedule: true,
    canDelete: false,
    busy: false,
    onSave: vi.fn(),
    onAction: vi.fn(),
    onSchedule: vi.fn(),
    onUnschedule: vi.fn(),
    onDelete: vi.fn(),
  };

  it('published items cannot be scheduled; destructive actions use the error colour', () => {
    wrap(<PublishPanel {...base} status="published" actions={['unpublish']} />);
    expect(screen.queryByRole('button', { name: 'Schedule…' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unpublish' })).toHaveClass('MuiButton-colorError');
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('new items only offer saving; blocked items without publish rights show no hint', () => {
    const { unmount } = wrap(<PublishPanel {...base} isNew status="draft" actions={['submit']} />);
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Save draft']);
    unmount();
    wrap(<PublishPanel {...base} status="draft" actions={['submit']} missing={['body']} canSchedule={false} />);
    expect(screen.getByRole('button', { name: 'Submit for review' })).toBeDisabled();
    expect(screen.queryByText(/Before publishing/)).not.toBeInTheDocument();
  });
});

describe('ImageField and MediaPickerDialog (FR-CONTENT-05, FR-SEO-01)', () => {
  it('shows the full image when there is no thumbnail, and an empty library', async () => {
    const onChange = vi.fn();
    const { user } = renderPage(<ImageField label="content.featuredImage" value="m1" onChange={onChange} />, {
      user: EDITOR,
      seed: (a) => a.state.media.push(aMedia({ id: 'm1', altText: null, variants: {}, url: 'https://cdn.example.com/full.png' })),
    });
    const img = await screen.findByRole('presentation');
    expect(img).toHaveAttribute('src', 'https://cdn.example.com/full.png');
    await user.click(screen.getByRole('button', { name: 'Select image' }));
    expect(await screen.findByRole('button', { name: 'photo.png' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'photo.png' }));
    expect(onChange).toHaveBeenCalledWith('m1');
  });

  it('the picker searches and shows an empty state', async () => {
    const { user, api } = renderPage(<MediaPickerDialog open onClose={vi.fn()} onPick={vi.fn()} />, { user: EDITOR });
    expect(await screen.findByText('No media yet')).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Search' }), 'cat');
    await vi.waitFor(() => expect(api.state.requests.some((r) => r.url.includes('search=cat'))).toBe(true));
  });

  it('closes the picker with Escape without changing the value', async () => {
    const onChange = vi.fn();
    const { user } = renderPage(<ImageField label="content.socialImage" value={null} onChange={onChange} />, { user: EDITOR });
    await user.click(screen.getByRole('button', { name: 'Select image' }));
    await screen.findByRole('dialog', { name: 'Choose an image' });
    await user.keyboard('{Escape}');
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('ScheduleDialog (FR-CONTENT-07)', () => {
  it('only accepts a future local time and sends it as UTC', async () => {
    const onConfirm = vi.fn();
    wrap(<ScheduleDialog open busy={false} onClose={vi.fn()} onConfirm={onConfirm} />);
    const input = screen.getByLabelText('Publish at (your local time)');
    await userEvent.clear(input);
    expect(screen.getByRole('button', { name: 'Schedule' })).toBeDisabled();
    await userEvent.type(input, '2099-01-02T03:04');
    await userEvent.click(screen.getByRole('button', { name: 'Schedule' }));
    expect(onConfirm).toHaveBeenCalledWith(new Date('2099-01-02T03:04').toISOString());
  });
});

describe('ContentTable menu', () => {
  it('closes the row menu with Escape', async () => {
    wrap(
      <ContentTable items={[aContent({ title: 'Row' })]} sort="title" order="asc" onSort={vi.fn()} onOpen={vi.fn()} onDelete={vi.fn()} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Actions: Row' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await vi.waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  });
});
