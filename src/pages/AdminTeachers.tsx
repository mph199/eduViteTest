import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../contexts/useAuth';
import api from '../services/api';
import type { Teacher as ApiTeacher, UserAccount } from '../types';
import './AdminDashboard.css';

type TeacherLoginResponse = {
  user?: {
    username: string;
    tempPassword: string;
  };
};

export function AdminTeachers() {
  const [teachers, setTeachers] = useState<ApiTeacher[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<ApiTeacher | null>(null);
  const [formData, setFormData] = useState({ name: '', email: '', salutation: 'Herr' as 'Herr' | 'Frau' | 'Divers', system: 'dual' as 'dual' | 'vollzeit', username: '', password: '' });
  const [createdCreds, setCreatedCreds] = useState<{ username: string; tempPassword: string } | null>(null);
  const [systemSaving, setSystemSaving] = useState<Record<number, boolean>>({});
  const [roleSaving, setRoleSaving] = useState<Record<number, boolean>>({});
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [flash, setFlash] = useState('');
  const { user, setActiveView } = useAuth();

  const canSwitchView = Boolean(user?.role === 'admin' && user.teacherId);

  useEffect(() => {
    if (canSwitchView) setActiveView('admin');
  }, [canSwitchView, setActiveView]);

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
    
    if (!formData.name.trim() || !formData.email.trim() || !formData.salutation) {
      alert('Bitte Name, Anrede und E-Mail ausfüllen');
      return;
    }

    const normalizedEmail = formData.email.trim().toLowerCase();
    const isValidEmail = /^[a-z0-9._%+-]+@bksb\.nrw$/i.test(normalizedEmail);
    if (!isValidEmail) {
      alert('Die E-Mail-Adresse muss auf @bksb.nrw enden.');
      return;
    }

    try {
      const teacherData = {
        name: formData.name,
        email: normalizedEmail,
        salutation: formData.salutation,
        subject: 'Sprechstunde',
        system: formData.system,
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
      setFormData({ name: '', email: '', salutation: 'Herr', system: 'dual', username: '', password: '' });
    } catch (err) {
      console.error('Fehler beim Speichern:', err);
      alert(err instanceof Error ? err.message : 'Fehler beim Speichern');
    }
  };

  const handleEdit = (teacher: ApiTeacher) => {
    setEditingTeacher(teacher);
    setFormData({
      name: teacher.name,
      email: teacher.email || '',
      salutation: (teacher.salutation || 'Herr') as 'Herr' | 'Frau' | 'Divers',
      system: teacher.system || 'dual',
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
    setFormData({ name: '', email: '', salutation: 'Herr', system: 'dual', username: '', password: '' });
  };

  const handleInlineSystemChange = async (teacher: ApiTeacher, nextSystem: 'dual' | 'vollzeit') => {
    const currentSystem: 'dual' | 'vollzeit' = teacher.system || 'dual';
    if (currentSystem === nextSystem) return;

    // Backend update requires these fields; if missing, fall back to edit form.
    if (!teacher.email || !teacher.salutation) {
      alert('Bitte erst über "Bearbeiten" E-Mail und Anrede setzen, bevor das System geändert werden kann.');
      return;
    }

    setSystemSaving((prev) => ({ ...prev, [teacher.id]: true }));
    setTeachers((prev) => prev.map((t) => (t.id === teacher.id ? { ...t, system: nextSystem } : t)));

    try {
      await api.admin.updateTeacher(teacher.id, {
        name: teacher.name,
        email: teacher.email,
        salutation: teacher.salutation,
        subject: teacher.subject || 'Sprechstunde',
        system: nextSystem,
        room: '',
      });
    } catch (err) {
      // Revert optimistic update
      setTeachers((prev) => prev.map((t) => (t.id === teacher.id ? { ...t, system: currentSystem } : t)));
      alert(err instanceof Error ? err.message : 'Fehler beim Aktualisieren des Systems');
    } finally {
      setSystemSaving((prev) => ({ ...prev, [teacher.id]: false }));
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

  const updateRole = async (target: UserAccount, nextRole: 'admin' | 'teacher') => {
    const currentRole = target.role;
    if (currentRole === nextRole) return;

    const isSelf = !!user?.username && target.username === user.username;
    if (isSelf && nextRole !== 'admin') {
      alert('Du kannst deine eigenen Adminrechte nicht entfernen.');
      return;
    }

    const prompt = nextRole === 'admin'
      ? `Soll „${target.username}" Adminrechte bekommen?`
      : `Soll „${target.username}" die Adminrechte verlieren?`;

    if (!confirm(prompt)) return;

    setRoleSaving((prev) => ({ ...prev, [target.id]: true }));
    setUsers((prev) => prev.map((u) => (u.id === target.id ? { ...u, role: nextRole } : u)));

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
      setUsers((prev) => prev.map((u) => (u.id === target.id ? { ...u, role: currentRole } : u)));
      alert(e instanceof Error ? e.message : 'Fehler beim Aktualisieren der Rolle');
    } finally {
      setRoleSaving((prev) => ({ ...prev, [target.id]: false }));
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
          {!showForm && (
            <button 
              onClick={() => setShowForm(true)} 
              className="btn-primary"
            >
              + Neue Lehrkraft
            </button>
          )}
        </div>

        {!showForm && (
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
            <h3>{editingTeacher ? 'Lehrkraft bearbeiten' : 'Neue Lehrkraft anlegen'}</h3>
            <form onSubmit={handleSubmit} className="teacher-form">
              <div className="form-group">
                <label htmlFor="name">Name</label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="z.B. Max Mustermann"
                  required
                />
              </div>
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
                <label htmlFor="email">E-Mail (muss auf @bksb.nrw enden)</label>
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="z.B. vorname.nachname@bksb.nrw"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="system">System</label>
                <select
                  id="system"
                  value={formData.system}
                  onChange={(e) => setFormData({ ...formData, system: e.target.value as 'dual' | 'vollzeit' })}
                  required
                >
                  <option value="dual">Duales System (16:00 - 18:00 Uhr)</option>
                  <option value="vollzeit">Vollzeit System (17:00 - 19:00 Uhr)</option>
                </select>
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
                <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Login für Lehrkraft erstellt</div>
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

        {teachers.filter((t) => {
          const q = search.trim().toLowerCase();
          if (!q) return true;
          const name = (t.name || '').toLowerCase();
          const email = (t.email || '').toLowerCase();
          const acct = userByTeacherId.get(t.id);
          const username = acct ? (acct.username || '').toLowerCase() : '';
          return name.includes(q) || email.includes(q) || username.includes(q);
        }).length === 0 ? (
          <div className="no-teachers">
            <p>Keine Lehrkräfte vorhanden.</p>
          </div>
        ) : (
          <div className="teachers-card-list">
            {teachers
              .filter((t) => {
                const q = search.trim().toLowerCase();
                if (!q) return true;
                const name = (t.name || '').toLowerCase();
                const email = (t.email || '').toLowerCase();
                const acct = userByTeacherId.get(t.id);
                const username = acct ? (acct.username || '').toLowerCase() : '';
                return name.includes(q) || email.includes(q) || username.includes(q);
              })
              .map((teacher) => {
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
                          <dt>System</dt>
                          <dd>
                            <select
                              className="admin-table-select"
                              value={(teacher.system || 'dual') as 'dual' | 'vollzeit'}
                              onChange={(e) => handleInlineSystemChange(teacher, e.target.value as 'dual' | 'vollzeit')}
                              disabled={!!systemSaving[teacher.id]}
                              aria-label={`System für ${teacher.name}`}
                            >
                              <option value="dual">Dual (16:00–18:00)</option>
                              <option value="vollzeit">Vollzeit (17:00–19:00)</option>
                            </select>
                          </dd>
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
                                  value={acct.role === 'admin' ? 'admin' : 'teacher'}
                                  disabled={!!roleSaving[acct.id] || (!!user?.username && acct.username === user.username && acct.role === 'admin')}
                                  onChange={(e) => updateRole(acct, e.target.value === 'admin' ? 'admin' : 'teacher')}
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
        )}
      </main>
    </div>
  );
}
