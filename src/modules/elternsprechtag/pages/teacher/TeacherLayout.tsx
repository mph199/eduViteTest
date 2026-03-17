import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useActiveView } from '../../../../hooks/useActiveView';
import { useBranding } from '../../../../contexts/BrandingContext';
import api from '../../../../services/api';
import '../../../../pages/AdminDashboard.css';

export type TeacherInfo = {
  id: number;
  first_name?: string;
  last_name?: string;
  name: string;
  subject: string;
  system?: string;
  room?: string;
};

export type TeacherOutletContext = {
  teacher: TeacherInfo | null;
  refreshTeacher: () => Promise<void>;
};

export function TeacherLayout() {
  const [teacher, setTeacher] = useState<TeacherInfo | null>(null);
  useActiveView('teacher');
  const { branding } = useBranding();

  const refreshTeacher = async () => {
    try {
      const t = await api.teacher.getInfo().catch(() => null);
      setTeacher((t as TeacherInfo) || null);
    } catch {
      setTeacher(null);
    }
  };

  useEffect(() => {
    refreshTeacher();
  }, []);

  const outletContext: TeacherOutletContext = {
    teacher,
    refreshTeacher,
  };

  return (
    <div
      className="admin-dashboard admin-dashboard--teacher"
      style={branding.background_images?.admin ? { '--admin-bg': `url(${api.superadmin.resolveBgUrl(branding.background_images.admin)})` } as React.CSSProperties : undefined}
    >
      <main className="admin-main">
        <Outlet context={outletContext} />
      </main>
    </div>
  );
}
