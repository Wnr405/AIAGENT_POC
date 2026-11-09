import { Box, Card, CardContent, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { t } from '../../../shared/i18n/t';

/** 03-DESIGN §12.1: centred card on surface, product name above. */
export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <Box component="main" sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2, bgcolor: 'background.default' }}>
      <Card sx={{ width: '100%', maxWidth: 420 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="overline" color="primary">
            {t('app.name')}
          </Typography>
          <Typography variant="h3" component="h1" sx={{ mb: 1 }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {subtitle}
            </Typography>
          )}
          {children}
        </CardContent>
      </Card>
    </Box>
  );
}
