/**
 * Excel Suite design tokens (dark theme). theme/theme.css mirrors these as CSS variables.
 * Single source of truth for design tokens across the application.
 * Defines colors, typography, spacing, shadows, radii, and transitions.
 */

export const colors = {
  // Brand: Excel green. primary is a fill (white text passes AA); accent is the green used for text and icons on dark.
  brand: {
    primary: '#15804a',
    hover: '#1a9256',
    active: '#12703f',
    accent: '#3ccf87',
    onTint: '#74e2aa',
    soft: 'rgb(60 207 135 / 0.28)',
    tint: 'rgb(33 163 102 / 0.13)',
    subtle: 'rgb(33 163 102 / 0.06)',
  },

  // Text on the dark surfaces
  text: {
    primary: '#eef2f0',
    secondary: '#c3ccc7',
    muted: '#8d9993',
    dim: '#74817b',
  },

  // Semantic feedback (text colour + translucent background + border)
  success: { base: '#3ccf87', bg: 'rgb(60 207 135 / 0.1)', text: '#8bebb9', border: 'rgb(60 207 135 / 0.28)' },
  warning: { base: '#e8b04e', bg: 'rgb(232 176 78 / 0.12)', text: '#f1c873', border: 'rgb(232 176 78 / 0.32)' },
  fuzzy: { bg: 'rgb(232 176 78 / 0.22)', text: '#f4cf82' },
  danger: { base: '#f0716a', fill: '#c43a30', hover: '#d5463b', bg: 'rgb(240 113 106 / 0.1)', border: 'rgb(240 113 106 / 0.32)' },
  info: { bg: 'rgb(96 186 240 / 0.12)', text: '#8fd0f7', border: 'rgb(96 186 240 / 0.3)' },

  // Surfaces, darkest to lightest (the page matches the landing page)
  surface: {
    canvas: '#0a0e0c',
    sunken: '#0e1311',
    base: '#121815',
    elevated: '#171e1b',
    hover: '#1b231f',
    active: '#222c27',
    border: '#26302b',
    borderSoft: '#1d2622',
    borderStrong: '#36433d',
  },
};

export const typography = {
  fonts: {
    sans: "'Geist Variable', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    mono: "'Geist Mono Variable', ui-monospace, 'Cascadia Mono', Consolas, monospace",
  },
  fontFeatures: "'tnum' 1",
  sizes: {
    xs: '0.79rem',   // ~11px
    sm: '0.86rem',   // ~12px
    base: '0.93rem', // ~13px
    md: '1rem',      // 14px (base root size)
    lg: '1.07rem',   // ~15px
    xl: '1.14rem',   // ~16px
    '2xl': '1.28rem',// ~18px
    '3xl': '1.5rem',  // ~21px
    '4xl': '1.71rem',// ~24px
  },
  weights: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  tracking: {
    tighter: '-0.025em',
    tight: '-0.015em',
    snug: '-0.005em',
    normal: '0',
    wide: '0.04em',
    wider: '0.06em',
    widest: '0.08em',
  },
};

export const radii = {
  none: '0px',
  xs: '3px',
  sm: '5px',
  default: '7px', // User constraint: Max 7px for containers/cards/buttons
  lg: '7px',
  pill: '9999px', // Allowed for dots, status pills, switch handles
};

export const shadows = {
  none: 'none',
  md: '0 6px 16px rgb(0 0 0 / 0.35)',
  lg: '0 18px 40px rgb(0 0 0 / 0.5)',
  focus: '0 0 0 3px rgb(60 207 135 / 0.22)',
  focusDanger: '0 0 0 3px rgb(240 113 106 / 0.22)',
};

export const transitions = {
  fast: '100ms ease',
  default: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  smooth: '200ms cubic-bezier(0.16, 1, 0.3, 1)',
};

const theme = {
  colors,
  typography,
  radii,
  shadows,
  transitions,
};

export default theme;

