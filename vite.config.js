import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// PrimeReact's Fluent theme is Microsoft's Office design language; swap its Office-blue accent for Excel green
// and its orange "secondary" severity for Office neutral grey.
const EXCEL_GREEN = {
  '#0078d4': '#217346',
  '#106ebe': '#1e6b41',
  '#005a9e': '#185c37',
  '#deecf9': '#e2efe7',
  'rgba(0, 120, 212,': 'rgba(33, 115, 70,',
  '#d45c00': '#605e5c',
  '#bf5300': '#484644',
  '#aa4a00': '#323130',
  'rgba(212, 92, 0,': 'rgba(96, 94, 92,',
};

const excelTheme = () => ({
  name: 'excel-theme',
  enforce: 'pre',
  transform(code, id) {
    if (!id.includes('fluent-light/theme.css')) return;
    for (const [from, to] of Object.entries(EXCEL_GREEN)) code = code.replaceAll(from, to);
    return code;
  },
});

export default defineConfig({
  plugins: [excelTheme(), react()],
  worker: { format: 'es' },
  // Workers import these dynamically, so the dev server can't discover them up front.
  optimizeDeps: { include: ['exceljs', 'jszip', 'xlsx'] },
});
