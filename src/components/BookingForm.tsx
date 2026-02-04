import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { BookingFormData } from '../types';

interface BookingFormProps {
  selectedTeacherId: number | null;
  selectedSlotId: number | null;
  onSubmit: (formData: BookingFormData) => void;
  onCancel: () => void;
  message: string;
}

export const BookingForm = ({
  selectedTeacherId,
  selectedSlotId,
  onSubmit,
  onCancel,
  message,
}: BookingFormProps) => {
  type VisitorType = BookingFormData['visitorType'];
  type BookingFormState = Omit<BookingFormData, 'visitorType'> & { visitorType: VisitorType | '' };

  const getInitialFormData = (): BookingFormState => ({
    visitorType: '',
    parentName: '',
    companyName: '',
    studentName: '',
    traineeName: '',
    representativeName: '',
    className: '',
    email: '',
    message: '',
  });

  const [formData, setFormData] = useState<BookingFormState>(getInitialFormData);

  // Wenn eine andere Lehrkraft gewählt wird, muss der Besuchertyp neu gewählt werden.
  useEffect(() => {
    setFormData(getInitialFormData());
  }, [selectedTeacherId]);

  const visitorTypeSelected = formData.visitorType === 'parent' || formData.visitorType === 'company';

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formEl = e.currentTarget;
    if (!formEl.checkValidity()) {
      formEl.reportValidity();
      return;
    }

    const visitorType = formData.visitorType;
    if (visitorType !== 'parent' && visitorType !== 'company') return;

    const { visitorType: _ignored, ...rest } = formData;
    onSubmit({ visitorType, ...rest });
    
    // Reset form after successful submission
    setFormData(getInitialFormData());
  };

  const handleCancel = () => {
    setFormData(getInitialFormData());
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
          <label htmlFor="visitorType">Besuchertyp</label>
          <select
            id="visitorType"
            value={formData.visitorType}
            onChange={(e) => {
              const next = e.target.value as VisitorType | '';
              setFormData((prev) => {
                if (next === 'parent') {
                  return {
                    ...prev,
                    visitorType: next,
                    companyName: '',
                    traineeName: '',
                    representativeName: '',
                  };
                }
                if (next === 'company') {
                  return {
                    ...prev,
                    visitorType: next,
                    parentName: '',
                    studentName: '',
                  };
                }
                return { ...prev, visitorType: '' };
              });
            }}
            required
          >
            <option value="" disabled>
              Bitte auswählen…
            </option>
            <option value="parent">Erziehungsberechtigte</option>
            <option value="company">Ausbildungsbetrieb</option>
          </select>
        </div>

        {!visitorTypeSelected ? (
          <div className="booking-form-hint" role="note">
            Bitte wählen Sie zuerst den Besuchertyp aus, um die passenden Eingabefelder zu sehen.
          </div>
        ) : (
          <>
            {formData.visitorType === 'parent' ? (
              <>
                <div className="form-group">
                  <label htmlFor="parentName">Name der erziehungsberechtigten Person(en)</label>
                  <input
                    type="text"
                    id="parentName"
                    value={formData.parentName || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, parentName: e.target.value })
                    }
                    placeholder="z.B. Familie Müller"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="studentName">Name der Schüler*in</label>
                  <input
                    type="text"
                    id="studentName"
                    value={formData.studentName || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, studentName: e.target.value })
                    }
                    placeholder="z.B. Alex Müller"
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
                    placeholder="z.B. Firma Mustermann GmbH"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="traineeName">Name des*der Auszubildenden</label>
                  <input
                    type="text"
                    id="traineeName"
                    value={formData.traineeName || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, traineeName: e.target.value })
                    }
                    placeholder="z.B. Alex Mustermann"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="representativeName">Vertreter*in des Ausbildungsbetriebs</label>
                  <input
                    type="text"
                    id="representativeName"
                    value={formData.representativeName || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, representativeName: e.target.value })
                    }
                    placeholder="z.B. Alex Beispiel"
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
                placeholder="z.B. WG25.1"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">E-Mail</label>
              <input
                type="email"
                id="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="ihre.email@beispiel.de"
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
                placeholder="Optionale Nachricht..."
                rows={3}
              />
            </div>
          </>
        )}

        <div className="form-actions">
          <button type="submit" className="btn btn-primary">
            Buchungsanfrage senden
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
          className={`message ${/erfolgreich|reserviert|bestätig/i.test(message) ? 'success' : 'error'}`}
          role="alert"
          aria-live="polite"
        >
          {message}
        </div>
      )}
    </div>
  );
};
