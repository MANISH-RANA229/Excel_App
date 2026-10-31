import { createContext, useContext } from 'react';

/**
 * Provided by App around the shell: what any page needs to put a file into the workspace.
 *   names       [string | null, string | null]  file names in the Excel 1 / Excel 2 slots
 *   loadFile    (file: File, slot: 0 | 1) => void   opens it like a dropped file (App shows the loader, then the Files page)
 * Without a provider (checks, isolated renders) `useWorkspace()` returns null and callers hide the feature.
 */
export const WorkspaceContext = createContext(null);
export const useWorkspace = () => useContext(WorkspaceContext);
