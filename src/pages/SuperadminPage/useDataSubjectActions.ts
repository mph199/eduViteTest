import { useState, useCallback } from 'react';
import api from '../../services/api';
import { downloadBlob } from '../../utils/download';
import type { DataSubjectSearchResult } from '../../types';

/**
 * Hook that encapsulates data-subject search, export, delete, correct & restrict
 * operations (Art. 15-21 DSGVO).
 */
export function useDataSubjectActions() {
  const [email, setEmail] = useState('');
  const [searchResult, setSearchResult] = useState<DataSubjectSearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchMsg, setSearchMsg] = useState('');

  const [actionMsg, setActionMsg] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const [showCorrection, setShowCorrection] = useState(false);
  const [corrections, setCorrections] = useState<Record<string, string>>({});

  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());

  const clearMessages = useCallback(() => {
    setSearchMsg('');
    setActionMsg('');
  }, []);

  // ── Search ──────────────────────────────────────────────
  const handleSearch = useCallback(async () => {
    if (!email.trim() || !email.includes('@')) {
      setSearchMsg('Bitte gueltige E-Mail-Adresse eingeben');
      return;
    }
    clearMessages();
    setSearching(true);
    setSearchResult(null);
    try {
      const result = await api.dataSubject.search(email.trim());
      setSearchResult(result);
      if (result.total_records === 0) setSearchMsg('Keine Daten gefunden');
    } catch (err: unknown) {
      setSearchMsg(`Fehler: ${err instanceof Error ? err.message : 'Unbekannt'}`);
    } finally {
      setSearching(false);
    }
  }, [email, clearMessages]);

  // ── Export ──────────────────────────────────────────────
  const handleExport = useCallback(async (format: 'json' | 'csv') => {
    if (!email.trim()) return;
    setActionLoading(true);
    setActionMsg('');
    try {
      const response = await api.dataSubject.exportData(email.trim(), format);
      const blob = await response.blob();
      downloadBlob(blob, `datenauskunft-${email.trim()}.${format}`);
      setActionMsg(`${format.toUpperCase()}-Export heruntergeladen`);
    } catch (err: unknown) {
      setActionMsg(`Export-Fehler: ${err instanceof Error ? err.message : 'Unbekannt'}`);
    } finally {
      setActionLoading(false);
      setTimeout(() => setActionMsg(''), 4000);
    }
  }, [email]);

  // ── Delete ──────────────────────────────────────────────
  const handleDelete = useCallback(async () => {
    if (!email.trim()) return;
    if (!window.confirm(`Alle personenbezogenen Daten fuer ${email.trim()} unwiderruflich anonymisieren?`)) return;
    setActionLoading(true);
    setActionMsg('');
    try {
      const result = await api.dataSubject.deleteData(email.trim());
      setActionMsg(result.message || 'Daten anonymisiert');
      await handleSearch();
    } catch (err: unknown) {
      setActionMsg(`Loeschfehler: ${err instanceof Error ? err.message : 'Unbekannt'}`);
    } finally {
      setActionLoading(false);
      setTimeout(() => setActionMsg(''), 6000);
    }
  }, [email, handleSearch]);

  // ── Correct ─────────────────────────────────────────────
  const handleCorrect = useCallback(async () => {
    if (!email.trim() || Object.keys(corrections).length === 0) return;
    setActionLoading(true);
    setActionMsg('');
    try {
      const result = await api.dataSubject.correctData(email.trim(), corrections);
      setActionMsg(result.message || 'Daten berichtigt');
      setShowCorrection(false);
      setCorrections({});
      await handleSearch();
    } catch (err: unknown) {
      setActionMsg(`Berichtigungsfehler: ${err instanceof Error ? err.message : 'Unbekannt'}`);
    } finally {
      setActionLoading(false);
      setTimeout(() => setActionMsg(''), 6000);
    }
  }, [email, corrections, handleSearch]);

  // ── Restrict ────────────────────────────────────────────
  const handleRestrict = useCallback(async (restricted: boolean) => {
    if (!email.trim()) return;
    setActionLoading(true);
    setActionMsg('');
    try {
      const result = await api.dataSubject.restrict(email.trim(), restricted);
      setActionMsg(result.message || 'Einschraenkung gesetzt');
    } catch (err: unknown) {
      setActionMsg(`Fehler: ${err instanceof Error ? err.message : 'Unbekannt'}`);
    } finally {
      setActionLoading(false);
      setTimeout(() => setActionMsg(''), 4000);
    }
  }, [email]);

  const toggleTable = useCallback((table: string) => {
    setExpandedTables(prev => {
      const next = new Set(prev);
      if (next.has(table)) next.delete(table);
      else next.add(table);
      return next;
    });
  }, []);

  return {
    email, setEmail,
    searchResult, searching, searchMsg,
    actionMsg, actionLoading,
    showCorrection, setShowCorrection,
    corrections, setCorrections,
    expandedTables, toggleTable,
    handleSearch, handleExport, handleDelete, handleCorrect, handleRestrict,
  };
}

