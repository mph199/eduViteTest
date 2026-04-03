import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Search, Clock, MoreVertical, Pencil, Trash2, CalendarPlus, Download, ChevronDown } from 'lucide-react';
import { useActiveView } from '../../../hooks/useActiveView';
import { useBgStyle } from '../../../hooks/useBgStyle';
import { useFlash } from '../../../hooks/useFlash';
import api from '../../../services/api';
import type { TimeSlot as ApiSlot, Teacher as ApiTeacher, GenerateSlotsResponse } from '../../../types';
import { AdminPageWrapper } from '../../../shared/components/AdminPageWrapper';
import { exportTeacherSlotsToICal } from '../../../utils/icalExport';
import { teacherDisplayName } from '../../../utils/teacherDisplayName';
import { SlotForm } from '../components/SlotForm';
import '../../../pages/AdminDashboard.css';
import '../../../pages/admin/user-management.css';

/* ── Helpers ─────────────────────────────────────────────────────── */

function getTeacherInitials(t: ApiTeacher): string {
  const first = t.first_name || t.name?.split(' ')[0] || '';
  const last = t.last_name || t.name?.split(' ').slice(-1)[0] || '';
  return ((first[0] || '') + (last[0] || '')).toUpperCase();
}

function formatTime(time: string | undefined, fallback: string): string {
  if (!time) return fallback;
  return time.split(':').slice(0, 2).join(':');
}

/* ── Slot Context Menu ───────────────────────────────────────────── */

