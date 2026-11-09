import { Box, CircularProgress } from '@mui/material';

/** §14.2: shown only after 300 ms (NFR-USE-04) via CSS animation-delay to avoid flicker. */
export function LoadingBlock({ label }: { label: string }) {
  return (
    <Box
      role="progressbar"
      aria-label={label}
      sx={{
        display: 'flex',
        justifyContent: 'center',
        py: 6,
        opacity: 0,
        animation: 'cms-fade-in 150ms ease 300ms forwards',
        '@keyframes cms-fade-in': { to: { opacity: 1 } },
      }}
    >
      <CircularProgress />
    </Box>
  );
}
