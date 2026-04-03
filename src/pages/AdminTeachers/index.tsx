import { useState, useEffect, useMemo, useRef } from 'react';
import { UserPlus, Search, Upload } from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';
import { useActiveView } from '../../hooks/useActiveView';
import { useBgStyle } from '../../hooks/useBgStyle';
import { useFlash } from '../../hooks/useFlash';
import api from '../../services/api';
import { AdminPageWrapper } from '../../shared/components/AdminPageWrapper';
import { useModuleConfig } from '../../contexts/ModuleConfigContext';
import type { Teacher as ApiTeacher, UserAccount, CsvImportResult } from '../../types';
import { useTeacherForm } from './useTeacherForm';
import { TeacherDetailView } from './TeacherDetailView';
import { CsvImportDialog } from './CsvImportDialog';
import { TeacherTable } from './TeacherTable';
import '../AdminDashboard.css';
import '../../shared/styles/um-components.css';

export function AdminTeachers() {
  const { isModuleEnabled } = useModuleConfig();
  const blModuleActive = isModuleEnabled('beratungslehrer');
  const sswModuleActive = isModuleEnabled('schulsozialarbeit');
  const { user } = useAuth();
  const isSuperadmin = user?.role === 'superadmin';
  useActiveView('admin');
  const adminBgStyle = useBgStyle('admin', '--page-bg');
  const [flash, showFlash] = useFlash(6500);

  // ── List state ────────────────────────────────────────────────────
  const [teachers, setTeachers] = useState<ApiTeacher[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [roleSaving, setRoleSaving] = useState<Record<number, boolean>>({});

  // CSV state (local to list view)
  const [csvImport, setCsvImport] = useState<{ show: boolean; uploading: boolean; result: CsvImportResult | null }>({ show: false, uploading: false, result: null });
  const csvFileRef = useRef<HTMLInputElement | null>(null);

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

  useEffect(() => { loadTeachers(); }, []);

  // ── Form hook ─────────────────────────────────────────────────────
  const form = useTeacherForm({
    users, isSuperadmin, blModuleActive, sswModuleActive,
    onSuccess: loadTeachers,
    onError: setError,
  });

  // ── Derived ───────────────────────────────────────────────────────
  const userByTeacherId = useMemo(() => {
    const map = new Map<number, UserAccount>();
    for (const u of users) {
      if (u.teacher_id != null) map.set(u.teacher_id, u);
    }
    return map;
  }, [users]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter(t => {
      const name = (t.name || '').toLowerCase();
      const email = (t.email || '').toLowerCase();
      const acct = userByTeacherId.get(t.id);
      const username = acct ? (acct.username || '').toLowerCase() : '';
      const role = acct?.role || '';
      return name.includes(q) || email.includes(q) || username.includes(q) || role.includes(q);
    });
  }, [teachers, search, userByTeacherId]);

  // ── Role update (list-only) ───────────────────────────────────────
  const updateRole = async (target: UserAccount, nextRole: string) => {
    const currentRole = target.role;
    if (currentRole === nextRole) return;
    if (user?.username && target.username === user.username && currentRole === 'admin') {
      setError('Du kannst deine eigenen Adminrechte nicht entfernen.');
      return;
    }
    const roleLabels: Record<string, string> = { admin: 'Admin', teacher: 'Lehrkraft', superadmin: 'Superadmin' };
    if (!confirm(`Rolle von „${target.username}" zu „${roleLabels[nextRole] || nextRole}" ändern?`)) return;

    setRoleSaving(prev => ({ ...prev, [target.id]: true }));
    setUsers(prev => prev.map(u => u.id === target.id ? { ...u, role: nextRole as UserAccount['role'] } : u));
    try {
      const updated = await api.admin.updateUserRole(target.id, nextRole);
      if (updated) setUsers(prev => prev.map(u => u.id === target.id ? (updated as UserAccount) : u));
      else await loadTeachers();
      showFlash('Rollenwechsel gespeichert. Wird nach erneutem Login wirksam.');
    } catch (e) {
      setUsers(prev => prev.map(u => u.id === target.id ? { ...u, role: currentRole as UserAccount['role'] } : u));
      setError(e instanceof Error ? e.message : 'Fehler beim Aktualisieren der Rolle');
    } finally {
      setRoleSaving(prev => ({ ...prev, [target.id]: false }));
    }
  };

  // ── Delete (list-only) ────────────────────────────────────────────
  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Möchten Sie die Lehrkraft "${name}" wirklich löschen?\n\nHinweis: Die Lehrkraft kann nur gelöscht werden, wenn keine Termine mehr existieren.`)) return;
    try {
      await api.admin.deleteTeacher(id);
      await loadTeachers();
      showFlash(`Lehrkraft "${name}" wurde erfolgreich gelöscht.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Löschen');
    }
  };

  // ── CSV import ────────────────────────────────────────────────────
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

  // ── Loading ───────────────────────────────────────────────────────
  if (loading && !form.isDetailView) {
    return <div className="admin-loading"><div className="spinner"></div><p>Lade Lehrkräfte...</p></div>;
  }

  // ── Render ────────────────────────────────────────────────────────
  return (
    <AdminPageWrapper style={adminBgStyle}>
      {flash && <div className="admin-success">{flash}</div>}
      {error && <div className="admin-error">{error}</div>}

      {form.isDetailView ? (
        <TeacherDetailView
          editingTeacher={form.editingTeacher}
          formData={form.formData}
          setFormData={form.setFormData}
          blForm={form.blForm}
          setBlForm={form.setBlForm}
          sswForm={form.sswForm}
          setSswForm={form.setSswForm}
          adminModules={form.adminModules}
          setAdminModules={form.setAdminModules}
          blModuleActive={blModuleActive}
          sswModuleActive={sswModuleActive}
          isSuperadmin={isSuperadmin}
          isModuleEnabled={isModuleEnabled}
          createdCreds={form.createdCreds}
          loading={form.loading}
          onSubmit={form.handleSubmit}
          onBack={form.handleCancel}
        />
      ) : (
        <>
          <CsvImportDialog
            csvImport={csvImport}
            onClose={() => setCsvImport({ show: false, uploading: false, result: null })}
            onImportAnother={() => { setCsvImport({ show: false, uploading: false, result: null }); csvFileRef.current?.click(); }}
          />

          {!csvImport.show && (
            <>
              <div className="um-header">
                <div className="um-header__left">
                  <h2 className="um-header__title">Benutzer</h2>
                  <span className="um-header__count">{teachers.length}</span>
                </div>
                <div className="um-header__actions">
                  <button onClick={() => csvFileRef.current?.click()} className="um-header__csv-btn">
                    <Upload size={15} />
                    <span className="um-header__btn-label">CSV</span>
                  </button>
                  <input
                    ref={csvFileRef}
                    type="file"
                    accept=".csv,.txt"
                    style={{ display: 'none' }}
                    onChange={(e) => { const file = e.target.files?.[0]; if (file) handleCsvImport(file); e.target.value = ''; }}
                  />
                  <button onClick={form.handleNewUser} className="um-header__add-btn">
                    <UserPlus size={15} />
                    <span className="um-header__btn-label">Hinzufügen</span>
                  </button>
                </div>
              </div>

              <div className="um-search">
                <Search size={16} className="um-search__icon" />
                <input
                  type="text"
                  className="um-search__input"
                  placeholder="Benutzer suchen ..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <TeacherTable
                filtered={filtered}
                userByTeacherId={userByTeacherId}
                currentUsername={user?.username}
                roleSaving={roleSaving}
                updateRole={updateRole}
                onEdit={form.handleEdit}
                onDelete={handleDelete}
              />
            </>
          )}
        </>
      )}
    </AdminPageWrapper>
  );
}
