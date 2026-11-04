import { useCallback, useSyncExternalStore } from 'react';

// Route = the id after "#/" (e.g. "#/diffcheck"). Hash URLs need no server rewrite rules, so the build works on any static host.
const read = () => window.location.hash.replace(/^#\/?/, '') || 'landing';
const subscribe = (onChange) => {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
};

/** [routeId, navigate(id, { replace })] — back/forward buttons and typed URLs work because the hash is the source of truth. */
export default function useHashRoute() {
  const route = useSyncExternalStore(subscribe, read);
  const navigate = useCallback((id, { replace = false } = {}) => {
    if (replace) window.location.replace(`#/${id}`);
    else window.location.hash = `/${id}`;
  }, []);
  return [route, navigate];
}
