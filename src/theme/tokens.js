/**
 * AxelSuite Design Tokens
 * Single source of truth for design tokens across the application.
 * Defines colors, typography, spacing, shadows, radii, and transitions.
 */

export const colors = {
  // Brand - Professional Excel Forest Green
  brand: {
    primary: '#107C41',
    hover: '#0D6A37',
    active: '#0A552C',
    dark: '#185C37',
    soft: '#D1E7DD',
    tint: '#EFF7F2',
    subtle: '#F6FAF7',
    surface: '#E7F3EC',
  },

  // Slate Neutral Scale (Crisp, High-Contrast UI)
  neutral: {
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
    950: '#020617',
  },

  // Semantic Feedback Colors
  success: {
    base: '#107C41',
    bg: '#C6EFCE',
    text: '#006100',
    border: '#A3D9AE',
  },
  warning: {
    base: '#D97706',
    bg: '#FEF3C7',
    text: '#92400E',
    border: '#FDE68A',
  },
  fuzzy: {
    bg: '#FFEB9C',
    text: '#7F6000',
    border: '#F6DF7D',
  },
  danger: {
    base: '#B3261E',
    hover: '#941F18',
    bg: '#FDF3F4',
    text: '#9C0006',
    border: '#F8B4B7',
  },
  info: {
    base: '#0284C7',
    bg: '#E0F2FE',
    text: '#0369A1',
    border: '#BAE6FD',
  },

  // Surface & Layout
  surface: {
    base: '#FFFFFF',
    sunken: '#F1F5F9',
    canvas: '#F6F8FB',
    elevated: '#FFFFFF',
    border: '#E2E8F0',
    borderSoft: '#EEF2F6',
    borderStrong: '#CBD5E1',
  },
};

export const typography = {
  fonts: {
    sans: "'Inter Variable', Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    mono: "ui-monospace, 'Cascadia Mono', 'SFMono-Regular', Consolas, monospace",
  },
  fontFeatures: "'cv02' 1, 'cv03' 1, 'cv04' 1, 'cv11' 1, 'tnum' 1",
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
  xs: '0 1px 2px 0 rgb(15 23 42 / 0.05)',
  sm: '0 1px 3px 0 rgb(15 23 42 / 0.07), 0 1px 2px -1px rgb(15 23 42 / 0.06)',
  md: '0 4px 6px -1px rgb(15 23 42 / 0.08), 0 2px 4px -2px rgb(15 23 42 / 0.06)',
  lg: '0 10px 15px -3px rgb(15 23 42 / 0.08), 0 4px 6px -4px rgb(15 23 42 / 0.04)',
  focus: '0 0 0 3px rgba(16, 124, 65, 0.15)',
  focusDanger: '0 0 0 3px rgba(179, 38, 30, 0.15)',
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

