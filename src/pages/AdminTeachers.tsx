import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/useAuth';
import api from '../services/api';
import type { Teacher as ApiTeacher } from '../types';
import './AdminDashboard.css';

type TeacherLoginResponse = {
  user?: {
    username: string;
    tempPassword: string;
  };
};

export function AdminTeachers() {
  const [teachers, setTeachers] = useState<ApiTeacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<ApiTeacher | null>(null);
  const [formData, setFormData] = useState({ name: '', email: '', salutation: 'Herr' as 'Herr' | 'Frau' | 'Divers', system: 'dual' as 'dual' | 'vollzeit', username: '', password: '' });
  const [createdCreds, setCreatedCreds] = useState<{ username: string; tempPassword: string } | null>(null);
  const [systemSaving, setSystemSaving] = useState<Record<number, boolean>>({});
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const { user, setActiveView } = useAuth();

  const canSwitchView = Boolean(user?.role === 'admin' && user.teacherId);

  useEffect(() => {
    if (canSwitchView) setActiveView('admin');
  }, [canSwitchView, setActiveView]);

  const loadTeachers = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await api.admin.getTeachers();
      setTeachers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Lehrkräfte');
    } finally {
      setLoading(false);
    }
  };

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
          <h2>Lehrkräfte verwalten</h2>
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
                placeholder="Name oder E-Mail…"
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
          return name.includes(q) || email.includes(q);
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
                return name.includes(q) || email.includes(q);
              })
              .map((teacher) => {
                const isExpanded = expandedIds.has(teacher.id);
                const systemLabel = teacher.system === 'vollzeit' ? 'Vollzeit' : 'Dual';
                const timeLabel = teacher.system === 'vollzeit' ? '17:00–19:00' : '16:00–18:00';
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
                          <span className={`teacher-card__tag teacher-card__tag--${teacher.system || 'dual'}`}>{systemLabel}</span>
                          <span className="teacher-card__tag teacher-card__tag--time">{timeLabel}</span>
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
                          <dt>ID</dt>
                          <dd>{teacher.id}</dd>
                        </div>
                      </dl>
                      <div className="teacher-card__actions">
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
