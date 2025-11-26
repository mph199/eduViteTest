import { useState } from 'react';
import type { FormEvent } from 'react';
import type { BookingFormData } from '../types';
import { exportSlotToICal } from '../utils/icalExport';
import type { ApiSlot } from '../services/api';

interface BookingFormProps {
  selectedSlotId: number | null;
  onSubmit: (formData: BookingFormData) => void;
  onCancel: () => void;
  message: string;
  bookedSlot?: ApiSlot;
  teacherName?: string;
}

export const BookingForm = ({
  selectedSlotId,
  onSubmit,
  onCancel,
  message,
  bookedSlot,
  teacherName,
}: BookingFormProps) => {
  const [formData, setFormData] = useState<BookingFormData>({
    visitorType: 'parent',
    parentName: '',
    studentName: '',
    className: '',
    email: '',
    message: '',
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    
    // Validate based on visitor type
    if (formData.visitorType === 'parent') {
      if (!formData.parentName || !formData.studentName || !formData.className || !formData.email) {
        return;
      }
    } else {
      if (!formData.companyName || !formData.traineeName || !formData.className || !formData.email) {
        return;
      }
    }

    onSubmit(formData);
    
    // Reset form after successful submission
    setFormData({
      visitorType: 'parent',
      parentName: '',
      studentName: '',
      className: '',
      email: '',
      message: '',
    });
  };

  const handleCancel = () => {
    setFormData({
      visitorType: 'parent',
      parentName: '',
      studentName: '',
      className: '',
      email: '',
      message: '',
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
          <label>Ich bin...</label>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="radio"
                name="visitorType"
                value="parent"
                checked={formData.visitorType === 'parent'}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  visitorType: e.target.value as 'parent' | 'company',
                  parentName: '',
                  companyName: '',
                  studentName: '',
                  traineeName: ''
                })}
                style={{ marginRight: '0.5rem' }}
              />
              Erziehungsberechtigte/r
            </label>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="radio"
                name="visitorType"
                value="company"
                checked={formData.visitorType === 'company'}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  visitorType: e.target.value as 'parent' | 'company',
                  parentName: '',
                  companyName: '',
                  studentName: '',
                  traineeName: ''
                })}
                style={{ marginRight: '0.5rem' }}
              />
              Ausbildungsbetrieb
            </label>
          </div>
        </div>

        {formData.visitorType === 'parent' ? (
          <>
            <div className="form-group">
              <label htmlFor="parentName">Name der Eltern</label>
              <input
                type="text"
                id="parentName"
                value={formData.parentName || ''}
                onChange={(e) =>
                  setFormData({ ...formData, parentName: e.target.value })
                }
                placeholder="z.B. Familie Müller"
                autoComplete="name"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="studentName">Name des Schülers / der Schülerin</label>
              <input
                type="text"
                id="studentName"
                value={formData.studentName || ''}
                onChange={(e) =>
                  setFormData({ ...formData, studentName: e.target.value })
                }
                placeholder="z.B. Max Müller"
                autoComplete="off"
                required
              />
            </div>
          </>
        ) : (
          <>
            <div className="form-group">
              <label htmlFor="companyName">Name des Ausbildungsbetriebs</label>
              <input
                type="text"
                id="companyName"
                value={formData.companyName || ''}
                onChange={(e) =>
                  setFormData({ ...formData, companyName: e.target.value })
                }
                placeholder="z.B. Musterfirma GmbH"
                autoComplete="organization"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="traineeName">Name des Auszubildenden</label>
              <input
                type="text"
                id="traineeName"
                value={formData.traineeName || ''}
                onChange={(e) =>
                  setFormData({ ...formData, traineeName: e.target.value })
                }
                placeholder="z.B. Max Mustermann"
                autoComplete="off"
                required
              />
            </div>
          </>
        )}

        <div className="form-group">
          <label htmlFor="className">Klasse</label>
          <input
            type="text"
            id="className"
            value={formData.className}
            onChange={(e) =>
              setFormData({ ...formData, className: e.target.value })
            }
            placeholder="z.B. HH21A"
            autoComplete="off"
            inputMode="text"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="email">E-Mail-Adresse</label>
          <input
            type="email"
            id="email"
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
            placeholder="z.B. max.mueller@example.com"
            autoComplete="email"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="message">Nachricht an die Lehrkraft (optional)</label>
          <textarea
            id="message"
            value={formData.message || ''}
            onChange={(e) =>
              setFormData({ ...formData, message: e.target.value })
            }
            placeholder="z.B. Ich möchte über die Leistungen in Mathematik sprechen..."
            rows={4}
            style={{ 
              width: '100%', 
              padding: '0.65rem', 
              borderRadius: '8px', 
              border: '2px solid #e5e7eb',
              fontSize: '1rem',
              fontFamily: 'inherit',
              resize: 'vertical'
            }}
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
          {message.includes('erfolgreich') && bookedSlot && teacherName && (
            <button
              type="button"
              onClick={() => exportSlotToICal(bookedSlot, teacherName)}
              className="btn btn-primary"
              style={{ marginTop: '10px' }}
            >
              📅 Zum Kalender hinzufügen
            </button>
          )}
        </div>
      )}
    </div>
  );
};
