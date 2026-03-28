import { useState, useRef, useCallback } from 'react';
import type { Teacher as ApiTeacher, UserAccount, BlFormData, SswFormData, TeacherFormData, TeacherLoginResponse } from '../../types';
import { WEEKDAY_LABELS } from '../../shared/constants/weekdays';
import api from '../../services/api';

const defaultFormData = (): TeacherFormData => ({
  first_name: '', last_name: '', email: '', salutation: 'Herr',
  available_from: '16:00', available_until: '19:00', username: '', password: '',
});

const defaultBlForm = (): BlFormData => ({
  enabled: false, room: '', phone: '', specializations: '',
  slot_duration_minutes: 30,
  schedule: WEEKDAY_LABELS.map((_, i) => ({ weekday: i + 1, start_time: '08:00', end_time: '14:00', active: false })),
});

const defaultSswForm = (): SswFormData => ({
  enabled: false, phone: '', room: '', specializations: '',
  slot_duration_minutes: 30, requires_confirmation: true,
  schedule: WEEKDAY_LABELS.map((_, i) => ({ weekday: i + 1, start_time: '08:00', end_time: '14:00', active: false })),
});

function buildSchedule(entries: Array<{ weekday: number; start_time: string; end_time: string; active: boolean }>) {
  return WEEKDAY_LABELS.map((_, i) => {
    const wd = i + 1;
    const existing = entries.find(s => s.weekday === wd);
    return existing
      ? { weekday: wd, start_time: existing.start_time, end_time: existing.end_time, active: existing.active }
      : { weekday: wd, start_time: '08:00', end_time: '14:00', active: false };
  });
}

interface UseTeacherFormOptions {
  users: UserAccount[];
  isSuperadmin: boolean;
  blModuleActive: boolean;
  sswModuleActive: boolean;
  onSuccess: () => Promise<void>;
  onError: (msg: string) => void;
}

