import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// PrimeReact's Fluent theme is Microsoft's Office design language; swap its Office-blue accent for the app's green, its orange
// "secondary" severity for slate, and its warm greys for the slate neutrals of the design system (see :root in styles.css).
const THEME_COLORS = {
  '#0078d4': '#107C41',
  '#106ebe': '#0D6A37',
  '#005a9e': '#185C37',
  '#deecf9': '#D1E7DD',
  'rgba(0, 120, 212,': 'rgba(16, 124, 65,',
  '#d45c00': '#475569',
  '#bf5300': '#334155',
  '#aa4a00': '#1E293B',
  'rgba(212, 92, 0,': 'rgba(71, 85, 105,',
  '#323130': '#0F172A',
  '#605e5c': '#5B6A80',
  '#8a8886': '#94A3B8',
  '#a19f9d': '#94A3B8',
  '#c8c6c4': '#CBD5E1',
  '#e1dfdd': '#E2E8F0',
  '#edebe9': '#EEF2F6',
  '#f3f2f1': '#F1F5F9',
  '#faf9f8': '#F8FAFC',
};

const excelTheme = () => ({
  name: 'excel-theme',
  enforce: 'pre',
  transform(code, id) {
    if (!id.includes('fluent-light/theme.css')) return;
    for (const [from, to] of Object.entries(THEME_COLORS)) code = code.replaceAll(from, to);
    return code;
  },
});

export default defineConfig({
  plugins: [excelTheme(), react()],
  worker: { format: 'es' },
  // Workers import these dynamically, so the dev server can't discover them up front.
  optimizeDeps: { include: ['exceljs', 'jszip', 'xlsx'] },
});
