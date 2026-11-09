import { alpha, createTheme, type Theme } from '@mui/material/styles';
import { colorDark, colorLight, layout, motion, shape, stateLayer, typescale, type ColorRoles } from '../tokens/tokens';

declare module '@mui/material/styles' {
  interface Theme {
    md: { color: ColorRoles; shape: typeof shape; layout: typeof layout };
  }
  interface ThemeOptions {
    md?: { color: ColorRoles; shape: typeof shape; layout: typeof layout };
  }
}

const ts = (key: keyof typeof typescale) => {
  const [size, line, weight, tracking] = typescale[key];
  return { fontSize: `${size / 16}rem`, lineHeight: `${line}px`, fontWeight: weight, letterSpacing: `${tracking / 16}rem` };
};

/** 03-DESIGN §3.2: MUI v6 configured with MD3 tokens (light + dark). */
export function buildTheme(mode: 'light' | 'dark'): Theme {
  const c = mode === 'light' ? colorLight : colorDark;
  return createTheme({
    md: { color: c, shape, layout },
    palette: {
      mode,
      primary: { main: c.primary, contrastText: c.onPrimary },
      secondary: { main: c.secondary, contrastText: c.onSecondary },
      error: { main: c.error, contrastText: c.onError },
      success: { main: c.success },
      background: { default: c.surface, paper: c.surfaceContainerLow },
      text: { primary: c.onSurface, secondary: c.onSurfaceVariant },
      divider: c.outlineVariant,
      action: { hoverOpacity: stateLayer.hover, focusOpacity: stateLayer.focus, disabledOpacity: 0.38 },
    },
    shape: { borderRadius: shape.small },
    spacing: 8,
    typography: {
      fontFamily: '"Roboto Flex", Roboto, system-ui, -apple-system, "Segoe UI", sans-serif',
      h1: ts('displaySmall'),
      h2: ts('headlineLarge'),
      h3: ts('headlineMedium'),
      h4: ts('headlineSmall'),
      h5: ts('titleLarge'),
      h6: ts('titleMedium'),
      subtitle1: ts('titleMedium'),
      subtitle2: ts('titleSmall'),
      body1: ts('bodyLarge'),
      body2: ts('bodyMedium'),
      caption: ts('bodySmall'),
      button: { ...ts('labelLarge'), textTransform: 'none' },
      overline: ts('labelSmall'),
    },
    transitions: {
      easing: {
        easeInOut: motion.easing.standard,
        easeOut: motion.easing.emphasizedDecelerate,
        easeIn: motion.easing.emphasizedAccelerate,
        sharp: motion.easing.standard,
      },
      duration: {
        shortest: motion.duration.short2,
        shorter: motion.duration.short4,
        short: motion.duration.medium2,
        standard: motion.duration.medium2,
        complex: motion.duration.medium4,
        enteringScreen: motion.duration.medium4,
        leavingScreen: motion.duration.short4,
      },
    },
    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: { root: { borderRadius: shape.full, paddingInline: 24, minHeight: 40 } },
      },
      MuiFab: { styleOverrides: { root: { borderRadius: shape.large, textTransform: 'none' } } },
      MuiCard: {
        defaultProps: { variant: 'outlined' },
        styleOverrides: { root: { borderRadius: shape.medium, backgroundColor: c.surfaceContainerLow } },
      },
      MuiChip: { styleOverrides: { root: { borderRadius: shape.small } } },
      MuiDialog: { styleOverrides: { paper: { borderRadius: shape.extraLarge, backgroundColor: c.surfaceContainerHigh } } },
      MuiMenu: { styleOverrides: { paper: { borderRadius: shape.extraSmall, backgroundColor: c.surfaceContainer } } },
      MuiTextField: { defaultProps: { variant: 'outlined', fullWidth: true } },
      MuiOutlinedInput: { styleOverrides: { root: { borderRadius: shape.extraSmall } } },
      MuiSnackbarContent: {
        styleOverrides: { root: { backgroundColor: c.inverseSurface, color: c.inverseOnSurface, borderRadius: shape.extraSmall } },
      },
      MuiTableRow: { styleOverrides: { root: { '&.MuiTableRow-hover:hover': { backgroundColor: alpha(c.onSurface, stateLayer.hover) } } } },
      MuiAppBar: { defaultProps: { elevation: 0, color: 'inherit' }, styleOverrides: { root: { backgroundColor: c.surface } } },
      MuiCssBaseline: {
        styleOverrides: {
          body: { backgroundColor: c.surface },
          '@media (prefers-reduced-motion: reduce)': {
            '*': { animationDuration: '0.01ms !important', transitionDuration: '0.01ms !important' },
          },
        },
      },
    },
  });
}
