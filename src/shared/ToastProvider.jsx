import { createContext, useContext, useMemo, useRef } from 'react';
import { Toast } from 'primereact/toast';

const ToastContext = createContext(null);

/** Non-blocking notices: const toast = useToast(); toast.success('Saved', 'details'). */
export function ToastProvider({ children }) {
  const ref = useRef(null);
  const api = useMemo(() => {
    const show = (severity) => (summary, detail) =>
      ref.current?.show({ severity, summary, detail, life: severity === 'error' ? 8000 : 4000 });
    return { success: show('success'), info: show('info'), warn: show('warn'), error: show('error') };
  }, []);
  return (
    <ToastContext.Provider value={api}>
      {children}
      <Toast ref={ref} position="bottom-right" />
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
