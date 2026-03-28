import { useState } from 'react';

function defaultSchoolYear() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (m >= 7) return `${y}/${String(y + 1).slice(2)}`;
  return `${y - 1}/${String(y).slice(2)}`;
}

function inputDateTimeToIso(value: string) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

interface Props {
  onCreated: (payload: Record<string, unknown>) => Promise<void>;
  creating: boolean;
}

export function EventCreateForm({ onCreated, creating }: Props) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [createData, setCreateData] = useState({
    name: '',
    school_year: defaultSchoolYear(),
    starts_at: '',
    ends_at: '',
    booking_opens_at: '',
    booking_closes_at: '',
  });

  const handleStartsAtChange = (value: string) => {
    setCreateData((prev) => {
      const next = { ...prev, starts_at: value };
      if (value && !prev.ends_at) {
        const d = new Date(value);
        if (!Number.isNaN(d.getTime())) {
          d.setHours(d.getHours() + 3);
          const pad = (n: number) => String(n).padStart(2, '0');
          next.ends_at = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        }
      }
      return next;
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    const startsIso = inputDateTimeToIso(createData.starts_at);
    const endsIso = inputDateTimeToIso(createData.ends_at);
    const opensIso = inputDateTimeToIso(createData.booking_opens_at);
    const closesIso = inputDateTimeToIso(createData.booking_closes_at);

    if (!createData.name.trim() || !createData.school_year.trim() || !startsIso || !endsIso) {
      return; // parent handles validation error
    }

    await onCreated({
      name: createData.name.trim(),
      school_year: createData.school_year.trim(),
      starts_at: startsIso,
      ends_at: endsIso,
      booking_opens_at: opensIso,
      booking_closes_at: closesIso,
      status: 'draft',
      timezone: 'Europe/Berlin',
    });

    setCreateData({ name: '', school_year: defaultSchoolYear(), starts_at: '', ends_at: '', booking_opens_at: '', booking_closes_at: '' });
    setShowCreateForm(false);
    setShowAdvanced(false);
  };

  return (
    <div className="content-section">
      <button
        type="button"
        className="ev-section-toggle"
        onClick={() => setShowCreateForm((p) => !p)}
        aria-expanded={showCreateForm}
      >
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="ev-workflow__num" style={{ fontSize: '0.7rem', width: 22, height: 22, flexShrink: 0 }}>1</span>
          <span><span aria-hidden="true">{showCreateForm ? '−' : '+'}</span>{' '}Neues Event anlegen</span>
        </h3>
      </button>

      {showCreateForm && (
        <form onSubmit={handleCreate} className="teacher-form" style={{ marginTop: '1rem' }}>
          <div className="admin-grid-2">
            <div className="form-group">
              <label htmlFor="ev_name">Name des Sprechtags</label>
              <input
                id="ev_name"
                type="text"
                value={createData.name}
                onChange={(e) => setCreateData({ ...createData, name: e.target.value })}
                placeholder="z.B. Eltern- und Ausbildersprechtag März 2026"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="ev_year">Schuljahr</label>
              <input
                id="ev_year"
                type="text"
                value={createData.school_year}
                onChange={(e) => setCreateData({ ...createData, school_year: e.target.value })}
                placeholder="2025/26"
                required
              />
            </div>
          </div>

          <div className="admin-grid-2">
            <div className="form-group">
              <label htmlFor="ev_starts">Sprechtag beginnt</label>
              <input id="ev_starts" type="datetime-local" value={createData.starts_at} onChange={(e) => handleStartsAtChange(e.target.value)} required />
            </div>
            <div className="form-group">
              <label htmlFor="ev_ends">Sprechtag endet</label>
              <input id="ev_ends" type="datetime-local" value={createData.ends_at} onChange={(e) => setCreateData({ ...createData, ends_at: e.target.value })} required />
            </div>
          </div>

          <button type="button" className="ev-advanced-toggle" onClick={() => setShowAdvanced((p) => !p)}>
            {showAdvanced ? '▾' : '▸'} Buchungsfenster konfigurieren (optional)
          </button>

          {showAdvanced && (
            <div className="ev-advanced-section">
              <p className="ev-advanced-hint">
                Legen Sie fest, ab wann und bis wann Eltern und Ausbilder Termine anfragen können.
                Ohne Angabe ist die Buchung sofort nach Veröffentlichung möglich.
              </p>
              <div className="admin-grid-2">
                <div className="form-group">
                  <label htmlFor="ev_opens">Buchung öffnet</label>
                  <input id="ev_opens" type="datetime-local" value={createData.booking_opens_at} onChange={(e) => setCreateData({ ...createData, booking_opens_at: e.target.value })} />
                </div>
                <div className="form-group">
                  <label htmlFor="ev_closes">Buchung schließt</label>
                  <input id="ev_closes" type="datetime-local" value={createData.booking_closes_at} onChange={(e) => setCreateData({ ...createData, booking_closes_at: e.target.value })} />
                </div>
              </div>
            </div>
          )}

          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={creating}>
              {creating ? 'Erstelle…' : 'Event anlegen'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => { setShowCreateForm(false); setShowAdvanced(false); }}>
              Abbrechen
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
