import { useState, useEffect, useCallback } from 'react';
import '../../../pages/AdminDashboard.css';

const API_BASE = (import.meta as any).env?.VITE_API_URL || '/api';

interface Counselor {
  id: number;
  first_name: string;
  last_name: string;
  name: string;
  salutation?: string;
  email?: string;
  room?: string;
  phone?: string;
  specializations?: string;
  available_from?: string;
  available_until?: string;
  slot_duration_minutes?: number;
  active?: boolean;
  user_id?: number;
}

interface Category {
  id: number;
  name: string;
  description?: string;
  icon?: string;
  sort_order?: number;
  active?: boolean;
}

interface Stats {
  total_counselors: number;
  pending_appointments: number;
  confirmed_appointments: number;
  available_slots: number;
}

type Tab = 'counselors' | 'categories' | 'stats';

const emptyCounselor = {
  first_name: '',
  last_name: '',
  salutation: 'Frau',
  email: '',
  room: '',
  phone: '',
  specializations: '',
  available_from: '08:00',
  available_until: '14:00',
  slot_duration_minutes: 30,
};

const emptyCategory = {
  name: '',
  description: '',
  icon: '',
  sort_order: 0,
};

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...opts,
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error((data as any)?.error || `Fehler ${res.status}`);
  }
  return res.json();
}

