import { useState } from 'react';
import type { FormEvent } from 'react';
import type { BookingFormData } from '../types';

interface BookingFormProps {
  selectedSlotId: number | null;
  onSubmit: (formData: BookingFormData) => void;
  onCancel: () => void;
  message: string;
}

export const BookingForm = ({
  selectedSlotId,
  onSubmit,
  onCancel,
  message,
}: BookingFormProps) => {
  const [formData, setFormData] = useState<BookingFormData>({
    parentName: '',
    studentName: '',
    className: '',
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    
    if (!formData.parentName || !formData.studentName || !formData.className) {
      return;
    }

    onSubmit(formData);
    
    // Reset form after successful submission
    setFormData({
      parentName: '',
      studentName: '',
      className: '',
    });
  };

  const handleCancel = () => {
    setFormData({
      parentName: '',
      studentName: '',
      className: '',
    });
    onCancel();
  };

  if (!selectedSlotId) {
    return null;
  }

  return (
    <div className="booking-form-container" role="region" aria-label="Buchungsformular">
      <h2>Termin buchen</h2>
      <form onSubmit={handleSubmit} className="booking-form" aria-label="Termin buchen">
        <div className="form-group">
          <label htmlFor="parentName">Name der Eltern</label>
          <input
            type="text"
            id="parentName"
            value={formData.parentName}
            onChange={(e) =>
              setFormData({ ...formData, parentName: e.target.value })
            }
            placeholder="z.B. Familie Müller"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="studentName">Name des Kindes</label>
          <input
            type="text"
            id="studentName"
            value={formData.studentName}
            onChange={(e) =>
              setFormData({ ...formData, studentName: e.target.value })
            }
            placeholder="z.B. Max Müller"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="className">Klasse</label>
          <input
            type="text"
            id="className"
            value={formData.className}
            onChange={(e) =>
              setFormData({ ...formData, className: e.target.value })
            }
            placeholder="z.B. 5a"
            required
          />
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary">
            Termin buchen
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="btn btn-secondary"
          >
            Abbrechen
          </button>
        </div>
      </form>

      {message && (
        <div 
          className={`message ${message.includes('erfolgreich') ? 'success' : 'error'}`}
          role="alert"
          aria-live="polite"
        >
          {message}
        </div>
      )}
    </div>
  );
};
