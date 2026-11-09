import { ThemeProvider } from '@mui/material';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { aMedia } from '../../../../test/mocks/fake-api';
import { testTheme } from '../../../../test/utils/app';
import { MediaDetailsDrawer } from './MediaDetailsDrawer';
import { MediaGrid } from './MediaGrid';

const wrap = (ui: React.ReactElement) => render(<ThemeProvider theme={testTheme}>{ui}</ThemeProvider>);

describe('media presentational components (03-DESIGN §12.5)', () => {
  it('MediaGrid falls back to the original image without a thumbnail', async () => {
    const onOpen = vi.fn();
    wrap(<MediaGrid items={[aMedia({ id: 'x', altText: null, filename: 'raw.png', variants: {}, url: 'https://cdn.example.com/raw.png' })]} onOpen={onOpen} />);
    const tile = screen.getByRole('button', { name: 'raw.png' });
    expect(within(tile).getByRole('presentation')).toHaveAttribute('src', 'https://cdn.example.com/raw.png');
    await userEvent.click(tile);
    expect(onOpen).toHaveBeenCalled();
  });

  it('MediaDetailsDrawer saves empty fields as null and deletes unreferenced files without force', async () => {
    const onSave = vi.fn();
    const onDelete = vi.fn();
    wrap(
      <MediaDetailsDrawer
        item={aMedia({ altText: null, caption: null, variants: {}, width: null })}
        canDelete
        canForce={false}
        busy={false}
        onClose={vi.fn()}
        onSave={onSave}
        onDelete={onDelete}
      />,
    );
    expect(screen.queryByText(/Dimensions/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith({ altText: null, caption: null });
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Delete this file?' })).getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledWith(false);
  });
});
