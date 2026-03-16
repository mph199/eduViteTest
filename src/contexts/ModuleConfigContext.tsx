/**
 * ModuleConfigContext – Loads module enable/disable state from the API on mount.
 * Used by App.tsx and LandingPage to filter which modules are visible.
 */

import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import api from '../services/api';

interface ModuleConfigContextValue {
  /** Set of enabled module IDs. Null while loading (treat all as enabled). */
  enabledModules: Set<string> | null;
  /** True while the initial load is still in progress */
  loading: boolean;
  /** Check if a specific module is enabled */
  isModuleEnabled: (moduleId: string) => boolean;
  /** Reload config from API */
  reload: () => Promise<void>;
}

const ModuleConfigContext = createContext<ModuleConfigContextValue>({
  enabledModules: null,
  loading: true,
  isModuleEnabled: () => true,
  reload: async () => {},
});

export function useModuleConfig() {
  return useContext(ModuleConfigContext);
}

export function ModuleConfigProvider({ children }: { children: ReactNode }) {
  const [enabledModules, setEnabledModules] = useState<Set<string> | null>(null);
  const [loading, setLoading] = useState(true);
  const hasLoaded = useRef(false);

  const load = useCallback(async () => {
    try {
      const rows = await api.superadmin.getEnabledModules();
      if (Array.isArray(rows) && rows.length > 0) {
        const enabled = new Set(rows.map((r) => r.module_id));
        setEnabledModules(enabled);
      }
      // If empty array (table not populated), keep null → all enabled
      hasLoaded.current = true;
    } catch {
      // On error: if we already loaded successfully before, keep last known state.
      // On first load failure, keep null → all enabled (graceful degradation).
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const isModuleEnabled = useCallback(
    (moduleId: string) => enabledModules === null || enabledModules.has(moduleId),
    [enabledModules]
  );

  return (
    <ModuleConfigContext.Provider value={{ enabledModules, loading, isModuleEnabled, reload: load }}>
      {children}
    </ModuleConfigContext.Provider>
  );
}
