import { useState } from 'react';
import api from '../../services/api';
import type { Teacher as ApiTeacher, UserAccount, TeacherLoginResponse } from '../../types';

interface Props {
  filtered: ApiTeacher[];
  userByTeacherId: Map<number, UserAccount>;
  currentUsername: string | undefined;
  roleSaving: Record<number, boolean>;
  updateRole: (target: UserAccount, nextRole: string) => void;
  onEdit: (teacher: ApiTeacher) => void;
  onDelete: (id: number, name: string) => void;
}

function ResetLoginButton({ teacher, className }: { teacher: ApiTeacher; className?: string }) {
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  return (
    <>
      <button
        onClick={async () => {
          try {
            const res = await api.admin.resetTeacherLogin(teacher.id);
            const typed = res as TeacherLoginResponse;
            if (typed?.user) {
              setFeedback({ type: 'success', message: `Login zurückgesetzt – Benutzer: ${typed.user.username}, Passwort: ${typed.user.tempPassword}` });
            } else {
              setFeedback({ type: 'success', message: 'Login zurückgesetzt.' });
            }
          } catch (err) {
            setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Fehler beim Zurücksetzen des Logins' });
          }
        }}
        className={`reset-button${className ? ` ${className}` : ''}`}
      >
        <span aria-hidden="true">↺</span> Login zurücksetzen
      </button>
      {feedback && (
        <div className={`reset-feedback ${feedback.type === 'success' ? 'admin-success' : 'admin-error'}`}>
          {feedback.message}
          <button type="button" className="btn-secondary btn-secondary--sm" onClick={() => setFeedback(null)}>OK</button>
        </div>
      )}
    </>
  );
}

function RoleSelect({ acct, isSelf, roleSaving, updateRole }: {
  acct: UserAccount; isSelf: boolean;
  roleSaving: Record<number, boolean>;
  updateRole: (target: UserAccount, nextRole: string) => void;
}) {
  return (
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
    </div>
  );
}

export function TeacherTable({ filtered, userByTeacherId, currentUsername, roleSaving, updateRole, onEdit, onDelete }: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
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
                const isSelf = !!currentUsername && acct?.username === currentUsername;
                return (
                  <tr key={teacher.id}>
                    <td>
                      <div className="admin-cell-main">
                        {teacher.salutation || ''} {teacher.name}
                        {teacher.bl_counselor_id && <span className="admin-badge admin-badge--bl" role="img" aria-label="Beratungslehrkraft">BL</span>}
                        {teacher.ssw_counselor_id && <span className="admin-badge admin-badge--ssw" role="img" aria-label="Schulsozialarbeit">SSW</span>}
                      </div>
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
                        <span style={{ color: 'var(--color-gray-400)' }}>–</span>
                      )}
                    </td>
                    <td>
                      {acct ? (
                        <div className="admin-users-action">
                          <RoleSelect acct={acct} isSelf={isSelf} roleSaving={roleSaving} updateRole={updateRole} />
                        </div>
                      ) : (
                        <span className="teacher-card__tag teacher-card__tag--nologin" style={{ fontSize: '0.78rem' }}>Kein Login</span>
                      )}
                    </td>
                    <td className="admin-actions-cell">
                      <div className="action-buttons">
                        <button onClick={() => onEdit(teacher)} className="edit-button">
                          <span aria-hidden="true">✎</span> Bearbeiten
                        </button>
                        <button onClick={() => onDelete(teacher.id, teacher.name)} className="cancel-button">
                          <span aria-hidden="true">✕</span> Löschen
                        </button>
                        <ResetLoginButton teacher={teacher} />
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
                    <span className="teacher-card__name">
                      {teacher.salutation || ''} {teacher.name}
                      {teacher.bl_counselor_id && <span className="admin-badge admin-badge--bl" title="Beratungslehrkraft">BL</span>}
                      {teacher.ssw_counselor_id && <span className="admin-badge admin-badge--ssw" title="Schulsozialarbeit">SSW</span>}
                    </span>
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
                      <dt>Sprechzeiten</dt>
                      <dd>{teacher.available_from || '16:00'} – {teacher.available_until || '19:00'}</dd>
                    </div>
                    <div className="teacher-card__row">
                      <dt>Username</dt>
                      <dd>
                        {acct ? (
                          <span className="admin-users-username">
                            {acct.username}
                            {currentUsername === acct.username && <span className="admin-users-badge" title="Das bist du">Du</span>}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--color-gray-400)' }}>Kein Login vorhanden</span>
                        )}
                      </dd>
                    </div>
                    {acct && (
                      <div className="teacher-card__row">
                        <dt>Rolle</dt>
                        <dd>
                          <RoleSelect
                            acct={acct}
                            isSelf={!!currentUsername && acct.username === currentUsername}
                            roleSaving={roleSaving}
                            updateRole={updateRole}
                          />
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
                      <button onClick={() => onEdit(teacher)} className="edit-button">
                        <span aria-hidden="true">✎</span> Bearbeiten
                      </button>
                      <button onClick={() => onDelete(teacher.id, teacher.name)} className="cancel-button">
                        <span aria-hidden="true">✕</span> Löschen
                      </button>
                    </div>
                    <ResetLoginButton teacher={teacher} className="teacher-card__actions-full" />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </>
  );
}
