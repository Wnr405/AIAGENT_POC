/**
 * 03-DESIGN §4–§9: Material Design 3 tokens. Components reference these names,
 * never raw values. Light palette from seed #6750A4; dark palette is its MD3 tonal
 * counterpart. `success` extends MD3 (seed #2E7D32) for the Published status.
 */
export const colorLight = {
  primary: '#6750A4',
  onPrimary: '#FFFFFF',
  primaryContainer: '#EADDFF',
  onPrimaryContainer: '#21005D',
  secondary: '#625B71',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#E8DEF8',
  onSecondaryContainer: '#1D192B',
  tertiary: '#7D5260',
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#FFD8E4',
  onTertiaryContainer: '#31111D',
  error: '#B3261E',
  onError: '#FFFFFF',
  errorContainer: '#F9DEDC',
  onErrorContainer: '#410E0B',
  success: '#2E7D32',
  successContainer: '#C8E6C9',
  onSuccessContainer: '#1B5E20',
  surface: '#FEF7FF',
  onSurface: '#1D1B20',
  onSurfaceVariant: '#49454F',
  surfaceContainerLowest: '#FFFFFF',
  surfaceContainerLow: '#F7F2FA',
  surfaceContainer: '#F3EDF7',
  surfaceContainerHigh: '#ECE6F0',
  surfaceContainerHighest: '#E6E0E9',
  outline: '#79747E',
  outlineVariant: '#CAC4D0',
  inverseSurface: '#322F35',
  inverseOnSurface: '#F5EFF7',
} as const;

export type ColorRoles = { readonly [K in keyof typeof colorLight]: string };

export const colorDark: ColorRoles = {
  primary: '#D0BCFF',
  onPrimary: '#381E72',
  primaryContainer: '#4F378B',
  onPrimaryContainer: '#EADDFF',
  secondary: '#CCC2DC',
  onSecondary: '#332D41',
  secondaryContainer: '#4A4458',
  onSecondaryContainer: '#E8DEF8',
  tertiary: '#EFB8C8',
  onTertiary: '#492532',
  tertiaryContainer: '#633B48',
  onTertiaryContainer: '#FFD8E4',
  error: '#F2B8B5',
  onError: '#601410',
  errorContainer: '#8C1D18',
  onErrorContainer: '#F9DEDC',
  success: '#A5D6A7',
  successContainer: '#1B5E20',
  onSuccessContainer: '#C8E6C9',
  surface: '#141218',
  onSurface: '#E6E0E9',
  onSurfaceVariant: '#CAC4D0',
  surfaceContainerLowest: '#0F0D13',
  surfaceContainerLow: '#1D1B20',
  surfaceContainer: '#211F26',
  surfaceContainerHigh: '#2B2930',
  surfaceContainerHighest: '#36343B',
  outline: '#938F99',
  outlineVariant: '#49454F',
  inverseSurface: '#E6E0E9',
  inverseOnSurface: '#322F35',
};

/** §4.2 — 8 dp base grid (MUI spacing(1) = 8px). */
export const spacingUnit = 8;

/** §7.2 shape scale (dp). */
export const shape = { none: 0, extraSmall: 4, small: 8, medium: 12, large: 16, extraLarge: 28, full: 9999 } as const;

/** §5.1 MD3 type scale: [size, lineHeight, weight, tracking]. */
export const typescale = {
  displaySmall: [36, 44, 400, 0],
  headlineLarge: [32, 40, 400, 0],
  headlineMedium: [28, 36, 400, 0],
  headlineSmall: [24, 32, 400, 0],
  titleLarge: [22, 28, 400, 0],
  titleMedium: [16, 24, 500, 0.15],
  titleSmall: [14, 20, 500, 0.1],
  bodyLarge: [16, 24, 400, 0.5],
  bodyMedium: [14, 20, 400, 0.25],
  bodySmall: [12, 16, 400, 0.4],
  labelLarge: [14, 20, 500, 0.1],
  labelMedium: [12, 16, 500, 0.5],
  labelSmall: [11, 16, 500, 0.5],
} as const satisfies Record<string, readonly [number, number, number, number]>;

/** §9.1/9.2 motion tokens. */
export const motion = {
  duration: { short2: 100, short4: 200, medium2: 300, medium4: 400, long2: 500 },
  easing: {
    standard: 'cubic-bezier(0.2, 0, 0, 1)',
    emphasizedDecelerate: 'cubic-bezier(0.05, 0.7, 0.1, 1)',
    emphasizedAccelerate: 'cubic-bezier(0.3, 0, 0.8, 0.15)',
  },
} as const;

/** §6.3 state layers. */
export const stateLayer = { hover: 0.08, focus: 0.12, pressed: 0.12, dragged: 0.16, disabled: 0.12 } as const;

export const layout = { railWidth: 80, appBarHeight: 64, contentMaxWidth: 1440, contentPadding: 24 } as const;
