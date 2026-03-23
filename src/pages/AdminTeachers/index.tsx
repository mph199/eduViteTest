import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../../contexts/useAuth';
import { useActiveView } from '../../hooks/useActiveView';
import { useBgStyle } from '../../hooks/useBgStyle';
import { useFlash } from '../../hooks/useFlash';
import api from '../../services/api';
import { AdminPageWrapper } from '../../shared/components/AdminPageWrapper';
import { useModuleConfig } from '../../contexts/ModuleConfigContext';
import type { Teacher as ApiTeacher, UserAccount, BlFormData, CsvImportResult, TeacherFormData, TeacherLoginResponse } from '../../types';
import { WEEKDAY_LABELS } from '../../shared/constants/weekdays';
import { TeacherForm } from './TeacherForm';
import { CsvImportDialog } from './CsvImportDialog';
import { TeacherTable } from './TeacherTable';
import '../AdminDashboard.css';

const defaultBlForm = (): BlFormData => ({
  enabled: false,
  phone: '',
  specializations: '',
  slot_duration_minutes: 30,
  schedule: WEEKDAY_LABELS.map((_, i) => ({ weekday: i + 1, start_time: '08:00', end_time: '14:00', active: false })),
});

const defaultFormData = (): TeacherFormData => ({
  first_name: '', last_name: '', email: '', salutation: 'Herr',
  available_from: '16:00', available_until: '19:00', username: '', password: '',
});

