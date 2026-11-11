import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// PrimeReact's Fluent theme (compact, Office-like) ships light colours as literal hex values. The app is dark, so every colour
// of that theme is re-pointed at the app's CSS variables (src/theme/theme.css). A Fluent colour plays different parts: #ffffff is
// a card background but also the text on a primary button, so the replacement depends on the property it appears in:
//   fg = text/icon colour, bg = background, line = border/outline/box-shadow. A missing role keeps the original value.
const FLUENT = {
  '#323130': { fg: 'var(--text)', bg: 'var(--surface-3)', line: 'var(--border-strong)' }, // body text
  '#605e5c': { fg: 'var(--text-muted)', bg: 'var(--surface-3)', line: 'var(--border-strong)' }, // secondary text, input borders
  '#8a8886': { fg: 'var(--text-dim)', line: 'var(--border-strong)' },
  '#797775': { fg: 'var(--text-dim)', line: 'var(--border-strong)' },
  '#a19f9d': { fg: 'var(--text-dim)', bg: 'var(--surface-3)', line: 'var(--border-strong)' },
  '#bebbb8': { fg: 'var(--text-dim)', bg: 'var(--surface-3)', line: 'var(--border-strong)' },
  '#484644': { fg: 'var(--text-2)', bg: 'var(--surface-3)', line: 'var(--border-strong)' },
  '#c8c6c4': { fg: 'var(--text-dim)', bg: 'var(--surface-3)', line: 'var(--border-strong)' },
  '#e1dfdd': { fg: 'var(--text-2)', bg: 'var(--surface-active)', line: 'var(--border)' },
  '#edebe9': { fg: 'var(--text-2)', bg: 'var(--surface-active)', line: 'var(--border)' },
  '#eeeeee': { fg: 'var(--text-2)', bg: 'var(--surface-active)', line: 'var(--border)' },
  '#f2f2f2': { fg: 'var(--text-2)', bg: 'var(--surface-hover)', line: 'var(--border)' },
  '#f3f2f1': { fg: 'var(--text-2)', bg: 'var(--surface-hover)', line: 'var(--border)' },
  '#f8f9fa': { fg: 'var(--text)', bg: 'var(--bg-sunken)', line: 'var(--border)' },
  '#faf9f8': { fg: 'var(--text)', bg: 'var(--bg-sunken)', line: 'var(--border)' },
  '#ffffff': { bg: 'var(--surface)', line: 'var(--surface)' }, // text stays white (it sits on green / red fills)
  // Office blue -> Excel green
  '#0078d4': { fg: 'var(--accent)', bg: 'var(--xl-green)', line: 'var(--xl-green)' },
  '#106ebe': { fg: 'var(--accent-hover)', bg: 'var(--xl-green-hover)', line: 'var(--xl-green-hover)' },
  '#005a9e': { fg: 'var(--accent-hover)', bg: 'var(--xl-green-active)', line: 'var(--xl-green-active)' },
  '#deecf9': { fg: 'var(--xl-green-dark)', bg: 'var(--xl-green-tint)', line: 'var(--xl-green-soft)' },
  // orange "secondary" severity -> neutral
  '#d45c00': { fg: 'var(--text-2)', bg: 'var(--surface-3)', line: 'var(--border-strong)' },
  '#bf5300': { fg: 'var(--text)', bg: 'var(--surface-active)', line: 'var(--border-strong)' },
  '#aa4a00': { fg: 'var(--text)', bg: 'var(--surface-active)', line: 'var(--border-strong)' },
  // pale message backgrounds -> dark tints
  '#fde7e9': { bg: 'var(--danger-bg)', line: 'var(--danger-border)' },
  '#dff6dd': { bg: 'var(--success-bg)', line: 'var(--xl-green-soft)' },
  '#fff4ce': { bg: 'var(--warning-bg)', line: 'var(--warning-border)' },
};
const RGBA = { 'rgba(0, 120, 212,': 'rgba(60, 207, 135,', 'rgba(212, 92, 0,': 'rgba(141, 153, 147,' };

const roleOf = (prop) => {
  if (prop === 'color' || prop === 'fill' || prop === 'stroke' || prop.startsWith('--text') || prop === '--highlight-text-color') return 'fg';
  if (prop.startsWith('background') || prop.startsWith('--surface') || prop.startsWith('--gray') || prop === '--highlight-bg') return 'bg';
  return 'line';
};

const excelTheme = () => ({
  name: 'excel-theme',
  enforce: 'pre',
  transform(code, id) {
    if (!id.includes('fluent-light/theme.css')) return;
    for (const [from, to] of Object.entries(RGBA)) code = code.replaceAll(from, to);
    return code.replace(/([a-z-]+)(\s*:\s*)([^;{}]*#[0-9a-fA-F]{3,6}\b[^;{}]*)/g, (all, prop, sep, value) =>
      prop + sep + value.replace(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g, (hex) => FLUENT[hex.toLowerCase()]?.[roleOf(prop)] ?? hex));
  },
});

export default defineConfig({
  plugins: [excelTheme(), react()],
  worker: { format: 'es' },
  // Workers import these dynamically, so the dev server can't discover them up front.
  optimizeDeps: { include: ['exceljs', 'jszip', 'xlsx'] },
});
