import { Box, Typography } from '@mui/material';
import type { ReactNode } from 'react';

/** 03-DESIGN §14.1 empty states: icon, headline, one line of guidance, optional action. */
export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <Box role="status" sx={{ textAlign: 'center', py: 8, px: 2, color: 'text.secondary' }}>
      {icon && <Box sx={{ fontSize: 48, mb: 1 }}>{icon}</Box>}
      <Typography variant="h5" component="p" color="text.primary">
        {title}
      </Typography>
      {body && (
        <Typography variant="body2" sx={{ mt: 1 }}>
          {body}
        </Typography>
      )}
      {action && <Box sx={{ mt: 3 }}>{action}</Box>}
    </Box>
  );
}