export function useTeacherForm(options: UseTeacherFormOptions) {
  const { users, isSuperadmin, blModuleActive, sswModuleActive, onSuccess, onError } = options;

  const [isDetailView, setIsDetailView] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<ApiTeacher | null>(null);
  const [formData, setFormData] = useState<TeacherFormData>(defaultFormData());
  const [blForm, setBlForm] = useState<BlFormData>(defaultBlForm());
  const [sswForm, setSswForm] = useState<SswFormData>(defaultSswForm());
  const [adminModules, setAdminModules] = useState<string[]>([]);
  const [createdCreds, setCreatedCreds] = useState<{ username: string; tempPassword: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // Race condition guard: cancel stale async loads
  const editIdRef = useRef<number | null>(null);

  const resetForm = useCallback(() => {
    setEditingTeacher(null);
    setFormData(defaultFormData());
    setBlForm(defaultBlForm());
    setSswForm(defaultSswForm());
    setAdminModules([]);
    setCreatedCreds(null);
    editIdRef.current = null;
  }, []);

  const handleNewUser = useCallback(() => {
    resetForm();
    setIsDetailView(true);
  }, [resetForm]);

  const handleCancel = useCallback(() => {
    resetForm();
    setIsDetailView(false);
  }, [resetForm]);

  const handleEdit = useCallback(async (teacher: ApiTeacher) => {
    const editId = teacher.id;
    editIdRef.current = editId;

    setEditingTeacher(teacher);
    setFormData({
      first_name: teacher.first_name || '',
      last_name: teacher.last_name || teacher.name || '',
      email: teacher.email || '',
      salutation: (teacher.salutation || 'Herr') as 'Herr' | 'Frau' | 'Divers',
      available_from: teacher.available_from || '16:00',
      available_until: teacher.available_until || '19:00',
      username: '', password: '',
    });
    setBlForm(defaultBlForm());
    setSswForm(defaultSswForm());
    setAdminModules([]);
    setCreatedCreds(null);
    setIsDetailView(true);
    setLoading(true);

    // Load BL data
    if (blModuleActive) {
      try {
        const blData = await api.admin.getTeacherBL(teacher.id);
        if (editIdRef.current !== editId) return; // stale
        if (blData?.counselor) {
          const c = blData.counselor;
          setBlForm({
            enabled: c.active !== false, room: c.room || '',
            phone: c.phone || '', specializations: c.specializations || '',
            slot_duration_minutes: c.slot_duration_minutes || 30,
            schedule: buildSchedule(blData.schedule || []),
          });
        }
      } catch { /* supplementary */ }
    }

    // Load SSW data
    if (sswModuleActive) {
      try {
        const sswData = await api.admin.getTeacherSSW(teacher.id);
        if (editIdRef.current !== editId) return; // stale
        if (sswData?.counselor) {
          const c = sswData.counselor;
          setSswForm({
            enabled: c.active !== false, phone: c.phone || '', room: c.room || '',
            specializations: c.specializations || '',
            slot_duration_minutes: c.slot_duration_minutes || 30,
            requires_confirmation: c.requires_confirmation !== false,
            schedule: buildSchedule(sswData.schedule || []),
          });
        }
      } catch { /* supplementary */ }
    }

    // Load admin modules
    if (isSuperadmin) {
      try {
        const linkedUser = users.find(u => u.teacher_id === teacher.id);
        if (linkedUser && editIdRef.current === editId) {
          const data = await api.admin.getUserAdminAccess(linkedUser.id);
          if (editIdRef.current === editId) {
            setAdminModules(Array.isArray(data?.adminModules) ? data.adminModules : []);
          }
        }
      } catch { /* supplementary */ }
    }

    if (editIdRef.current === editId) setLoading(false);
  }, [blModuleActive, sswModuleActive, isSuperadmin, users]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.last_name.trim() || !formData.email.trim() || !formData.salutation) {
      onError('Bitte Nachname, Anrede und E-Mail ausfüllen');
      return;
    }

    const normalizedEmail = formData.email.trim().toLowerCase();
    if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(normalizedEmail)) {
      onError('Bitte eine gültige E-Mail-Adresse eingeben.');
      return;
    }

    if (!editingTeacher) {
      if (!formData.username.trim()) { onError('Bitte einen Benutzernamen eingeben'); return; }
      if (!formData.password || formData.password.length < 8) {
        onError('Bitte ein Passwort mit mindestens 8 Zeichen eingeben'); return;
      }
    }

    try {
      const teacherData: Record<string, unknown> = {
        first_name: formData.first_name, last_name: formData.last_name,
        email: normalizedEmail, salutation: formData.salutation,
        subject: 'Sprechstunde',
        available_from: formData.available_from, available_until: formData.available_until,
        ...(!editingTeacher && { username: formData.username.trim(), password: formData.password }),
      };

      if (blModuleActive) {
        if (blForm.enabled) {
          teacherData.beratungslehrer = {
            room: blForm.room, phone: blForm.phone, specializations: blForm.specializations,
            slot_duration_minutes: blForm.slot_duration_minutes,
            available_from: blForm.schedule.find(s => s.active)?.start_time || '08:00',
            available_until: blForm.schedule.find(s => s.active)?.end_time || '14:00',
            schedule: blForm.schedule,
          };
        } else if (editingTeacher?.bl_counselor_id) {
          teacherData.beratungslehrer = null;
        }
      }

      if (sswModuleActive) {
        if (sswForm.enabled) {
          teacherData.schulsozialarbeit = {
            room: sswForm.room, phone: sswForm.phone, specializations: sswForm.specializations,
            slot_duration_minutes: sswForm.slot_duration_minutes,
            requires_confirmation: sswForm.requires_confirmation,
            available_from: sswForm.schedule.find(s => s.active)?.start_time || '08:00',
            available_until: sswForm.schedule.find(s => s.active)?.end_time || '14:00',
            schedule: sswForm.schedule,
          };
        } else if (editingTeacher?.ssw_counselor_id) {
          teacherData.schulsozialarbeit = null;
        }
      }

      if (editingTeacher) {
        await api.admin.updateTeacher(editingTeacher.id, teacherData);
        if (isSuperadmin) {
          try {
            const linkedUser = users.find(u => u.teacher_id === editingTeacher.id);
            if (linkedUser) await api.admin.updateUserAdminAccess(linkedUser.id, adminModules);
          } catch { /* supplementary */ }
        }
      } else {
        const res = await api.admin.createTeacher(teacherData);
        const typed = res as TeacherLoginResponse;
        if (typed?.user) {
          setCreatedCreds({ username: typed.user.username, tempPassword: typed.user.tempPassword });
        }
      }

      await onSuccess();
      resetForm();
      setIsDetailView(false);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Fehler beim Speichern');
    }
  }, [formData, blForm, sswForm, editingTeacher, adminModules, blModuleActive, sswModuleActive, isSuperadmin, users, onSuccess, onError, resetForm]);

  return {
    isDetailView, loading,
    editingTeacher,
    formData, setFormData,
    blForm, setBlForm,
    sswForm, setSswForm,
    adminModules, setAdminModules,
    createdCreds,
    handleNewUser, handleEdit, handleSubmit, handleCancel,
  };
}
