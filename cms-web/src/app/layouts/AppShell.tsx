import { AppBar, Avatar, Box, IconButton, Menu, MenuItem, Toolbar, Tooltip, Typography } from '@mui/material';
import DashboardIcon from '@mui/icons-material/SpaceDashboardRounded';
import ArticleIcon from '@mui/icons-material/ArticleRounded';
import PagesIcon from '@mui/icons-material/DescriptionRounded';
import ImageIcon from '@mui/icons-material/PhotoLibraryRounded';
import PeopleIcon from '@mui/icons-material/GroupRounded';
import HistoryIcon from '@mui/icons-material/ManageSearchRounded';
import KeyIcon from '@mui/icons-material/KeyRounded';
import SettingsIcon from '@mui/icons-material/SettingsRounded';
import { alpha } from '@mui/material/styles';
import { useState, type ReactElement } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useLogout } from '../../features/auth/hooks/auth.hooks';
import { t, type MessageKey } from '../../shared/i18n/t';
import { isAdmin, selectUser, useSessionStore } from '../../shared/stores/session.store';
import { PrivacyNotice } from './PrivacyNotice';

interface NavItem {
  to: string;
  label: MessageKey;
  icon: ReactElement;
  adminOnly?: boolean;
}

const NAV: NavItem[] = [
  { to: '/', label: 'nav.dashboard', icon: <DashboardIcon /> },
  { to: '/content/articles', label: 'nav.articles', icon: <ArticleIcon /> },
  { to: '/content/pages', label: 'nav.pages', icon: <PagesIcon /> },
  { to: '/media', label: 'nav.media', icon: <ImageIcon /> },
  { to: '/users', label: 'nav.users', icon: <PeopleIcon />, adminOnly: true },
  { to: '/audit', label: 'nav.audit', icon: <HistoryIcon />, adminOnly: true },
  { to: '/api-keys', label: 'nav.apiKeys', icon: <KeyIcon />, adminOnly: true },
  { to: '/settings', label: 'nav.settings', icon: <SettingsIcon /> },
];

/** 03-DESIGN §11.1: 64 dp top app bar + 80 dp navigation rail, content max 1440 dp. */
export function AppShell() {
  const user = useSessionStore(selectUser);
  const admin = isAdmin(user?.role ?? null);
  const logout = useLogout();
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <a href="#main" className="skip-link">
        {t('app.skipToContent')}
      </a>
      <Box
        component="nav"
        aria-label={t('nav.mainNavigation')}
        sx={(th) => ({
          width: th.md.layout.railWidth,
          flexShrink: 0,
          borderRight: 1,
          borderColor: 'divider',
          pt: 10,
          position: 'fixed',
          inset: '0 auto 0 0',
          bgcolor: 'background.default',
          zIndex: 2,
        })}
      >
        {NAV.filter((n) => !n.adminOnly || admin).map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} style={{ textDecoration: 'none', color: 'inherit' }}>
            {({ isActive }) => (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 1, gap: 0.5 }}>
                <Box
                  sx={(th) => ({
                    width: 56,
                    height: 32,
                    borderRadius: 4,
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: isActive ? th.md.color.secondaryContainer : 'transparent',
                    '&:hover': { bgcolor: isActive ? undefined : alpha(th.md.color.onSurface, 0.08) },
                  })}
                  aria-hidden
                >
                  {n.icon}
                </Box>
                <Typography
                  variant="overline"
                  component="span"
                  sx={{ textTransform: 'none', fontWeight: isActive ? 700 : 500, lineHeight: 1.2, textAlign: 'center' }}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {t(n.label)}
                </Typography>
              </Box>
            )}
          </NavLink>
        ))}
      </Box>
      <Box sx={(th) => ({ flex: 1, ml: `${th.md.layout.railWidth}px` })}>
        <AppBar position="sticky" sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Toolbar sx={{ minHeight: 64 }}>
            <Typography variant="h5" component="span" sx={{ flex: 1 }}>
              {t('app.name')}
            </Typography>
            <Tooltip title={t('nav.account')}>
              <IconButton onClick={(e) => setAnchor(e.currentTarget)} aria-label={t('nav.account')}>
                <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>{user?.name.charAt(0).toUpperCase()}</Avatar>
              </IconButton>
            </Tooltip>
            <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
              <MenuItem disabled>{user?.email}</MenuItem>
              <MenuItem
                onClick={() => {
                  setAnchor(null);
                  navigate('/settings');
                }}
              >
                {t('nav.settings')}
              </MenuItem>
              <MenuItem onClick={() => void logout()}>{t('nav.logout')}</MenuItem>
            </Menu>
          </Toolbar>
        </AppBar>
        <Box
          component="main"
          id="main"
          tabIndex={-1}
          sx={(th) => ({ maxWidth: th.md.layout.contentMaxWidth, mx: 'auto', p: `${th.md.layout.contentPadding}px` })}
        >
          <Outlet />
        </Box>
      </Box>
      <PrivacyNotice />
    </Box>
  );
}
