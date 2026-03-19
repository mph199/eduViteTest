import { useState, useCallback } from 'react';
import api from '../../services/api';
import { downloadBlob } from '../../utils/download';
import type { AuditLogEntry, AuditLogResponse } from '../../types';

/**
 * Hook that encapsulates audit-log loading, filtering, pagination and CSV export.
 */
export function useAuditLog() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState({ action: '', table: '' });
  const [exportError, setExportError] = useState('');

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const result: AuditLogResponse = await api.dataSubject.getAuditLog({
        page,
        limit: 20,
        action: filter.action || undefined,
        table: filter.table || undefined,
      });
      setEntries(Array.isArray(result.entries) ? result.entries : []);
      setPagination(result.pagination || { page: 1, pages: 1, total: 0 });
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const exportCsv = useCallback(async () => {
    try {
      const response = await api.dataSubject.exportAuditLog();
      const blob = await response.blob();
      downloadBlob(blob, `audit-log-${Date.now()}.csv`);
    } catch {
      setExportError('Audit-Log-Export fehlgeschlagen');
      setTimeout(() => setExportError(''), 4000);
    }
  }, []);

  return {
    entries, pagination, loading, filter, setFilter, exportError,
    load, exportCsv,
  };
}

