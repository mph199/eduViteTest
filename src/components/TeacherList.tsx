import type { Teacher } from '../types';

interface TeacherListProps {
  teachers: Teacher[];
  selectedTeacherId: number | null;
  onSelectTeacher: (teacherId: number) => void;
}

export const TeacherList = ({
  teachers,
  selectedTeacherId,
  onSelectTeacher,
}: TeacherListProps) => {
  return (
    <div className="teacher-list" role="region" aria-label="Lehrkräfte-Auswahl">
      <h2>Lehrkräfte</h2>
      <div className="teachers-container" role="list">
        {teachers.map((teacher) => (
          <div
            key={teacher.id}
            className={`teacher-card ${
              selectedTeacherId === teacher.id ? 'selected' : ''
            }`}
            onClick={() => onSelectTeacher(teacher.id)}
            role="listitem button"
            tabIndex={0}
            aria-selected={selectedTeacherId === teacher.id}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectTeacher(teacher.id);
              }
            }}
          >
            <h3>{teacher.name}</h3>
            <p className="subject">{teacher.subject}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