function SlotContextMenu({ slot, onEdit, onDelete, onClose }: {
  slot: ApiSlot;
  onEdit: () => void;
  onDelete: () => void;
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

  return (
    <div className="um-context-menu" ref={ref}>
      <button className="um-context-menu__item" onClick={() => { onEdit(); onClose(); }} disabled={slot.booked}>
        <Pencil size={15} />
        Bearbeiten
      </button>
      <div className="um-context-menu__divider" />
      <button className="um-context-menu__item um-context-menu__item--danger" onClick={() => { onDelete(); onClose(); }} disabled={slot.booked}>
        <Trash2 size={15} />
        Löschen
      </button>
    </div>
  );
}

/* ── Teacher Row with Slots ──────────────────────────────────────── */

function TeacherSlotsRow({ teacher, slots, loading, onLoadSlots, showFlash }: {
  teacher: ApiTeacher;
  slots: ApiSlot[];
  loading: boolean;
  onLoadSlots: (id: number) => Promise<void>;
  showFlash: (msg: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingSlot, setEditingSlot] = useState<ApiSlot | null>(null);
  const [formData, setFormData] = useState({ time: '', date: '' });
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
  const [bulkCreating, setBulkCreating] = useState(false);

  const bookedCount = slots.filter((s) => s.booked).length;

  const handleToggle = async () => {
    if (!expanded) {
      await onLoadSlots(teacher.id);
    }
    setExpanded(!expanded);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.time.trim() || !formData.date) {
      showFlash('Bitte alle Felder ausfüllen');
      return;
    }
    try {
      if (editingSlot) {
        await api.admin.updateSlot(editingSlot.id, formData);
      } else {
        await api.admin.createSlot({ teacher_id: teacher.id, ...formData });
      }
      await onLoadSlots(teacher.id);
      setShowForm(false);
      setEditingSlot(null);
      setFormData({ time: '', date: '' });
    } catch (err) {
      showFlash(err instanceof Error ? err.message : 'Fehler beim Speichern');
    }
  };

  const handleEdit = (slot: ApiSlot) => {
    setEditingSlot(slot);
    setFormData({ time: slot.time, date: slot.date });
    setShowForm(true);
  };

  const handleDelete = async (slot: ApiSlot) => {
    if (!confirm(`Slot "${slot.time}" am ${slot.date} wirklich löschen?`)) return;
    try {
      await api.admin.deleteSlot(slot.id);
      await onLoadSlots(teacher.id);
    } catch (err) {
      showFlash(err instanceof Error ? err.message : 'Fehler beim Löschen');
    }
  };

  const handleBulkCreate = async () => {
    const name = teacherDisplayName(teacher);
    if (!confirm(`Alle Sprechzeiten für ${name} anlegen?`)) return;
    try {
      setBulkCreating(true);
      const res = await api.admin.generateTeacherSlots(teacher.id);
      const parsed = res as unknown as GenerateSlotsResponse;
      await onLoadSlots(teacher.id);
      showFlash(`${name}: ${parsed?.created ?? 0} angelegt, ${parsed?.skipped ?? 0} übersprungen`);
    } catch (err) {
      showFlash(err instanceof Error ? err.message : 'Fehler beim Anlegen');
    } finally {
      setBulkCreating(false);
    }
  };

  return (
    <div className="um-row-wrapper">
      <div className="um-row" onClick={handleToggle} style={{ cursor: 'pointer' }}>
        <div className="um-avatar um-avatar--teacher">
          {getTeacherInitials(teacher)}
        </div>
        <div className="um-info">
          <span className="um-name">
            {teacher.salutation ? `${teacher.salutation} ` : ''}{teacher.name}
          </span>
          <span className="um-role-chip um-role-chip--teacher">
            {formatTime(teacher.available_from, '16:00')} – {formatTime(teacher.available_until, '19:00')}
          </span>
          {teacher.bl_counselor_id && <span className="um-badge">BL</span>}
          {teacher.ssw_counselor_id && <span className="um-badge">SSW</span>}
        </div>
        <span className="um-email">
          <Clock size={13} className="um-email__icon" />
          {expanded ? `${slots.length} Slots` : ''}
        </span>
        <ChevronDown
          size={16}
          className={`tb-chevron${expanded ? ' tb-chevron--open' : ''}`}
        />
      </div>

      {/* Expandable Slot List */}
      <div className={`um-detail-panel${expanded ? ' um-detail-panel--open' : ''}`}>
        <div className="um-detail-panel__inner">
          <div className="slots-panel">
            {/* Toolbar */}
            <div className="slots-toolbar">
              <button className="um-header__csv-btn" onClick={(e) => { e.stopPropagation(); setShowForm(true); setEditingSlot(null); setFormData({ time: '', date: '' }); }}>
                <CalendarPlus size={14} />
                Neue Sprechzeit
              </button>
              <button className="um-header__csv-btn" onClick={(e) => { e.stopPropagation(); handleBulkCreate(); }} disabled={bulkCreating}>
                {bulkCreating ? 'Anlegen...' : 'Alle anlegen'}
              </button>
              {bookedCount > 0 && (
                <button className="um-header__csv-btn" onClick={(e) => { e.stopPropagation(); exportTeacherSlotsToICal(slots, teacherDisplayName(teacher)); }}>
                  <Download size={14} />
                  iCal
                </button>
              )}
              <span className="slots-count">
                {slots.length} Slots, {bookedCount} gebucht
              </span>
            </div>

            {/* Slot Form */}
            {showForm && (
              <SlotForm
                formData={formData}
                editing={!!editingSlot}
                onFormDataChange={setFormData}
                onSubmit={handleSubmit}
                onCancel={() => { setShowForm(false); setEditingSlot(null); setFormData({ time: '', date: '' }); }}
              />
            )}

            {/* Slot List */}
            {loading ? (
              <div className="um-empty">Laden...</div>
            ) : slots.length === 0 ? (
              <div className="um-empty">Keine Sprechzeiten vorhanden</div>
            ) : (
              <div className="slots-list">
                {slots.map((slot) => (
                  <div key={slot.id} className={`slot-row${slot.booked ? ' slot-row--booked' : ''}`}>
                    <div className="slot-row__time">
                      <span className="slot-row__date">{slot.date}</span>
                      <span className="slot-row__clock">{slot.time}</span>
                    </div>
                    <span className={`um-role-chip ${slot.booked ? 'um-role-chip--admin' : 'um-role-chip--teacher'}`}>
                      {slot.booked ? 'Gebucht' : 'Frei'}
                    </span>
                    {slot.booked && (
                      <span className="slot-row__visitor">
                        {slot.visitorType === 'parent' ? slot.parentName : slot.companyName}
                        {(slot.studentName || slot.traineeName) && (
                          <span className="slot-row__student">
                            {' '}– {slot.studentName || slot.traineeName} ({slot.className || '–'})
                          </span>
                        )}
                      </span>
                    )}
                    {!slot.booked && <span className="slot-row__visitor" />}
                    <div className="um-menu-anchor">
                      <button
                        className="um-menu-trigger"
                        onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === slot.id ? null : slot.id); }}
                        disabled={slot.booked}
                        aria-label="Aktionen"
                      >
                        <MoreVertical size={16} />
                      </button>
                      {menuOpenId === slot.id && (
                        <SlotContextMenu
                          slot={slot}
                          onEdit={() => handleEdit(slot)}
                          onDelete={() => handleDelete(slot)}
                          onClose={() => setMenuOpenId(null)}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────────────── */

export function AdminSlots() {
  const [teachers, setTeachers] = useState<ApiTeacher[]>([]);
  const [slotsByTeacher, setSlotsByTeacher] = useState<Record<number, ApiSlot[]>>({});
  const [loadingSlots, setLoadingSlots] = useState<Record<number, boolean>>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flash, showFlash] = useFlash();
  useActiveView('admin');
  const adminBgStyle = useBgStyle('admin', '--page-bg');

  const loadTeachers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getTeachers();
      setTeachers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTeachers(); }, [loadTeachers]);

  const loadSlots = useCallback(async (teacherId: number) => {
    setLoadingSlots((prev) => ({ ...prev, [teacherId]: true }));
    try {
      const data = await api.getSlots(teacherId);
      setSlotsByTeacher((prev) => ({ ...prev, [teacherId]: Array.isArray(data) ? data : [] }));
    } catch {
      setSlotsByTeacher((prev) => ({ ...prev, [teacherId]: [] }));
    } finally {
      setLoadingSlots((prev) => ({ ...prev, [teacherId]: false }));
    }
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter((t) => {
      const name = (t.name || '').toLowerCase();
      const email = (t.email || '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [teachers, search]);

  // Alphabetical grouping
  const grouped = useMemo(() => {
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

  if (loading) return <AdminPageWrapper style={adminBgStyle}><p>Lade...</p></AdminPageWrapper>;

  return (
    <AdminPageWrapper style={adminBgStyle}>
      {flash && <div className="admin-success">{flash}</div>}
      {error && <div className="admin-error">{error}</div>}

      <div className="um-header">
        <div className="um-header__left">
          <h2 className="um-header__title">Sprechzeiten</h2>
          <span className="um-header__count">{teachers.length} Lehrkräfte</span>
        </div>
      </div>

      <div className="um-search">
        <Search size={16} className="um-search__icon" />
        <input
          type="text"
          className="um-search__input"
          placeholder="Lehrkraft suchen ..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="um-empty">Keine Lehrkräfte gefunden.</div>
      ) : (
        <div className="um-list">
          {grouped.map((group) => (
            <div key={group.letter}>
              <div className="um-alpha-divider">
                <span className="um-alpha-divider__letter">{group.letter}</span>
                <span className="um-alpha-divider__line" />
              </div>
              {group.teachers.map((teacher) => (
                <TeacherSlotsRow
                  key={teacher.id}
                  teacher={teacher}
                  slots={slotsByTeacher[teacher.id] || []}
                  loading={!!loadingSlots[teacher.id]}
                  onLoadSlots={loadSlots}
                  showFlash={showFlash}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </AdminPageWrapper>
  );
}
