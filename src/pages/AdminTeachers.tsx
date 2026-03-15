import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/useAuth';
import { useActiveView } from '../hooks/useActiveView';
import api from '../services/api';
import type { Teacher as ApiTeacher, UserAccount } from '../types';
import './AdminDashboard.css';

type TeacherLoginResponse = {
  user?: {
    username: string;
    tempPassword: string;
  };
};

interface CsvImportedTeacher {
  id: number;
  name: string;
  email: string;
  username: string;
  tempPassword: string;
  slotsCreated: number;
}

interface CsvSkippedRow {
  line: number;
  reason: string;
  name?: string;
}

interface CsvImportResult {
  success?: boolean;
  error?: string;
  hint?: string;
  imported?: number;
  skipped?: number;
  total?: number;
  details?: {
    imported?: CsvImportedTeacher[];
    skipped?: CsvSkippedRow[];
  };
}

export function AdminTeachers() {
  const [teachers, setTeachers] = useState<ApiTeacher[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<ApiTeacher | null>(null);
  const [formData, setFormData] = useState({ first_name: '', last_name: '', email: '', salutation: 'Herr' as 'Herr' | 'Frau' | 'Divers', available_from: '16:00', available_until: '19:00', username: '', password: '' });
  const [createdCreds, setCreatedCreds] = useState<{ username: string; tempPassword: string } | null>(null);
  const [roleSaving, setRoleSaving] = useState<Record<number, boolean>>({});
  const [moduleSaving, setModuleSaving] = useState<Record<number, boolean>>({});
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [flash, setFlash] = useState('');
  const [csvImport, setCsvImport] = useState<{ show: boolean; uploading: boolean; result: CsvImportResult | null }>({ show: false, uploading: false, result: null });
  const csvFileRef = useRef<HTMLInputElement | null>(null);
  const { user } = useAuth();
  useActiveView('admin');

  const loadTeachers = async () => {
    try {
      setLoading(true);
      setError('');
      const [teacherData, userData] = await Promise.all([
        api.admin.getTeachers(),
        api.admin.getUsers().catch(() => [] as UserAccount[]),
      ]);
      setTeachers(teacherData);
      setUsers((userData || []) as UserAccount[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Lehrkräfte');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = useCallback(async () => {
    try {
      const data = await api.admin.getUsers();
      setUsers((data || []) as UserAccount[]);
    } catch {
      // users are supplementary, don't block on failure
    }
  }, []);

  useEffect(() => {
    loadTeachers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.last_name.trim() || !formData.email.trim() || !formData.salutation) {
      alert('Bitte Nachname, Anrede und E-Mail ausfüllen');
      return;
    }

    const normalizedEmail = formData.email.trim().toLowerCase();
    const isValidEmail = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(normalizedEmail);
    if (!isValidEmail) {
      alert('Bitte eine gültige E-Mail-Adresse eingeben.');
      return;
    }

    try {
      const teacherData = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: normalizedEmail,
        salutation: formData.salutation,
        subject: 'Sprechstunde',
        available_from: formData.available_from,
        available_until: formData.available_until,
        room: '',
        username: formData.username || undefined,
        password: formData.password || undefined,
      };
      
      if (editingTeacher) {
        await api.admin.updateTeacher(editingTeacher.id, teacherData);
      } else {
        const res = await api.admin.createTeacher(teacherData);
        const typed = res as TeacherLoginResponse;
        if (typed?.user) {
          setCreatedCreds({ username: typed.user.username, tempPassword: typed.user.tempPassword });
        }
      }
      await loadTeachers();
      setShowForm(false);
      setEditingTeacher(null);
      setFormData({ first_name: '', last_name: '', email: '', salutation: 'Herr', available_from: '16:00', available_until: '19:00', username: '', password: '' });
    } catch (err) {
      console.error('Fehler beim Speichern:', err);
      alert(err instanceof Error ? err.message : 'Fehler beim Speichern');
    }
  };

  const handleEdit = (teacher: ApiTeacher) => {
    setEditingTeacher(teacher);
    setFormData({
      first_name: teacher.first_name || '',
      last_name: teacher.last_name || teacher.name || '',
      email: teacher.email || '',
      salutation: (teacher.salutation || 'Herr') as 'Herr' | 'Frau' | 'Divers',
      available_from: teacher.available_from || '16:00',
      available_until: teacher.available_until || '19:00',
      username: '',
      password: '',
    });
    setShowForm(true);
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Möchten Sie die Lehrkraft "${name}" wirklich löschen?\n\nHinweis: Die Lehrkraft kann nur gelöscht werden, wenn keine Termine mehr existieren.`)) {
      return;
    }

    try {
      await api.admin.deleteTeacher(id);
      await loadTeachers();
      alert(`Lehrkraft "${name}" wurde erfolgreich gelöscht.`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fehler beim Löschen');
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingTeacher(null);
    setFormData({ first_name: '', last_name: '', email: '', salutation: 'Herr', available_from: '16:00', available_until: '19:00', username: '', password: '' });
  };

  const handleCsvImport = async (file: File) => {
    setCsvImport({ show: true, uploading: true, result: null });
    try {
      const result = await api.admin.importTeachersCSV(file);
      setCsvImport({ show: true, uploading: false, result });
      await loadTeachers();
    } catch (err) {
      setCsvImport({ show: true, uploading: false, result: { error: err instanceof Error ? err.message : 'Fehler beim Import' } });
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Map teacher_id → UserAccount for inline display
  const userByTeacherId = useMemo(() => {
    const map = new Map<number, UserAccount>();
    for (const u of users) {
      if (u.teacher_id != null) map.set(u.teacher_id, u);
    }
    return map;
  }, [users]);

  const stats = useMemo(() => {
    const total = users.length;
    const adminCount = users.filter((u) => u.role === 'admin').length;
    const teacherCount = users.filter((u) => u.role === 'teacher').length;
    return { total, adminCount, teacherCount };
  }, [users]);

  const updateRole = async (target: UserAccount, nextRole: string) => {
    const currentRole = target.role;
    if (currentRole === nextRole) return;

    const isSelf = !!user?.username && target.username === user.username;
    if (isSelf && currentRole === 'admin') {
      alert('Du kannst deine eigenen Adminrechte nicht entfernen.');
      return;
    }

    const roleLabels: Record<string, string> = { admin: 'Admin', teacher: 'Lehrkraft', ssw: 'Schulsozialarbeit', superadmin: 'Superadmin' };
    const prompt = `Rolle von „${target.username}" zu „${roleLabels[nextRole] || nextRole}" ändern?`;

    if (!confirm(prompt)) return;

    setRoleSaving((prev) => ({ ...prev, [target.id]: true }));
    setUsers((prev) => prev.map((u) => (u.id === target.id ? { ...u, role: nextRole as UserAccount['role'] } : u)));

    try {
      const updated = await api.admin.updateUserRole(target.id, nextRole);
      if (updated) {
        setUsers((prev) => prev.map((u) => (u.id === target.id ? (updated as UserAccount) : u)));
      } else {
        await loadUsers();
      }
      setFlash('Rollenwechsel gespeichert. Wird nach erneutem Login wirksam.');
      window.setTimeout(() => setFlash(''), 6500);
    } catch (e) {
      setUsers((prev) => prev.map((u) => (u.id === target.id ? { ...u, role: currentRole as UserAccount['role'] } : u)));
      alert(e instanceof Error ? e.message : 'Fehler beim Aktualisieren der Rolle');
    } finally {
      setRoleSaving((prev) => ({ ...prev, [target.id]: false }));
    }
  };

  const toggleModule = async (target: UserAccount, moduleKey: string) => {
    const current = target.modules || [];
    const has = current.includes(moduleKey);
    const next = has ? current.filter(m => m !== moduleKey) : [...current, moduleKey];

    setModuleSaving((prev) => ({ ...prev, [target.id]: true }));
    setUsers((prev) => prev.map((u) => (u.id === target.id ? { ...u, modules: next } : u)));

    try {
      await api.admin.updateUserModules(target.id, next);
      setFlash(has ? 'Modul-Zugang entfernt. Wird nach erneutem Login wirksam.' : 'Modul-Zugang erteilt. Wird nach erneutem Login wirksam.');
      window.setTimeout(() => setFlash(''), 6500);
    } catch (e) {
      setUsers((prev) => prev.map((u) => (u.id === target.id ? { ...u, modules: current } : u)));
      alert(e instanceof Error ? e.message : 'Fehler beim Aktualisieren der Modul-Berechtigungen');
    } finally {
      setModuleSaving((prev) => ({ ...prev, [target.id]: false }));
    }
  };

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="spinner"></div>
        <p>Lade Lehrkräfte...</p>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <main className="admin-main">
        <div className="admin-section-header">
          <h2>Benutzer & Rechte verwalten</h2>
          {!showForm && !csvImport.show && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button 
                onClick={() => setShowForm(true)} 
                className="btn-primary"
              >
                + Neuer Nutzer
              </button>
              <button
                onClick={() => csvFileRef.current?.click()}
                className="btn-secondary"
              >
                CSV Import
              </button>
              <input
                ref={csvFileRef}
                type="file"
                accept=".csv,.txt"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleCsvImport(file);
                  e.target.value = '';
                }}
              />
            </div>
          )}
        </div>

        {/* CSV Import Dialog */}
        {csvImport.show && (
          <div className="teacher-form-container" style={{ marginBottom: '1.5rem' }}>
            <h3>CSV Import</h3>
            {csvImport.uploading && <p>Import wird verarbeitet…</p>}
            {csvImport.result?.error && (
              <div style={{ color: 'var(--color-error, #dc2626)', marginBottom: '1rem' }}>
                <strong>Fehler:</strong> {csvImport.result.error}
                {csvImport.result.hint && <div style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>{csvImport.result.hint}</div>}
              </div>
            )}
            {csvImport.result?.success && (
              <div>
                <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                  <div><strong>{csvImport.result.imported}</strong> importiert</div>
                  <div><strong>{csvImport.result.skipped}</strong> übersprungen</div>
                  <div><strong>{csvImport.result.total}</strong> Zeilen gesamt</div>
                </div>

                {(csvImport.result.details?.imported?.length ?? 0) > 0 && (
                  <details open style={{ marginBottom: '1rem' }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 600, marginBottom: '0.5rem' }}>
                      Importierte Lehrkräfte ({csvImport.result.details!.imported!.length})
                    </summary>
                    <div className="admin-resp-table-container">
                      <table className="admin-resp-table" style={{ fontSize: '0.85rem' }}>
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>E-Mail</th>
                            <th>Username</th>
                            <th>Passwort</th>
                            <th>Slots</th>
                          </tr>
                        </thead>
                        <tbody>
                          {csvImport.result.details!.imported!.map((t: CsvImportedTeacher) => (
                            <tr key={t.id}>
                              <td>{t.name}</td>
                              <td>{t.email}</td>
                              <td><code>{t.username}</code></td>
                              <td><code>{t.tempPassword}</code></td>
                              <td>{t.slotsCreated}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <button
                      className="btn-secondary btn-secondary--sm"
                      style={{ marginTop: '0.5rem' }}
                      onClick={() => {
                        const imported = csvImport.result?.details?.imported ?? [];
                        const lines = ['Name;Email;Username;Passwort'];
                        for (const t of imported) {
                          lines.push(`${t.name};${t.email};${t.username};${t.tempPassword}`);
                        }
                        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'import-zugangsdaten.csv';
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      Zugangsdaten als CSV herunterladen
                    </button>
                  </details>
                )}

                {(csvImport.result.details?.skipped?.length ?? 0) > 0 && (
                  <details style={{ marginBottom: '1rem' }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--color-warning, #b45309)' }}>
                      Übersprungene Zeilen ({csvImport.result.details!.skipped!.length})
                    </summary>
                    <ul style={{ fontSize: '0.85rem', paddingLeft: '1.2rem' }}>
                      {csvImport.result.details!.skipped!.map((s: CsvSkippedRow, i: number) => (
                        <li key={i}>Zeile {s.line}: {s.reason}{s.name ? ` (${s.name})` : ''}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}
            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
              <button className="btn-secondary" onClick={() => setCsvImport({ show: false, uploading: false, result: null })}>
                Schließen
              </button>
              {csvImport.result?.success && (
                <button className="btn-secondary" onClick={() => { setCsvImport({ show: false, uploading: false, result: null }); csvFileRef.current?.click(); }}>
                  Weitere Datei importieren
                </button>
              )}
            </div>
            <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--brand-surface-2, #f0f0f0)', borderRadius: '0.5rem', fontSize: '0.85rem' }}>
              <strong>CSV-Format:</strong> Semikolon- oder kommagetrennt, mit Kopfzeile.<br />
              Pflicht-Spalten: <code>Nachname</code>, <code>Email</code><br />
              Optional: <code>Vorname</code>, <code>Anrede</code>, <code>Raum</code>, <code>Fach</code>
            </div>
          </div>
        )}

        {!showForm && !csvImport.show && (
          <div className="admin-teacher-search">
            <label htmlFor="teacherAdminSearch" className="admin-teacher-search-label">
              Suche
            </label>
            <div className="admin-teacher-search-row">
              <input
                id="teacherAdminSearch"
                className="admin-teacher-search-input"
                type="text"
                placeholder="Name, E-Mail oder Username…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  className="btn-secondary btn-secondary--sm"
                  onClick={() => setSearch('')}
                >
                  Löschen
                </button>
              )}
            </div>
          </div>
        )}

        {!showForm && users.length > 0 && (
          <div className="admin-users-stats" style={{ marginBottom: '1rem' }}>
            <div className="admin-users-stat">
              <div className="admin-users-stat__label">Logins</div>
              <div className="admin-users-stat__value">{stats.total}</div>
            </div>
            <div className="admin-users-stat">
              <div className="admin-users-stat__label">Admins</div>
              <div className="admin-users-stat__value">{stats.adminCount}</div>
            </div>
            <div className="admin-users-stat">
              <div className="admin-users-stat__label">Lehrkräfte</div>
              <div className="admin-users-stat__value">{stats.teacherCount}</div>
            </div>
          </div>
        )}

        {flash && <div className="admin-success">{flash}</div>}

        {error && (
          <div className="admin-error">
            {error}
          </div>
        )}

        {showForm && (
          <div className="teacher-form-container">
            <h3>{editingTeacher ? 'Nutzer bearbeiten' : 'Neuen Nutzer anlegen'}</h3>
            <form onSubmit={handleSubmit} className="teacher-form">
              <div className="form-group">
                <label htmlFor="salutation">Anrede</label>
                <select
                  id="salutation"
                  value={formData.salutation}
                  onChange={(e) => setFormData({ ...formData, salutation: e.target.value as 'Herr' | 'Frau' | 'Divers' })}
                  required
                >
                  <option value="Herr">Herr</option>
                  <option value="Frau">Frau</option>
                  <option value="Divers">Divers</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="last_name">Nachname</label>
                <input
                  id="last_name"
                  type="text"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  placeholder="z.B. Mustermann"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="first_name">Vorname</label>
                <input
                  id="first_name"
                  type="text"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  placeholder="z.B. Max"
                />
              </div>
              <div className="form-group">
                <label htmlFor="email">E-Mail</label>
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="z.B. vorname.nachname@schule.nrw"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="available_from">Sprechzeiten</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    id="available_from"
                    type="time"
                    value={formData.available_from}
                    onChange={(e) => setFormData({ ...formData, available_from: e.target.value })}
                    required
                  />
                  <span>bis</span>
                  <input
                    id="available_until"
                    type="time"
                    value={formData.available_until}
                    onChange={(e) => setFormData({ ...formData, available_until: e.target.value })}
                    required
                  />
                </div>
              </div>
              {!editingTeacher && (
                <>
                  <div className="form-group">
                    <label htmlFor="username">Benutzername (optional)</label>
                    <input
                      id="username"
                      type="text"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      placeholder="z.B. herrhuhn"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="password">Passwort (optional, min. 8 Zeichen)</label>
                    <input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="z.B. sicherespasswort"
                    />
                  </div>
                </>
              )}
              <div className="form-actions">
                <button type="submit" className="btn-primary">
                  {editingTeacher ? 'Speichern' : 'Anlegen'}
                </button>
                <button type="button" onClick={handleCancel} className="btn-secondary">
                  Abbrechen
                </button>
              </div>
            </form>
            {!editingTeacher && createdCreds && (
              <div className="admin-success" style={{ marginTop: '1rem' }}>
                <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Login erstellt</div>
                <div><strong>Benutzername:</strong> {createdCreds.username}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span><strong>Temporäres Passwort:</strong> {createdCreds.tempPassword}</span>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      try {
                        navigator.clipboard.writeText(createdCreds.tempPassword);
                        alert('Passwort kopiert');
                      } catch {
                        // ignore
                      }
                    }}
                    style={{ padding: '0.35rem 0.6rem', fontSize: '0.85rem' }}
                  >
                    Kopieren
                  </button>
                </div>
                <div style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
                  Bitte sicher weitergeben und nach dem ersten Login ändern.
                </div>
              </div>
            )}
          </div>
        )}

        {(() => {
          const filtered = teachers.filter((t) => {
            const q = search.trim().toLowerCase();
            if (!q) return true;
            const name = (t.name || '').toLowerCase();
            const email = (t.email || '').toLowerCase();
            const acct = userByTeacherId.get(t.id);
            const username = acct ? (acct.username || '').toLowerCase() : '';
            return name.includes(q) || email.includes(q) || username.includes(q);
          });

          if (filtered.length === 0) {
            return (
              <div className="no-teachers">
                <p>Keine Lehrkräfte vorhanden.</p>
              </div>
            );
          }

          return (
            <>
              {/* Desktop: Table */}
              <div className="teachers-table-desktop">
                <div className="admin-resp-table-container">
                  <table className="admin-resp-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>E-Mail</th>
                        <th>Sprechzeiten</th>
                        <th>Username</th>
                        <th>Rolle</th>
                        <th className="admin-actions-header">Aktionen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((teacher) => {
                        const acct = userByTeacherId.get(teacher.id);
                        const isSelf = !!user?.username && acct?.username === user.username;
                        return (
                          <tr key={teacher.id}>
                            <td>
                              <div className="admin-cell-main">{teacher.salutation || ''} {teacher.name}</div>
                              <div className="admin-cell-id">#{teacher.id}</div>
                            </td>
                            <td>{teacher.email ? <a href={`mailto:${teacher.email}`} className="teacher-card__link">{teacher.email}</a> : '–'}</td>
                            <td>
                              <span>{teacher.available_from || '16:00'} – {teacher.available_until || '19:00'}</span>
                            </td>
                            <td>
                              {acct ? (
                                <span className="admin-users-username">
                                  {acct.username}
                                  {isSelf && <span className="admin-users-badge" title="Das bist du">Du</span>}
                                </span>
                              ) : (
                                <span style={{ color: '#9ca3af' }}>–</span>
                              )}
                            </td>
                            <td>
                              {acct ? (
                                <div className="admin-users-action">
                                  <select
                                    className="admin-table-select"
                                    value={acct.role}
                                    disabled={!!roleSaving[acct.id] || (isSelf && acct.role === 'admin')}
                                    onChange={(e) => updateRole(acct, e.target.value)}
                                    aria-label={`Rolle für ${acct.username}`}
                                  >
                                    <option value="teacher">Lehrkraft</option>
                                    <option value="admin">Admin</option>
                                  </select>
                                  {roleSaving[acct.id] && <span className="admin-users-saving">Speichert…</span>}
                                  {acct.role === 'teacher' && (
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.3rem', fontSize: '0.82rem', cursor: 'pointer' }}>
                                      <input
                                        type="checkbox"
                                        checked={(acct.modules || []).includes('beratungslehrer')}
                                        disabled={!!moduleSaving[acct.id]}
                                        onChange={() => toggleModule(acct, 'beratungslehrer')}
                                      />
                                      Beratungslehrer
                                      {moduleSaving[acct.id] && <span className="admin-users-saving">Speichert…</span>}
                                    </label>
                                  )}
                                </div>
                              ) : (
                                <span className="teacher-card__tag teacher-card__tag--nologin" style={{ fontSize: '0.78rem' }}>Kein Login</span>
                              )}
                            </td>
                            <td className="admin-actions-cell">
                              <div className="action-buttons">
                                <button onClick={() => handleEdit(teacher)} className="edit-button">
                                  <span aria-hidden="true">✎</span> Bearbeiten
                                </button>
                                <button onClick={() => handleDelete(teacher.id, teacher.name)} className="cancel-button">
                                  <span aria-hidden="true">✕</span> Löschen
                                </button>
                                <button
                                  onClick={async () => {
                                    try {
                                      const res = await api.admin.resetTeacherLogin(teacher.id);
                                      const typed = res as TeacherLoginResponse;
                                      if (typed?.user) {
                                        alert(`Login zurückgesetzt\n\nBenutzername: ${typed.user.username}\nTemporäres Passwort: ${typed.user.tempPassword}`);
                                      } else {
                                        alert('Login zurückgesetzt.');
                                      }
                                    } catch (err) {
                                      alert(err instanceof Error ? err.message : 'Fehler beim Zurücksetzen des Logins');
                                    }
                                  }}
                                  className="reset-button"
                                >
                                  <span aria-hidden="true">↺</span> Login zurücksetzen
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile: Expandable cards */}
              <div className="teachers-cards-mobile">
                <div className="teachers-card-list">
                  {filtered.map((teacher) => {
                    const isExpanded = expandedIds.has(teacher.id);
                    const acct = userByTeacherId.get(teacher.id);
                    const isAdmin = acct?.role === 'admin';
                    return (
                      <article key={teacher.id} className={`teacher-card${isExpanded ? ' is-expanded' : ''}`}>
                        <header
                          className="teacher-card__header"
                          onClick={() => toggleExpand(teacher.id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpand(teacher.id); } }}
                          aria-expanded={isExpanded}
                        >
                          <div className="teacher-card__summary">
                            <span className="teacher-card__name">{teacher.salutation || ''} {teacher.name}</span>
                            <div className="teacher-card__tags">
                              {acct && (
                                <span className={`teacher-card__tag ${isAdmin ? 'teacher-card__tag--admin' : 'teacher-card__tag--teacher'}`}>
                                  {isAdmin ? 'Admin' : 'Lehrkraft'}
                                </span>
                              )}
                              {acct && (acct.modules || []).includes('beratungslehrer') && (
                                <span className="teacher-card__tag teacher-card__tag--teacher">BL</span>
                              )}
                              {!acct && <span className="teacher-card__tag teacher-card__tag--nologin">Kein Login</span>}
                            </div>
                          </div>
                          <span className={`teacher-card__chevron${isExpanded ? ' is-open' : ''}`} aria-hidden="true">›</span>
                        </header>
                        <div className="teacher-card__body">
                          <dl className="teacher-card__dl">
                            <div className="teacher-card__row">
                              <dt>E-Mail</dt>
                              <dd>{teacher.email ? <a href={`mailto:${teacher.email}`} className="teacher-card__link">{teacher.email}</a> : '–'}</dd>
                            </div>
                            <div className="teacher-card__row">
                              <dt>Anrede</dt>
                              <dd>{teacher.salutation || '–'}</dd>
                            </div>
                            <div className="teacher-card__row">
                              <dt>Sprechzeiten</dt>
                              <dd>{teacher.available_from || '16:00'} – {teacher.available_until || '19:00'}</dd>
                            </div>
                            <div className="teacher-card__row">
                              <dt>Username</dt>
                              <dd>
                                {acct ? (
                                  <span className="admin-users-username">
                                    {acct.username}
                                    {user?.username === acct.username && <span className="admin-users-badge" title="Das bist du">Du</span>}
                                  </span>
                                ) : (
                                  <span style={{ color: '#9ca3af' }}>Kein Login vorhanden</span>
                                )}
                              </dd>
                            </div>
                            {acct && (
                              <div className="teacher-card__row">
                                <dt>Rolle</dt>
                                <dd>
                                  <div className="admin-users-action">
                                    <select
                                      className="admin-table-select"
                                      value={acct.role}
                                      disabled={!!roleSaving[acct.id] || (!!user?.username && acct.username === user.username && acct.role === 'admin')}
                                      onChange={(e) => updateRole(acct, e.target.value)}
                                      aria-label={`Rolle für ${acct.username}`}
                                      title={user?.username === acct.username && acct.role === 'admin' ? 'Eigene Adminrolle kann nicht entfernt werden.' : 'Rolle ändern'}
                                    >
                                      <option value="teacher">Lehrkraft</option>
                                      <option value="admin">Admin</option>
                                    </select>
                                    {roleSaving[acct.id] && <span className="admin-users-saving">Speichert…</span>}
                                  </div>
                                </dd>
                              </div>
                            )}
                            {acct && acct.role === 'teacher' && (
                              <div className="teacher-card__row">
                                <dt>Module</dt>
                                <dd>
                                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.82rem', cursor: 'pointer' }}>
                                    <input
                                      type="checkbox"
                                      checked={(acct.modules || []).includes('beratungslehrer')}
                                      disabled={!!moduleSaving[acct.id]}
                                      onChange={() => toggleModule(acct, 'beratungslehrer')}
                                    />
                                    Beratungslehrer
                                    {moduleSaving[acct.id] && <span className="admin-users-saving">Speichert…</span>}
                                  </label>
                                </dd>
                              </div>
                            )}
                            <div className="teacher-card__row">
                              <dt>ID</dt>
                              <dd>{teacher.id}</dd>
                            </div>
                          </dl>
                          <div className="teacher-card__actions">
                            <div className="teacher-card__actions-row">
                              <button onClick={() => handleEdit(teacher)} className="edit-button">
                                <span aria-hidden="true">✎</span> Bearbeiten
                              </button>
                              <button onClick={() => handleDelete(teacher.id, teacher.name)} className="cancel-button">
                                <span aria-hidden="true">✕</span> Löschen
                              </button>
                            </div>
                            <button
                              onClick={async () => {
                                try {
                                  const res = await api.admin.resetTeacherLogin(teacher.id);
                                  const typed = res as TeacherLoginResponse;
                                  if (typed?.user) {
                                    alert(`Login zurückgesetzt\n\nBenutzername: ${typed.user.username}\nTemporäres Passwort: ${typed.user.tempPassword}`);
                                  } else {
                                    alert('Login zurückgesetzt.');
                                  }
                                } catch (err) {
                                  alert(err instanceof Error ? err.message : 'Fehler beim Zurücksetzen des Logins');
                                }
                              }}
                              className="reset-button teacher-card__actions-full"
                            >
                              <span aria-hidden="true">↺</span> Login zurücksetzen
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            </>
          );
        })()}
      </main>
    </div>
  );
}
