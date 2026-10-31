import { createContext, useContext, useEffect } from 'react';

/** Provided by App around each mounted tool: { id, set }, where set is App's setPhases (tool id → { phase, back }). */
export const ToolPhaseContext = createContext(null);

/**
 * A tool reports its phase so the header breadcrumb can follow it (Workspace › Diff Check › Diff result).
 * phase = 'config' | 'results'; back = returns to the settings. The entry is removed on unmount, so a tool that
 * remounts (files re-loaded) never leaves a stale "result" crumb. Without a provider this does nothing.
 */
export function useToolPhase(phase, back) {
  const ctx = useContext(ToolPhaseContext);
  const id = ctx?.id;
  const set = ctx?.set;
  useEffect(() => {
    if (!set) return undefined;
    set((p) => ({ ...p, [id]: { phase, back } }));
    return () => set(({ [id]: _gone, ...rest }) => rest);
  }, [id, set, phase, back]);
}
