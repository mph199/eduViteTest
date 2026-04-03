import { useState, useEffect, useRef, useMemo } from 'react';
import { MoreVertical, ChevronDown, Pencil, KeyRound, Trash2, Mail } from 'lucide-react';
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

/* ── Helpers ─────────────────────────────────────────────────────── */

function getInitials(t: ApiTeacher): string {
  const first = t.first_name || t.name?.split(' ')[0] || '';
  const last = t.last_name || t.name?.split(' ').slice(-1)[0] || '';
  return ((first[0] || '') + (last[0] || '')).toUpperCase();
}

function getRoleLabel(role: string | undefined): string {
  if (!role) return 'Kein Login';
  if (role === 'admin') return 'Admin';
  if (role === 'superadmin') return 'Superadmin';
  return 'Lehrkraft';
}

function formatTime(time: string | undefined, fallback: string): string {
  if (!time) return fallback;
  // Strip seconds if present (16:00:00 → 16:00)
  const parts = time.split(':');
  return parts.slice(0, 2).join(':');
}

/* ── Context Menu ────────────────────────────────────────────────── */

function ContextMenu({ teacher, onEdit, onDelete, onToggleDetail, detailOpen, onClose }: {
  teacher: ApiTeacher;
  onEdit: () => void;
  onDelete: () => void;
  onToggleDetail: () => void;
  detailOpen: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const handleResetLogin = async () => {
    onClose();
    try {
      const res = await api.admin.resetTeacherLogin(teacher.id);
      const typed = res as TeacherLoginResponse;
      if (typed?.user) {
        alert(`Login zurückgesetzt\nBenutzer: ${typed.user.username}\nPasswort: ${typed.user.tempPassword}`);
      } else {
        alert('Login zurückgesetzt.');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fehler beim Zurücksetzen');
    }
  };

  return (
    <div className="um-context-menu" ref={ref}>
      <button className="um-context-menu__item" onClick={() => { onToggleDetail(); onClose(); }}>
        <ChevronDown size={15} style={{ transform: detailOpen ? 'rotate(180deg)' : undefined }} />
        {detailOpen ? 'Details ausblenden' : 'Details anzeigen'}
      </button>
      <button className="um-context-menu__item" onClick={() => { onEdit(); onClose(); }}>
        <Pencil size={15} />
        Bearbeiten
      </button>
      <button className="um-context-menu__item" onClick={handleResetLogin}>
        <KeyRound size={15} />
        Login zurücksetzen
      </button>
      <div className="um-context-menu__divider" />
      <button className="um-context-menu__item um-context-menu__item--danger" onClick={() => { onDelete(); onClose(); }}>
        <Trash2 size={15} />
        Löschen
      </button>
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────────────── */

export function TeacherTable({ filtered, userByTeacherId, currentUsername, roleSaving, updateRole, onEdit, onDelete }: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);

  const toggleDetail = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Sort alphabetically by last_name, group by first letter
  const sortedAndGrouped = useMemo(() => {
    const sorted = [...filtered].sort((a, b) => {
      const aName = (a.last_name || a.name || '').toLowerCase();
      const bName = (b.last_name || b.name || '').toLowerCase();
      return aName.localeCompare(bName, 'de');
    });

    const groups: { letter: string; teachers: ApiTeacher[] }[] = [];
    let currentLetter = '';

    for (const t of sorted) {
      const lastName = t.last_name || t.name || '';
      const letter = (lastName[0] || '#').toUpperCase();
      if (letter !== currentLetter) {
        currentLetter = letter;
        groups.push({ letter, teachers: [] });
      }
      groups[groups.length - 1].teachers.push(t);
    }

    return groups;
  }, [filtered]);

  if (filtered.length === 0) {
    return <div className="um-empty">Keine Benutzer gefunden.</div>;
  }

  return (
    <div className="um-list">
      {sortedAndGrouped.map((group) => (
        <div key={group.letter}>
          <div className="um-alpha-divider">
            <span className="um-alpha-divider__letter">{group.letter}</span>
            <span className="um-alpha-divider__line" />
          </div>

          {group.teachers.map((teacher) => {
            const acct = userByTeacherId.get(teacher.id);
            const role = acct?.role || '';
            const roleClass = role || 'teacher';
            const isDetailOpen = expandedIds.has(teacher.id);

            return (
              <div key={teacher.id} className="um-row-wrapper">
                <div className="um-row">
                  {/* Avatar */}
                  <div className={`um-avatar um-avatar--${roleClass}`}>
                    {getInitials(teacher)}
                  </div>

                  {/* Name + Role + Badges */}
                  <div className="um-info">
                    <span className="um-name">
                      {teacher.salutation ? `${teacher.salutation} ` : ''}{teacher.name}
                    </span>
                    <span className={`um-role-chip um-role-chip--${acct ? roleClass : 'nologin'}`}>
                      {getRoleLabel(acct?.role)}
                    </span>
                    {teacher.bl_counselor_id && <span className="um-badge">BL</span>}
                    {teacher.ssw_counselor_id && <span className="um-badge">SSW</span>}
                  </div>

                  {/* Email (desktop only) */}
                  {teacher.email && (
                    <span className="um-email">
                      <Mail size={13} className="um-email__icon" />
                      {teacher.email}
                    </span>
                  )}

                  {/* Three-dot menu */}
                  <div className="um-menu-anchor">
                    <button
                      className="um-menu-trigger"
                      onClick={() => setMenuOpenId(menuOpenId === teacher.id ? null : teacher.id)}
                      aria-label="Aktionen"
                    >
                      <MoreVertical size={18} />
                    </button>
                    {menuOpenId === teacher.id && (
                      <ContextMenu
                        teacher={teacher}
                        onEdit={() => onEdit(teacher)}
                        onDelete={() => onDelete(teacher.id, teacher.name)}
                        onToggleDetail={() => toggleDetail(teacher.id)}
                        detailOpen={isDetailOpen}
                        onClose={() => setMenuOpenId(null)}
                      />
                    )}
                  </div>
                </div>

                {/* Expandable Detail Panel */}
                <div className={`um-detail-panel${isDetailOpen ? ' um-detail-panel--open' : ''}`}>
                  <div className="um-detail-panel__inner">
                    <div className="um-detail-grid">
                      <div className="um-detail-item">
                        <span className="um-detail-label">Username</span>
                        <span className="um-detail-value">{acct?.username || '–'}</span>
                      </div>
                      <div className="um-detail-item">
                        <span className="um-detail-label">E-Mail</span>
                        <span className="um-detail-value">{teacher.email || '–'}</span>
                      </div>
                      <div className="um-detail-item">
                        <span className="um-detail-label">Sprechzeiten</span>
                        <span className="um-detail-value">
                          {formatTime(teacher.available_from, '16:00')} – {formatTime(teacher.available_until, '19:00')}
                        </span>
                      </div>
                      <div className="um-detail-item">
                        <span className="um-detail-label">ID</span>
                        <span className="um-detail-value">{teacher.id}</span>
                      </div>
                      {acct && (
                        <div className="um-detail-item">
                          <span className="um-detail-label">Rolle</span>
                          <span className="um-detail-value">
                            <select
                              className="admin-table-select"
                              value={acct.role}
                              disabled={!!roleSaving[acct.id] || (!!currentUsername && acct.username === currentUsername && acct.role === 'admin')}
                              onChange={(e) => updateRole(acct, e.target.value)}
                              aria-label={`Rolle für ${acct.username}`}
                            >
                              <option value="teacher">Lehrkraft</option>
                              <option value="admin">Admin</option>
                            </select>
                            {roleSaving[acct.id] && <span className="admin-users-saving"> Speichert…</span>}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