export function SSWAdmin() {
  const [tab, setTab] = useState<Tab>('counselors');
  const [counselors, setCounselors] = useState<Counselor[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');

  // Counselor form
  const [showCounselorForm, setShowCounselorForm] = useState(false);
  const [editingCounselorId, setEditingCounselorId] = useState<number | null>(null);
  const [counselorForm, setCounselorForm] = useState(emptyCounselor);

  // Category form
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [categoryForm, setCategoryForm] = useState(emptyCategory);

  // Slot generation
  const [slotGenCounselorId, setSlotGenCounselorId] = useState<number | null>(null);
  const [slotGenFrom, setSlotGenFrom] = useState('');
  const [slotGenUntil, setSlotGenUntil] = useState('');
  const [generating, setGenerating] = useState(false);

  const showFlash = (msg: string) => { setFlash(msg); setTimeout(() => setFlash(''), 3000); };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [cData, catData, sData] = await Promise.all([
        apiFetch('/ssw/admin/counselors'),
        apiFetch('/ssw/admin/categories'),
        apiFetch('/ssw/admin/stats'),
      ]);
      setCounselors(cData.counselors || []);
      setCategories(catData.categories || []);
      setStats(sData.stats || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Counselor CRUD ────────────────────────────────────────────────
  const handleSaveCounselor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!counselorForm.first_name.trim() || !counselorForm.last_name.trim()) {
      alert('Vor- und Nachname sind Pflichtfelder.');
      return;
    }
    try {
      if (editingCounselorId) {
        await apiFetch(`/ssw/admin/counselors/${editingCounselorId}`, {
          method: 'PUT',
          body: JSON.stringify(counselorForm),
        });
        showFlash('Berater/in aktualisiert.');
      } else {
        await apiFetch('/ssw/admin/counselors', {
          method: 'POST',
          body: JSON.stringify(counselorForm),
        });
        showFlash('Berater/in erstellt.');
      }
      setShowCounselorForm(false);
      setEditingCounselorId(null);
      setCounselorForm(emptyCounselor);
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fehler beim Speichern');
    }
  };

  const handleEditCounselor = (c: Counselor) => {
    setCounselorForm({
      first_name: c.first_name || '',
      last_name: c.last_name || '',
      salutation: c.salutation || '',
      email: c.email || '',
      room: c.room || '',
      phone: c.phone || '',
      specializations: c.specializations || '',
      available_from: c.available_from?.toString().slice(0, 5) || '08:00',
      available_until: c.available_until?.toString().slice(0, 5) || '14:00',
      slot_duration_minutes: c.slot_duration_minutes || 30,
    });
    setEditingCounselorId(c.id);
    setShowCounselorForm(true);
  };

  const handleDeleteCounselor = async (id: number) => {
    if (!confirm('Berater/in wirklich löschen?')) return;
    try {
      await apiFetch(`/ssw/admin/counselors/${id}`, { method: 'DELETE' });
      showFlash('Berater/in gelöscht.');
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fehler');
    }
  };

  // ── Category CRUD ─────────────────────────────────────────────────
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.name.trim()) { alert('Name ist Pflicht.'); return; }
    try {
      if (editingCategoryId) {
        await apiFetch(`/ssw/admin/categories/${editingCategoryId}`, {
          method: 'PUT',
          body: JSON.stringify(categoryForm),
        });
        showFlash('Kategorie aktualisiert.');
      } else {
        await apiFetch('/ssw/admin/categories', {
          method: 'POST',
          body: JSON.stringify(categoryForm),
        });
        showFlash('Kategorie erstellt.');
      }
      setShowCategoryForm(false);
      setEditingCategoryId(null);
      setCategoryForm(emptyCategory);
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fehler');
    }
  };

  const handleEditCategory = (cat: Category) => {
    setCategoryForm({
      name: cat.name,
      description: cat.description || '',
      icon: cat.icon || '',
      sort_order: cat.sort_order || 0,
    });
    setEditingCategoryId(cat.id);
    setShowCategoryForm(true);
  };

  // ── Slot Generation ───────────────────────────────────────────────
  const handleGenerateSlots = async () => {
    if (!slotGenCounselorId || !slotGenFrom || !slotGenUntil) {
      alert('Bitte Berater/in und Zeitraum wählen.');
      return;
    }
    setGenerating(true);
    try {
      const data = await apiFetch('/ssw/counselor/generate-slots', {
        method: 'POST',
        body: JSON.stringify({
          counselor_id: slotGenCounselorId,
          date_from: slotGenFrom,
          date_until: slotGenUntil,
        }),
      });
      showFlash(`${data.created || 0} Termine erstellt (${data.skipped || 0} übersprungen).`);
      setSlotGenCounselorId(null);
      setSlotGenFrom('');
      setSlotGenUntil('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setGenerating(false);
    }
  };

  const today = new Date().toISOString().slice(0, 10);

  if (loading) return <div className="admin-dashboard"><p>Lade…</p></div>;

  return (
    <div className="admin-dashboard">
      <div className="admin-main">
        <div className="admin-section-header">
          <h2>Schulsozialarbeit</h2>
        </div>

        {flash && <div className="flash flash--success">{flash}</div>}
        {error && <p style={{ color: 'var(--color-error, red)' }}>{error}</p>}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
          {([['counselors', '👥 Berater/innen'], ['categories', '📂 Kategorien'], ['stats', '📊 Statistik']] as [Tab, string][]).map(([key, label]) => (
            <button
              key={key}
              className={tab === key ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Counselors Tab ─────────────────────────────────────── */}
        {tab === 'counselors' && (
          <>
            <div className="admin-section-header">
              <h3>Berater/innen</h3>
              <button
                className="btn-primary"
                onClick={() => { setCounselorForm(emptyCounselor); setEditingCounselorId(null); setShowCounselorForm(true); }}
              >
                + Neue/r Berater/in
              </button>
            </div>

            {showCounselorForm && (
              <form className="teacher-form-container" onSubmit={handleSaveCounselor}>
                <h3>{editingCounselorId ? 'Berater/in bearbeiten' : 'Neue/r Berater/in'}</h3>
                <div className="form-row">
                  <label>Anrede
                    <select value={counselorForm.salutation} onChange={e => setCounselorForm({ ...counselorForm, salutation: e.target.value })}>
                      <option value="Frau">Frau</option>
                      <option value="Herr">Herr</option>
                      <option value="">–</option>
                    </select>
                  </label>
                  <label>Vorname *
                    <input type="text" value={counselorForm.first_name} onChange={e => setCounselorForm({ ...counselorForm, first_name: e.target.value })} required />
                  </label>
                  <label>Nachname *
                    <input type="text" value={counselorForm.last_name} onChange={e => setCounselorForm({ ...counselorForm, last_name: e.target.value })} required />
                  </label>
                </div>
                <div className="form-row">
                  <label>E-Mail
                    <input type="email" value={counselorForm.email} onChange={e => setCounselorForm({ ...counselorForm, email: e.target.value })} />
                  </label>
                  <label>Raum
                    <input type="text" value={counselorForm.room} onChange={e => setCounselorForm({ ...counselorForm, room: e.target.value })} />
                  </label>
                  <label>Telefon
                    <input type="text" value={counselorForm.phone} onChange={e => setCounselorForm({ ...counselorForm, phone: e.target.value })} />
                  </label>
                </div>
                <div className="form-row">
                  <label>Schwerpunkte
                    <input type="text" value={counselorForm.specializations} onChange={e => setCounselorForm({ ...counselorForm, specializations: e.target.value })} placeholder="Kommasepariert, z.B. Mobbing, Familie" />
                  </label>
                </div>
                <div className="form-row">
                  <label>Verfügbar von
                    <input type="time" value={counselorForm.available_from} onChange={e => setCounselorForm({ ...counselorForm, available_from: e.target.value })} />
                  </label>
                  <label>Verfügbar bis
                    <input type="time" value={counselorForm.available_until} onChange={e => setCounselorForm({ ...counselorForm, available_until: e.target.value })} />
                  </label>
                  <label>Dauer (Min.)
                    <input type="number" min={10} max={120} value={counselorForm.slot_duration_minutes} onChange={e => setCounselorForm({ ...counselorForm, slot_duration_minutes: parseInt(e.target.value) || 30 })} />
                  </label>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                  <button className="btn-primary" type="submit">{editingCounselorId ? 'Speichern' : 'Erstellen'}</button>
                  <button className="btn-secondary" type="button" onClick={() => { setShowCounselorForm(false); setEditingCounselorId(null); }}>Abbrechen</button>
                </div>
              </form>
            )}

            {/* Slot Generation */}
            <details style={{ marginBottom: '1rem', marginTop: '1rem' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>🗓️ Termine generieren</summary>
              <div className="teacher-form-container" style={{ marginTop: '0.5rem' }}>
                <div className="form-row">
                  <label>Berater/in
                    <select value={slotGenCounselorId || ''} onChange={e => setSlotGenCounselorId(parseInt(e.target.value) || null)}>
                      <option value="">– Wählen –</option>
                      {counselors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </label>
                  <label>Von
                    <input type="date" min={today} value={slotGenFrom} onChange={e => setSlotGenFrom(e.target.value)} />
                  </label>
                  <label>Bis
                    <input type="date" min={slotGenFrom || today} value={slotGenUntil} onChange={e => setSlotGenUntil(e.target.value)} />
                  </label>
                </div>
                <button className="btn-primary" disabled={generating} onClick={handleGenerateSlots}>
                  {generating ? 'Generiere…' : 'Termine generieren'}
                </button>
              </div>
            </details>

            <table className="admin-resp-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>E-Mail</th>
                  <th>Raum</th>
                  <th>Zeiten</th>
                  <th>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {counselors.length === 0 ? (
                  <tr><td colSpan={5}>Keine Berater/innen vorhanden.</td></tr>
                ) : counselors.map(c => (
                  <tr key={c.id}>
                    <td>{c.salutation ? `${c.salutation} ` : ''}{c.name}</td>
                    <td>{c.email || '–'}</td>
                    <td>{c.room || '–'}</td>
                    <td>{c.available_from?.toString().slice(0, 5)} – {c.available_until?.toString().slice(0, 5)}</td>
                    <td>
                      <button className="btn-secondary btn-sm" onClick={() => handleEditCounselor(c)}>Bearbeiten</button>{' '}
                      <button className="btn-danger btn-sm" onClick={() => handleDeleteCounselor(c.id)}>Löschen</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* ── Categories Tab ─────────────────────────────────────── */}
        {tab === 'categories' && (
          <>
            <div className="admin-section-header">
              <h3>Kategorien</h3>
              <button
                className="btn-primary"
                onClick={() => { setCategoryForm(emptyCategory); setEditingCategoryId(null); setShowCategoryForm(true); }}
              >
                + Neue Kategorie
              </button>
            </div>

            {showCategoryForm && (
              <form className="teacher-form-container" onSubmit={handleSaveCategory}>
                <h3>{editingCategoryId ? 'Kategorie bearbeiten' : 'Neue Kategorie'}</h3>
                <div className="form-row">
                  <label>Name *
                    <input type="text" value={categoryForm.name} onChange={e => setCategoryForm({ ...categoryForm, name: e.target.value })} required />
                  </label>
                  <label>Icon (Emoji)
                    <input type="text" value={categoryForm.icon} onChange={e => setCategoryForm({ ...categoryForm, icon: e.target.value })} placeholder="z.B. 💬" maxLength={4} />
                  </label>
                  <label>Sortierung
                    <input type="number" value={categoryForm.sort_order} onChange={e => setCategoryForm({ ...categoryForm, sort_order: parseInt(e.target.value) || 0 })} />
                  </label>
                </div>
                <div className="form-row">
                  <label>Beschreibung
                    <input type="text" value={categoryForm.description} onChange={e => setCategoryForm({ ...categoryForm, description: e.target.value })} />
                  </label>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                  <button className="btn-primary" type="submit">{editingCategoryId ? 'Speichern' : 'Erstellen'}</button>
                  <button className="btn-secondary" type="button" onClick={() => { setShowCategoryForm(false); setEditingCategoryId(null); }}>Abbrechen</button>
                </div>
              </form>
            )}

            <table className="admin-resp-table">
              <thead>
                <tr>
                  <th>Icon</th>
                  <th>Name</th>
                  <th>Beschreibung</th>
                  <th>#</th>
                  <th>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {categories.length === 0 ? (
                  <tr><td colSpan={5}>Keine Kategorien vorhanden.</td></tr>
                ) : categories.map(cat => (
                  <tr key={cat.id}>
                    <td>{cat.icon || '–'}</td>
                    <td>{cat.name}</td>
                    <td>{cat.description || '–'}</td>
                    <td>{cat.sort_order}</td>
                    <td>
                      <button className="btn-secondary btn-sm" onClick={() => handleEditCategory(cat)}>Bearbeiten</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* ── Stats Tab ──────────────────────────────────────────── */}
        {tab === 'stats' && stats && (
          <div>
            <h3>Statistik</h3>
            <div className="stats-bar" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1rem' }}>
              <div className="stat-card" style={{ background: 'var(--brand-surface-2, #f0f4fa)', padding: '1rem 1.5rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 700 }}>{stats.total_counselors}</div>
                <div>Berater/innen</div>
              </div>
              <div className="stat-card" style={{ background: '#fff3cd', padding: '1rem 1.5rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 700 }}>{stats.pending_appointments}</div>
                <div>Offene Anfragen</div>
              </div>
              <div className="stat-card" style={{ background: '#d4edda', padding: '1rem 1.5rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 700 }}>{stats.confirmed_appointments}</div>
                <div>Bestätigte Termine</div>
              </div>
              <div className="stat-card" style={{ background: 'var(--brand-surface-2, #f0f4fa)', padding: '1rem 1.5rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 700 }}>{stats.available_slots}</div>
                <div>Freie Slots</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
