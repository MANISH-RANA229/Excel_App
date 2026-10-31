import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PrimeReactProvider } from 'primereact/api';
import '@fontsource-variable/inter'; // bundled, not fetched from a CDN: the app makes no network requests
import 'primereact/resources/themes/fluent-light/theme.css';
import './styles.css';
import App from './App.jsx';
import ErrorBoundary from './shared/ErrorBoundary.jsx';
import { ToastProvider } from './shared/ToastProvider.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PrimeReactProvider>
      <ToastProvider>
        <ErrorBoundary label="app" retryLabel="Reload app" onReset={() => window.location.reload()}>
          <App />
        </ErrorBoundary>
      </ToastProvider>
    </PrimeReactProvider>
  </StrictMode>,
);
