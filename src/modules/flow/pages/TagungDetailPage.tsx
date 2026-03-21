import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';
import type { FlowTagung, FlowAgendaPunkt } from '../../../types/index';

const fieldStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', fontSize: 14,
    border: '1px solid var(--flow-border)', borderRadius: 8,
    background: 'var(--flow-bg)', color: 'var(--flow-text)',
    resize: 'vertical' as const,
};

const labelStyle: React.CSSProperties = {
    display: 'block', marginBottom: 4, fontSize: 13,
    fontWeight: 600, color: 'var(--flow-text)',
};

export function TagungDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const tagungId = Number(id);

    const [showAgendaForm, setShowAgendaForm] = useState(false);
    const [agendaTitel, setAgendaTitel] = useState('');
    const [agendaBeschreibung, setAgendaBeschreibung] = useState('');
    const [editingPunkt, setEditingPunkt] = useState<number | null>(null);
    const [ergebnis, setErgebnis] = useState('');
    const [entscheidung, setEntscheidung] = useState('');
    const [showAufgabeForm, setShowAufgabeForm] = useState<number | null>(null);
    const [aufgabeTitel, setAufgabeTitel] = useState('');
    const [aufgabeZustaendig, setAufgabeZustaendig] = useState('');
    const [error, setError] = useState('');

    const { data: tagung, isLoading, isError } = useQuery<FlowTagung>({
        queryKey: ['flow', 'tagung', id],
        queryFn: () => api.flow.getTagung(tagungId),
        enabled: !!id,
    });

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ['flow', 'tagung', id] });
    };

    const addAgendaMutation = useMutation({
        mutationFn: () => api.flow.addAgendaPunkt(tagungId, {
            titel: agendaTitel.trim(),
            beschreibung: agendaBeschreibung.trim() || undefined,
        }),
        onSuccess: () => {
            invalidate();
            setShowAgendaForm(false);
            setAgendaTitel('');
            setAgendaBeschreibung('');
        },
        onError: () => setError('Agenda-Punkt konnte nicht erstellt werden'),
    });

    const dokumentiereMutation = useMutation({
        mutationFn: (punktId: number) => api.flow.dokumentiereAgendaPunkt(tagungId, punktId, {
            ergebnis: ergebnis.trim() || undefined,
            entscheidung: entscheidung.trim() || undefined,
        }),
        onSuccess: () => {
            invalidate();
            setEditingPunkt(null);
            setErgebnis('');
            setEntscheidung('');
        },
    });

    const createAufgabeMutation = useMutation({
        mutationFn: (punktId: number) => api.flow.createAufgabeAusAgenda(tagungId, punktId, {
            titel: aufgabeTitel.trim(),
            zustaendig: Number(aufgabeZustaendig),
        }),
        onSuccess: () => {
            invalidate();
            setShowAufgabeForm(null);
            setAufgabeTitel('');
            setAufgabeZustaendig('');
        },
        onError: () => setError('Aufgabe konnte nicht erstellt werden'),
    });

    if (isLoading) {
        return <div className="flow-empty"><div className="flow-empty__text">Laden...</div></div>;
    }

    if (isError) {
        return <div className="flow-empty"><div className="flow-empty__text">Fehler beim Laden der Tagung</div></div>;
    }

    if (!tagung) {
        return <div className="flow-empty"><div className="flow-empty__text">Tagung nicht gefunden</div></div>;
    }

    const agendaPunkte: FlowAgendaPunkt[] = Array.isArray(tagung.agendaPunkte) ? tagung.agendaPunkte : [];

    return (
        <>
            <div className="flow-breadcrumb">
                <a onClick={() => navigate('/teacher/flow')}>Dashboard</a>
                <span className="flow-breadcrumb__separator">/</span>
                <a onClick={() => navigate(`/teacher/flow/arbeitspaket/${tagung.arbeitspaketId}`)}>Arbeitspaket</a>
                <span className="flow-breadcrumb__separator">/</span>
                <span>{tagung.titel}</span>
            </div>

            {error && <div className="flow-hinweis-chip flow-hinweis-chip--alert" style={{ marginBottom: 12 }}>
                <span className="flow-hinweis-chip__dot" />{error}
                <button onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', marginLeft: 8 }}>x</button>
            </div>}

            <h1 className="flow-page-title">{tagung.titel}</h1>
            <p className="flow-page-subtitle">
                {new Date(tagung.startAt).toLocaleDateString('de-DE', {
                    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                })}
                {tagung.raum && ` \u2022 Raum ${tagung.raum}`}
                {tagung.endAt && ` \u2022 bis ${new Date(tagung.endAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`}
            </p>

            {/* Teilnehmende */}
            {Array.isArray(tagung.teilnehmende) && tagung.teilnehmende.length > 0 && (
                <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
                    {tagung.teilnehmende.map((t) => (
                        <div key={t.userId} className="flow-avatar" style={{ background: 'var(--flow-brand)' }}>
                            {t.vorname?.[0]}{t.nachname?.[0]}
                        </div>
                    ))}
                </div>
            )}

            {/* Agenda */}
            <div className="flow-panel">
                <div className="flow-panel__header">
                    <span className="flow-panel__title">Agenda ({agendaPunkte.length})</span>
                    <button className="flow-btn flow-btn--primary flow-btn--sm"
                        onClick={() => setShowAgendaForm(!showAgendaForm)}>
                        + Agenda-Punkt
                    </button>
                </div>

                {showAgendaForm && (
                    <div className="flow-panel__body" style={{ borderBottom: '1px solid var(--flow-border)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <div>
                                <label style={labelStyle}>Titel *</label>
                                <input type="text" value={agendaTitel} onChange={(e) => setAgendaTitel(e.target.value)}
                                    placeholder="Thema des Agenda-Punkts" style={fieldStyle} autoFocus />
                            </div>
                            <div>
                                <label style={labelStyle}>Beschreibung</label>
                                <textarea value={agendaBeschreibung} onChange={(e) => setAgendaBeschreibung(e.target.value)}
                                    placeholder="Optionale Details" rows={2} style={fieldStyle} />
                            </div>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                <button className="flow-btn flow-btn--secondary flow-btn--sm" onClick={() => setShowAgendaForm(false)}>Abbrechen</button>
                                <button className="flow-btn flow-btn--primary flow-btn--sm"
                                    onClick={() => addAgendaMutation.mutate()}
                                    disabled={!agendaTitel.trim() || addAgendaMutation.isPending}>
                                    Hinzufuegen
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flow-panel__body--flush">
                    {agendaPunkte.length > 0 ? (
                        agendaPunkte.map((punkt, idx) => (
                            <div key={punkt.id} style={{ padding: '14px 18px', borderBottom: '1px solid var(--flow-border)' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                    <span style={{
                                        fontFamily: 'var(--flow-font-mono)', fontSize: 12, fontWeight: 600,
                                        color: 'var(--flow-text-muted)', minWidth: 24,
                                    }}>
                                        {idx + 1}.
                                    </span>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--flow-text)' }}>{punkt.titel}</div>
                                        {punkt.beschreibung && (
                                            <div style={{ fontSize: 12, color: 'var(--flow-text-muted)', marginTop: 4 }}>{punkt.beschreibung}</div>
                                        )}

                                        {/* Ergebnis / Entscheidung */}
                                        {punkt.ergebnis && (
                                            <div style={{ marginTop: 8, padding: '8px 10px', background: 'var(--flow-green-light)', borderRadius: 4, fontSize: 12 }}>
                                                <strong>Ergebnis:</strong> {punkt.ergebnis}
                                            </div>
                                        )}
                                        {punkt.entscheidung && (
                                            <div style={{ marginTop: 4, padding: '8px 10px', background: 'var(--flow-brand-light)', borderRadius: 4, fontSize: 12 }}>
                                                <strong>Entscheidung:</strong> {punkt.entscheidung}
                                            </div>
                                        )}

                                        {/* Neue Aufgaben aus Agenda */}
                                        {Array.isArray(punkt.neueAufgaben) && punkt.neueAufgaben.length > 0 && (
                                            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--flow-text-secondary)' }}>
                                                {punkt.neueAufgaben.map((a) => (
                                                    <div key={a.id} style={{ padding: '2px 0' }}>
                                                        Aufgabe: {a.titel} {a.zustaendigName && `(${a.zustaendigName})`}
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Edit mode: Dokumentation */}
                                        {editingPunkt === punkt.id && (
                                            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                <div>
                                                    <label style={labelStyle}>Ergebnis</label>
                                                    <textarea value={ergebnis} onChange={(e) => setErgebnis(e.target.value)}
                                                        placeholder="Was wurde besprochen?" rows={2} style={fieldStyle} />
                                                </div>
                                                <div>
                                                    <label style={labelStyle}>Entscheidung</label>
                                                    <textarea value={entscheidung} onChange={(e) => setEntscheidung(e.target.value)}
                                                        placeholder="Was wurde beschlossen?" rows={2} style={fieldStyle} />
                                                </div>
                                                <div style={{ display: 'flex', gap: 8 }}>
                                                    <button className="flow-btn flow-btn--secondary flow-btn--sm" onClick={() => setEditingPunkt(null)}>Abbrechen</button>
                                                    <button className="flow-btn flow-btn--primary flow-btn--sm"
                                                        onClick={() => dokumentiereMutation.mutate(punkt.id)}
                                                        disabled={dokumentiereMutation.isPending}>
                                                        Speichern
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Aufgabe-aus-Agenda Form */}
                                        {showAufgabeForm === punkt.id && (
                                            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                <div style={{ display: 'flex', gap: 10 }}>
                                                    <div style={{ flex: 1 }}>
                                                        <label style={labelStyle}>Aufgabe *</label>
                                                        <input type="text" value={aufgabeTitel} onChange={(e) => setAufgabeTitel(e.target.value)}
                                                            placeholder="Aufgabentitel" style={fieldStyle} autoFocus />
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <label style={labelStyle}>Zustaendig *</label>
                                                        <select value={aufgabeZustaendig} onChange={(e) => setAufgabeZustaendig(e.target.value)} style={fieldStyle}>
                                                            <option value="">-- Auswaehlen --</option>
                                                            {Array.isArray(tagung.teilnehmende) && tagung.teilnehmende.map((t) => (
                                                                <option key={t.userId} value={t.userId}>{t.vorname} {t.nachname}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: 8 }}>
                                                    <button className="flow-btn flow-btn--secondary flow-btn--sm" onClick={() => setShowAufgabeForm(null)}>Abbrechen</button>
                                                    <button className="flow-btn flow-btn--primary flow-btn--sm"
                                                        onClick={() => createAufgabeMutation.mutate(punkt.id)}
                                                        disabled={!aufgabeTitel.trim() || !aufgabeZustaendig || createAufgabeMutation.isPending}>
                                                        Erstellen
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Action buttons */}
                                    {editingPunkt !== punkt.id && showAufgabeForm !== punkt.id && (
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            <button className="flow-btn flow-btn--secondary flow-btn--sm"
                                                onClick={() => {
                                                    setEditingPunkt(punkt.id);
                                                    setErgebnis(punkt.ergebnis || '');
                                                    setEntscheidung(punkt.entscheidung || '');
                                                }}>
                                                Dokumentieren
                                            </button>
                                            <button className="flow-btn flow-btn--secondary flow-btn--sm"
                                                onClick={() => setShowAufgabeForm(punkt.id)}>
                                                + Aufgabe
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="flow-empty"><div className="flow-empty__text">Noch keine Agenda-Punkte</div></div>
                    )}
                </div>
            </div>
        </>
    );
}
