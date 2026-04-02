import { teacherDisplayName, teacherGroupKey } from '../../../utils/teacherDisplayName';
import type { Teacher as ApiTeacher } from '../../../types';

interface TeacherSelectProps {
  teachers: ApiTeacher[];
  selectedTeacherId: number | null;
  onSelect: (id: number) => void;
}

export function TeacherSelect({ teachers, selectedTeacherId, onSelect }: TeacherSelectProps) {
  const collator = new Intl.Collator('de', { sensitivity: 'base', numeric: true });
  const sorted = [...teachers].sort((l, r) => collator.compare(teacherDisplayName(l), teacherDisplayName(r)));
  const groups = new Map<string, typeof sorted>();
  for (const t of sorted) {
    const key = teacherGroupKey(t);
    const list = groups.get(key);
    if (list) list.push(t);
    else groups.set(key, [t]);
  }
  const entries = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], 'de'));

  return (
    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
      <label htmlFor="teacher-select">Lehrkraft auswählen</label>
      <select
        id="teacher-select"
        value={selectedTeacherId || ''}
        onChange={(e) => onSelect(parseInt(e.target.value))}
        className="admin-select--teacher"
      >
        {entries.map(([key, list]) => (
          <optgroup key={`tg-${key}`} label={key}>
            {list.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacherDisplayName(teacher)} - {teacher.available_from || '16:00'}-{teacher.available_until || '19:00'}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