export function AdminTeachers() {
  const { isModuleEnabled } = useModuleConfig();
  const blModuleActive = isModuleEnabled('beratungslehrer');
  const [teachers, setTeachers] = useState<ApiTeacher[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<ApiTeacher | null>(null);
  const [formData, setFormData] = useState<TeacherFormData>(defaultFormData());
  const [createdCreds, setCreatedCreds] = useState<{ username: string; tempPassword: string } | null>(null);
  const [roleSaving, setRoleSaving] = useState<Record<number, boolean>>({});
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [flash, showFlash] = useFlash(6500);
  const [csvImport, setCsvImport] = useState<{ show: boolean; uploading: boolean; result: CsvImportResult | null }>({ show: false, uploading: false, result: null });
  const [blForm, setBlForm] = useState<BlFormData>(defaultBlForm());
  const csvFileRef = useRef<HTMLInputElement | null>(null);
  const { user } = useAuth();
  useActiveView('admin');
  const adminBgStyle = useBgStyle('admin', '--page-bg');

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

  useEffect(() => {
    loadTeachers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.last_name.trim() || !formData.email.trim() || !formData.salutation) {
      setError('Bitte Nachname, Anrede und E-Mail ausfuellen');
      return;
    }

    const normalizedEmail = formData.email.trim().toLowerCase();
    const isValidEmail = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(normalizedEmail);
    if (!isValidEmail) {
      setError('Bitte eine gueltige E-Mail-Adresse eingeben.');
      return;
    }

    if (!editingTeacher) {
      if (!formData.username.trim()) {
        setError('Bitte einen Benutzernamen eingeben');
        return;
      }
      if (!formData.password || formData.password.length < 8) {
        setError('Bitte ein Passwort mit mindestens 8 Zeichen eingeben');
        return;
      }
    }

    try {
      const teacherData: Record<string, unknown> = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: normalizedEmail,
        salutation: formData.salutation,
        subject: 'Sprechstunde',
        available_from: formData.available_from,
        available_until: formData.available_until,
        room: '',
        ...(!editingTeacher && {
          username: formData.username.trim(),
          password: formData.password,
        }),
      };

      if (blModuleActive) {
        if (blForm.enabled) {
          teacherData.beratungslehrer = {
            phone: blForm.phone,
            specializations: blForm.specializations,
            slot_duration_minutes: blForm.slot_duration_minutes,
            available_from: blForm.schedule.find(s => s.active)?.start_time || '08:00',
            available_until: blForm.schedule.find(s => s.active)?.end_time || '14:00',
            schedule: blForm.schedule,
          };
        } else if (editingTeacher) {
          const hasBlData = !!(editingTeacher as ApiTeacher & { bl_counselor_id?: number }).bl_counselor_id;
          if (hasBlData) {
            teacherData.beratungslehrer = null;
          }
        }
      }

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
      setFormData(defaultFormData());
      setBlForm(defaultBlForm());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern');
    }
  };

  const handleEdit = async (teacher: ApiTeacher) => {
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
    setBlForm(defaultBlForm());
    if (blModuleActive) {
      try {
        const blData = await api.admin.getTeacherBL(teacher.id);
        if (blData?.counselor) {
          const c = blData.counselor;
          type ScheduleEntry = { weekday: number; start_time: string; end_time: string; active: boolean };
          const scheduleMap = new Map<number, ScheduleEntry>((blData.schedule || []).map((s: ScheduleEntry) => [s.weekday, s]));
          setBlForm({
            enabled: c.active !== false,
            phone: c.phone || '',
            specializations: c.specializations || '',
            slot_duration_minutes: c.slot_duration_minutes || 30,
            schedule: WEEKDAY_LABELS.map((_, i) => {
              const wd = i + 1;
              const existing = scheduleMap.get(wd);
              return existing
                ? { weekday: wd, start_time: existing.start_time, end_time: existing.end_time, active: existing.active }
                : { weekday: wd, start_time: '08:00', end_time: '14:00', active: false };
            }),
          });
        }
      } catch {
        // BL data is supplementary
      }
    }
    setShowForm(true);
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Möchten Sie die Lehrkraft "${name}" wirklich löschen?\n\nHinweis: Die Lehrkraft kann nur gelöscht werden, wenn keine Termine mehr existieren.`)) {
      return;
    }
    try {
      await api.admin.deleteTeacher(id);
      await loadTeachers();
      showFlash(`Lehrkraft "${name}" wurde erfolgreich gelöscht.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Löschen');
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingTeacher(null);
    setFormData(defaultFormData());
    setBlForm(defaultBlForm());
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
      setError('Du kannst deine eigenen Adminrechte nicht entfernen.');
      return;
    }

    const roleLabels: Record<string, string> = { admin: 'Admin', teacher: 'Lehrkraft', ssw: 'Schulsozialarbeit', superadmin: 'Superadmin' };
    if (!confirm(`Rolle von „${target.username}" zu „${roleLabels[nextRole] || nextRole}" ändern?`)) return;

    setRoleSaving((prev) => ({ ...prev, [target.id]: true }));
    setUsers((prev) => prev.map((u) => (u.id === target.id ? { ...u, role: nextRole as UserAccount['role'] } : u)));

    try {
      const updated = await api.admin.updateUserRole(target.id, nextRole);
      if (updated) {
        setUsers((prev) => prev.map((u) => (u.id === target.id ? (updated as UserAccount) : u)));
      } else {
        await loadTeachers();
      }
      showFlash('Rollenwechsel gespeichert. Wird nach erneutem Login wirksam.');
    } catch (e) {
      setUsers((prev) => prev.map((u) => (u.id === target.id ? { ...u, role: currentRole as UserAccount['role'] } : u)));
      setError(e instanceof Error ? e.message : 'Fehler beim Aktualisieren der Rolle');
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

  const filtered = teachers.filter((t) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const name = (t.name || '').toLowerCase();
    const email = (t.email || '').toLowerCase();
    const acct = userByTeacherId.get(t.id);
    const username = acct ? (acct.username || '').toLowerCase() : '';
    return name.includes(q) || email.includes(q) || username.includes(q);
  });

  return (
    <AdminPageWrapper style={adminBgStyle}>
        <div className="admin-section-header">
          <h2>Benutzer & Rechte verwalten</h2>
          {!showForm && !csvImport.show && (
            <div className="admin-actions-row">
              <button onClick={() => setShowForm(true)} className="btn-primary">
                + Neuer Nutzer
              </button>
              <button onClick={() => csvFileRef.current?.click()} className="btn-secondary">
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

        <CsvImportDialog
          csvImport={csvImport}
          onClose={() => setCsvImport({ show: false, uploading: false, result: null })}
          onImportAnother={() => { setCsvImport({ show: false, uploading: false, result: null }); csvFileRef.current?.click(); }}
        />

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
                <button type="button" className="btn-secondary btn-secondary--sm" onClick={() => setSearch('')}>
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
        {error && <div className="admin-error">{error}</div>}

        {showForm && (
          <TeacherForm
            formData={formData}
            setFormData={setFormData}
            blForm={blForm}
            setBlForm={setBlForm}
            editingTeacher={editingTeacher}
            blModuleActive={blModuleActive}
            createdCreds={createdCreds}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
          />
        )}

        <TeacherTable
          filtered={filtered}
          userByTeacherId={userByTeacherId}
          currentUsername={user?.username}
          roleSaving={roleSaving}
          expandedIds={expandedIds}
          updateRole={updateRole}
          toggleExpand={toggleExpand}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
    </AdminPageWrapper>
  );
}
