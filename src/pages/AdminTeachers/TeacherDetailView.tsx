import { ArrowLeft } from 'lucide-react';
import type { Teacher as ApiTeacher, BlFormData, SswFormData, TeacherFormData } from '../../types';
import { TeacherForm } from './TeacherForm';

interface Props {
  editingTeacher: ApiTeacher | null;
  formData: TeacherFormData;
  setFormData: React.Dispatch<React.SetStateAction<TeacherFormData>>;
  blForm: BlFormData;
  setBlForm: React.Dispatch<React.SetStateAction<BlFormData>>;
  sswForm: SswFormData;
  setSswForm: React.Dispatch<React.SetStateAction<SswFormData>>;
  adminModules: string[];
  setAdminModules: (modules: string[]) => void;
  blModuleActive: boolean;
  sswModuleActive: boolean;
  isSuperadmin: boolean;
  isModuleEnabled: (key: string) => boolean;
  createdCreds: { username: string; tempPassword: string } | null;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
}

export function TeacherDetailView({
  editingTeacher, formData, setFormData,
  blForm, setBlForm, sswForm, setSswForm,
  adminModules, setAdminModules,
  blModuleActive, sswModuleActive, isSuperadmin, isModuleEnabled,
  createdCreds, loading, onSubmit, onBack,
}: Props) {
  const title = editingTeacher
    ? `${editingTeacher.salutation ? editingTeacher.salutation + ' ' : ''}${editingTeacher.name || [editingTeacher.first_name, editingTeacher.last_name].filter(Boolean).join(' ')} bearbeiten`
    : 'Neuen Nutzer anlegen';

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="btn-secondary"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1rem' }}
      >
        <ArrowLeft size={16} aria-hidden="true" /> Zurück zur Liste
      </button>

      <div className="admin-section-header">
        <h2>{title}</h2>
      </div>

      {loading ? (
        <p>Lade Nutzerdaten...</p>
      ) : (
        <TeacherForm
          formData={formData}
          setFormData={setFormData}
          blForm={blForm}
          setBlForm={setBlForm}
          sswForm={sswForm}
          setSswForm={setSswForm}
          editingTeacher={editingTeacher}
          blModuleActive={blModuleActive}
          sswModuleActive={sswModuleActive}
          adminModules={adminModules}
          setAdminModules={setAdminModules}
          isSuperadmin={isSuperadmin}
          isModuleEnabled={isModuleEnabled}
          createdCreds={createdCreds}
          onSubmit={onSubmit}
        />
      )}
    </div>
  );
}
