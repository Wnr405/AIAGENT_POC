import { Card, CardContent, Typography, Box } from '@mui/material';
import type { ReactNode } from 'react';

/** 03-DESIGN §12.2 stat card: display-small number in primary, body-medium label. */
export function StatCard({ label, value, icon }: { label: string; value: number | string; icon?: ReactNode }) {
  return (
    <Card>
      <CardContent sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h1" component="p" color="primary">
            {value}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
        </Box>
        {icon && (
          <Box aria-hidden sx={{ color: 'primary.main', fontSize: 28 }}>
            {icon}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
