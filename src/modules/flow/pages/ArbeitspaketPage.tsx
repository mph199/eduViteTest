import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';
import { StatusBadge } from '../components/StatusBadge';
import { FortschrittsBalken } from '../components/FortschrittsBalken';
import { DeadlineAnzeige } from '../components/DeadlineAnzeige';
import type {
    FlowArbeitspaket, FlowAufgabe, FlowAufgabenStatus,
    FlowArbeitspaketMitglied, FlowArbeitspaketRolle,
    FlowTagungSummary, FlowDatei, FlowAktivitaet,
} from '../../../types/index';

type Tab = 'aufgaben' | 'tagungen' | 'mitglieder' | 'dateien' | 'aktivitaeten';

const STATUS_UEBERGAENGE: Record<string, string[]> = {
    entwurf: ['geplant'],
    geplant: ['aktiv', 'entwurf'],
    aktiv: [],
    abgeschlossen: [],
};

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

export function ArbeitspaketPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const paketId = Number(id);

    const [activeTab, setActiveTab] = useState<Tab>('aufgaben');
    const [showAufgabeForm, setShowAufgabeForm] = useState(false);
    const [aufgabeTitel, setAufgabeTitel] = useState('');
    const [aufgabeZustaendig, setAufgabeZustaendig] = useState<number | null>(null);
    const [aufgabeDeadline, setAufgabeDeadline] = useState('');
    const [showMitgliedForm, setShowMitgliedForm] = useState(false);
    const [neuesMitgliedId, setNeuesMitgliedId] = useState('');
    const [neuesMitgliedRolle, setNeuesMitgliedRolle] = useState<FlowArbeitspaketRolle>('mitwirkende');
    const [showAbschluss, setShowAbschluss] = useState(false);
    const [abschlussText, setAbschlussText] = useState('');
    const [reflexionText, setReflexionText] = useState('');
    const [showDateiForm, setShowDateiForm] = useState(false);
    const [dateiName, setDateiName] = useState('');
    const [dateiUrl, setDateiUrl] = useState('');
    const [showTagungForm, setShowTagungForm] = useState(false);
    const [tagungTitel, setTagungTitel] = useState('');
    const [tagungStart, setTagungStart] = useState('');
    const [tagungRaum, setTagungRaum] = useState('');
    const [error, setError] = useState('');

    // ── Queries ──────────────────────────────────────────────────────
    const { data: paket, isLoading } = useQuery<FlowArbeitspaket>({
        queryKey: ['flow', 'arbeitspakete', id],
        queryFn: () => api.flow.getArbeitspaket(paketId),
        enabled: !!id,
    });

    const { data: aufgaben } = useQuery<FlowAufgabe[]>({
        queryKey: ['flow', 'aufgaben', id],
        queryFn: () => api.flow.getAufgaben(paketId),
        enabled: !!id,
    });

    const { data: tagungen } = useQuery<FlowTagungSummary[]>({
        queryKey: ['flow', 'tagungen', id],
        queryFn: () => api.flow.getTagungen(paketId),
        enabled: !!id && activeTab === 'tagungen',
    });

    const { data: mitglieder } = useQuery<FlowArbeitspaketMitglied[]>({
        queryKey: ['flow', 'mitglieder', id],
        queryFn: () => api.flow.getMitglieder(paketId),
        enabled: !!id && activeTab === 'mitglieder',
    });

    const { data: dateien } = useQuery<FlowDatei[]>({
        queryKey: ['flow', 'dateien', id],
        queryFn: () => api.flow.getDateien(paketId),
        enabled: !!id && activeTab === 'dateien',
    });

    const { data: aktivitaeten } = useQuery<FlowAktivitaet[]>({
        queryKey: ['flow', 'aktivitaeten', id],
        queryFn: () => api.flow.getAktivitaeten(paketId),
        enabled: !!id && activeTab === 'aktivitaeten',
    });

    // ── Mutations ────────────────────────────────────────────────────
    const invalidateAll = () => {
        queryClient.invalidateQueries({ queryKey: ['flow', 'arbeitspakete', id] });
        queryClient.invalidateQueries({ queryKey: ['flow', 'aufgaben', id] });
        queryClient.invalidateQueries({ queryKey: ['flow', 'dashboard'] });
    };

    const aufgabeStatusMutation = useMutation({
        mutationFn: ({ aufgabeId, status }: { aufgabeId: number; status: FlowAufgabenStatus }) =>
            api.flow.updateAufgabeStatus(aufgabeId, status),
        onSuccess: invalidateAll,
    });

    const createAufgabeMutation = useMutation({
        mutationFn: () => api.flow.createAufgabe(paketId, {
            titel: aufgabeTitel.trim(),
            zustaendig: aufgabeZustaendig ?? 0,
            deadline: aufgabeDeadline || null,
        }),
        onSuccess: () => {
            invalidateAll();
            setShowAufgabeForm(false);
            setAufgabeTitel('');
            setAufgabeZustaendig(null);
            setAufgabeDeadline('');
        },
        onError: () => setError('Fehler beim Erstellen der Aufgabe'),
    });

    const deleteAufgabeMutation = useMutation({
        mutationFn: (aufgabeId: number) => api.flow.deleteAufgabe(aufgabeId),
        onSuccess: invalidateAll,
        onError: () => setError('Aufgabe konnte nicht geloescht werden'),
    });

    const paketStatusMutation = useMutation({
        mutationFn: (status: string) => api.flow.updateArbeitspaketStatus(paketId, status),
        onSuccess: invalidateAll,
        onError: () => setError('Statuswechsel fehlgeschlagen'),
    });

    const deletePaketMutation = useMutation({
        mutationFn: () => api.flow.deleteArbeitspaket(paketId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['flow'] });
            navigate(-1);
        },
        onError: () => setError('Arbeitspaket konnte nicht geloescht werden'),
    });

    const abschliessenMutation = useMutation({
        mutationFn: () => api.flow.abschliessenArbeitspaket(paketId, {
            abschlussZusammenfassung: abschlussText.trim(),
            reflexion: reflexionText.trim() || null,
        }),
        onSuccess: () => {
            invalidateAll();
            setShowAbschluss(false);
        },
        onError: () => setError('Abschluss fehlgeschlagen'),
    });

    const wiederaufnehmenMutation = useMutation({
        mutationFn: () => api.flow.wiederaufnehmenArbeitspaket(paketId),
        onSuccess: invalidateAll,
    });

    const addMitgliedMutation = useMutation({
        mutationFn: () => api.flow.addMitglied(paketId, Number(neuesMitgliedId), neuesMitgliedRolle),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['flow', 'mitglieder', id] });
            invalidateAll();
            setShowMitgliedForm(false);
            setNeuesMitgliedId('');
        },
        onError: () => setError('Mitglied konnte nicht hinzugefuegt werden'),
    });

    const updateRolleMutation = useMutation({
        mutationFn: ({ userId, rolle }: { userId: number; rolle: string }) =>
            api.flow.updateMitgliedRolle(paketId, userId, rolle),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['flow', 'mitglieder', id] }),
        onError: () => setError('Rolle konnte nicht geaendert werden'),
    });

    const removeMitgliedMutation = useMutation({
        mutationFn: (userId: number) => api.flow.removeMitglied(paketId, userId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['flow', 'mitglieder', id] });
            invalidateAll();
        },
        onError: () => setError('Mitglied konnte nicht entfernt werden'),
    });

    const addDateiMutation = useMutation({
        mutationFn: () => api.flow.addDateiMetadaten(paketId, {
            name: dateiName.trim(),
            originalName: dateiName.trim(),
            mimeType: 'application/octet-stream',
            groesse: 0,
            externalUrl: dateiUrl.trim() || undefined,
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['flow', 'dateien', id] });
            setShowDateiForm(false);
            setDateiName('');
            setDateiUrl('');
        },
    });

    const deleteDateiMutation = useMutation({
        mutationFn: (dateiId: number) => api.flow.deleteDatei(dateiId),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['flow', 'dateien', id] }),
        onError: () => setError('Datei konnte nicht entfernt werden'),
    });

    const createTagungMutation = useMutation({
        mutationFn: () => api.flow.createTagung(paketId, {
            titel: tagungTitel.trim(),
            startAt: tagungStart,
            raum: tagungRaum.trim() || null,
            teilnehmende: [],
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['flow', 'tagungen', id] });
            invalidateAll();
            setShowTagungForm(false);
            setTagungTitel('');
            setTagungStart('');
            setTagungRaum('');
        },
        onError: () => setError('Tagung konnte nicht erstellt werden'),
    });

    // ── Helpers ──────────────────────────────────────────────────────
    const istKoordination = paket?.meineRolle === 'koordination';
    const istMitwirkende = paket?.meineRolle === 'mitwirkende';
    const kannSchreiben = istKoordination || istMitwirkende;
    const naechsteStatus = paket ? (STATUS_UEBERGAENGE[paket.status] || []) : [];

    const tabs: { key: Tab; label: string; count?: number }[] = [
        { key: 'aufgaben', label: 'Aufgaben', count: Array.isArray(aufgaben) ? aufgaben.length : 0 },
        { key: 'tagungen', label: 'Tagungen' },
        { key: 'mitglieder', label: 'Mitglieder', count: paket?.mitglieder?.length },
        { key: 'dateien', label: 'Dateien' },
        { key: 'aktivitaeten', label: 'Aktivitaeten' },
    ];

    if (isLoading) {
        return <div className="flow-empty"><div className="flow-empty__text">Laden...</div></div>;
    }
    if (!paket) {
        return <div className="flow-empty"><div className="flow-empty__text">Arbeitspaket nicht gefunden</div></div>;
    }

    return (
        <>
            {/* Breadcrumb */}
            <div className="flow-breadcrumb">
                <a onClick={() => navigate('/teacher/flow')}>Dashboard</a>
                <span className="flow-breadcrumb__separator">/</span>
                {paket.bildungsgangName && (
                    <>
                        <a onClick={() => navigate(`/teacher/flow/bildungsgang/${paket.bildungsgangId}`)}>
                            {paket.bildungsgangName}
                        </a>
                        <span className="flow-breadcrumb__separator">/</span>
                    </>
                )}
                <span>{paket.titel}</span>
            </div>

            {error && <div className="flow-hinweis-chip flow-hinweis-chip--alert" style={{ marginBottom: 12 }}>
                <span className="flow-hinweis-chip__dot" />{error}
                <button onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', marginLeft: 8 }}>x</button>
            </div>}

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                <h1 className="flow-page-title" style={{ margin: 0 }}>{paket.titel}</h1>
                <StatusBadge status={paket.status} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <p className="flow-page-subtitle" style={{ margin: 0 }}>
                    {paket.meineRolle && <>Deine Rolle: {paket.meineRolle}</>}
                    {paket.deadline && <> &bull; <DeadlineAnzeige deadline={paket.deadline} /></>}
                </p>

                {/* Status-Workflow Buttons */}
                {istKoordination && naechsteStatus.map((s) => (
                    <button key={s} className="flow-btn flow-btn--secondary flow-btn--sm"
                        onClick={() => paketStatusMutation.mutate(s)}
                        disabled={paketStatusMutation.isPending}
                    >
                        Status: {s}
                    </button>
                ))}

                {istKoordination && paket.status === 'aktiv' && (
                    <button className="flow-btn flow-btn--primary flow-btn--sm"
                        onClick={() => setShowAbschluss(true)}>
                        Abschliessen
                    </button>
                )}

                {istKoordination && paket.status === 'abgeschlossen' && (
                    <button className="flow-btn flow-btn--secondary flow-btn--sm"
                        onClick={() => wiederaufnehmenMutation.mutate()}
                        disabled={wiederaufnehmenMutation.isPending}>
                        Wiederaufnehmen
                    </button>
                )}

                {istKoordination && paket.status === 'entwurf' && (
                    <button className="flow-btn flow-btn--danger flow-btn--sm"
                        onClick={() => { if (confirm('Arbeitspaket endgueltig loeschen?')) deletePaketMutation.mutate(); }}>
                        Loeschen
                    </button>
                )}
            </div>

            {/* Abschluss-Zusammenfassung (wenn abgeschlossen) */}
            {paket.status === 'abgeschlossen' && paket.abschlussZusammenfassung && (
                <div className="flow-panel" style={{ marginBottom: 16, borderLeft: '3px solid var(--flow-green)' }}>
                    <div className="flow-panel__header">
                        <span className="flow-panel__title">Abschluss-Zusammenfassung</span>
                    </div>
                    <div className="flow-panel__body">
                        <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{paket.abschlussZusammenfassung}</div>
                        {paket.reflexion && (
                            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--flow-border)' }}>
                                <div style={labelStyle}>Reflexion</div>
                                <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{paket.reflexion}</div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Fortschritt + Tagungen */}
            <div className="flow-stat-strip">
                <div className="flow-stat-card" style={{ '--stat-accent': 'var(--flow-green)' } as React.CSSProperties}>
                    <div className="flow-stat-card__label">Fortschritt</div>
                    <FortschrittsBalken erledigt={paket.fortschritt?.erledigt || 0} gesamt={paket.fortschritt?.gesamt || 0} />
                </div>
                {paket.tagungsZaehler && (
                    <div className="flow-stat-card" style={{ '--stat-accent': 'var(--flow-brand)' } as React.CSSProperties}>
                        <div className="flow-stat-card__label">Tagungen</div>
                        <div className="flow-stat-card__value" style={{ fontSize: 18 }}>
                            {paket.tagungsZaehler.durchgefuehrt} / {paket.tagungsZaehler.durchgefuehrt + paket.tagungsZaehler.geplant}
                        </div>
                    </div>
                )}
            </div>

            {/* Ist/Soll */}
            <div className="flow-ist-soll" style={{ marginBottom: 20 }}>
                <div className="flow-ist-soll__block">
                    <div className="flow-ist-soll__label flow-ist-soll__label--ist">Ist-Zustand</div>
                    <div className="flow-ist-soll__text">{paket.istZustand}</div>
                </div>
                <div className="flow-ist-soll__block">
                    <div className="flow-ist-soll__label flow-ist-soll__label--soll">Soll-Zustand</div>
                    <div className="flow-ist-soll__text">{paket.sollZustand}</div>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--flow-border)', marginBottom: 16 }}>
                {tabs.map((tab) => (
                    <button key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        style={{
                            padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                            background: 'none', border: 'none', borderBottom: activeTab === tab.key ? '2px solid var(--flow-brand)' : '2px solid transparent',
                            color: activeTab === tab.key ? 'var(--flow-brand)' : 'var(--flow-text-muted)',
                        }}
                    >
                        {tab.label}{tab.count != null ? ` (${tab.count})` : ''}
                    </button>
                ))}
            </div>

            {/* ── Tab: Aufgaben ────────────────────────────────────────── */}
            {activeTab === 'aufgaben' && (
                <div className="flow-panel">
                    <div className="flow-panel__header">
                        <span className="flow-panel__title">Aufgaben ({Array.isArray(aufgaben) ? aufgaben.length : 0})</span>
                        {kannSchreiben && (
                            <button className="flow-btn flow-btn--primary flow-btn--sm"
                                onClick={() => setShowAufgabeForm(!showAufgabeForm)}>
                                + Aufgabe
                            </button>
                        )}
                    </div>

                    {showAufgabeForm && (
                        <div className="flow-panel__body" style={{ borderBottom: '1px solid var(--flow-border)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <div>
                                    <label style={labelStyle}>Titel *</label>
                                    <input type="text" value={aufgabeTitel} onChange={(e) => setAufgabeTitel(e.target.value)}
                                        placeholder="Aufgabe beschreiben" style={fieldStyle} autoFocus />
                                </div>
                                <div style={{ display: 'flex', gap: 10 }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={labelStyle}>Zustaendig</label>
                                        <select value={aufgabeZustaendig ?? ''} onChange={(e) => setAufgabeZustaendig(e.target.value ? Number(e.target.value) : null)}
                                            style={fieldStyle}>
                                            <option value="">-- Nicht zugewiesen --</option>
                                            {Array.isArray(paket.mitglieder) && paket.mitglieder.map((m) => (
                                                <option key={m.userId} value={m.userId}>{m.vorname} {m.nachname}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={labelStyle}>Deadline</label>
                                        <input type="date" value={aufgabeDeadline} onChange={(e) => setAufgabeDeadline(e.target.value)} style={fieldStyle} />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                    <button className="flow-btn flow-btn--secondary flow-btn--sm" onClick={() => setShowAufgabeForm(false)}>Abbrechen</button>
                                    <button className="flow-btn flow-btn--primary flow-btn--sm"
                                        onClick={() => createAufgabeMutation.mutate()}
                                        disabled={!aufgabeTitel.trim() || aufgabeZustaendig === null || createAufgabeMutation.isPending}>
                                        Erstellen
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flow-panel__body--flush">
                        {Array.isArray(aufgaben) && aufgaben.length > 0 ? (
                            aufgaben.map((aufgabe) => (
                                <div key={aufgabe.id} className="flow-task-row">
                                    <button
                                        className={`flow-task-row__checkbox ${
                                            aufgabe.status === 'erledigt' ? 'flow-task-row__checkbox--done' :
                                            aufgabe.status === 'in_bearbeitung' ? 'flow-task-row__checkbox--in-progress' : ''
                                        }`}
                                        onClick={() => aufgabeStatusMutation.mutate({
                                            aufgabeId: aufgabe.id,
                                            status: aufgabe.status === 'erledigt' ? 'offen' : 'erledigt'
                                        })}
                                        aria-label={aufgabe.status === 'erledigt' ? 'Als offen markieren' : 'Als erledigt markieren'}
                                    >
                                        {aufgabe.status === 'erledigt' && '\u2713'}
                                    </button>
                                    <div className={`flow-task-row__title ${aufgabe.status === 'erledigt' ? 'flow-task-row__title--done' : ''}`}>
                                        {aufgabe.titel}
                                    </div>
                                    <div className="flow-task-row__meta">
                                        {aufgabe.zustaendigName && (
                                            <span style={{ fontSize: 11, color: 'var(--flow-text-muted)' }}>{aufgabe.zustaendigName}</span>
                                        )}
                                        <DeadlineAnzeige deadline={aufgabe.deadline} erledigt={aufgabe.status === 'erledigt'} />
                                        {istKoordination && (
                                            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--flow-red)', fontSize: 12 }}
                                                onClick={() => { if (confirm('Aufgabe loeschen?')) deleteAufgabeMutation.mutate(aufgabe.id); }}>
                                                Loeschen
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="flow-empty"><div className="flow-empty__text">Noch keine Aufgaben</div></div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Tab: Tagungen ────────────────────────────────────────── */}
            {activeTab === 'tagungen' && (
                <div className="flow-panel">
                    <div className="flow-panel__header">
                        <span className="flow-panel__title">Tagungen</span>
                        {istKoordination && (
                            <button className="flow-btn flow-btn--primary flow-btn--sm"
                                onClick={() => setShowTagungForm(!showTagungForm)}>
                                + Tagung
                            </button>
                        )}
                    </div>

                    {showTagungForm && (
                        <div className="flow-panel__body" style={{ borderBottom: '1px solid var(--flow-border)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <div>
                                    <label style={labelStyle}>Titel *</label>
                                    <input type="text" value={tagungTitel} onChange={(e) => setTagungTitel(e.target.value)}
                                        placeholder="z.B. Kick-off Lehrplanrevision" style={fieldStyle} autoFocus />
                                </div>
                                <div style={{ display: 'flex', gap: 10 }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={labelStyle}>Start *</label>
                                        <input type="datetime-local" value={tagungStart} onChange={(e) => setTagungStart(e.target.value)} style={fieldStyle} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={labelStyle}>Raum</label>
                                        <input type="text" value={tagungRaum} onChange={(e) => setTagungRaum(e.target.value)}
                                            placeholder="z.B. A203" style={fieldStyle} />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                    <button className="flow-btn flow-btn--secondary flow-btn--sm" onClick={() => setShowTagungForm(false)}>Abbrechen</button>
                                    <button className="flow-btn flow-btn--primary flow-btn--sm"
                                        onClick={() => createTagungMutation.mutate()}
                                        disabled={!tagungTitel.trim() || !tagungStart || createTagungMutation.isPending}>
                                        Erstellen
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flow-panel__body--flush">
                        {Array.isArray(tagungen) && tagungen.length > 0 ? (
                            tagungen.map((t) => (
                                <div key={t.id} className="flow-task-row" style={{ cursor: 'pointer' }}
                                    onClick={() => navigate(`/teacher/flow/tagung/${t.id}`)}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--flow-text)' }}>{t.titel}</div>
                                        <div style={{ fontSize: 11, color: 'var(--flow-text-muted)', marginTop: 2 }}>
                                            {t.teilnehmendeCount} Teilnehmende{t.raum && ` \u2022 ${t.raum}`}
                                        </div>
                                    </div>
                                    <span className="flow-deadline flow-deadline--ok" style={{ fontFamily: 'var(--flow-font-mono)' }}>
                                        {new Date(t.startAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            ))
                        ) : (
                            <div className="flow-empty"><div className="flow-empty__text">Noch keine Tagungen</div></div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Tab: Mitglieder ──────────────────────────────────────── */}
            {activeTab === 'mitglieder' && (
                <div className="flow-panel">
                    <div className="flow-panel__header">
                        <span className="flow-panel__title">Mitglieder ({Array.isArray(mitglieder) ? mitglieder.length : paket.mitglieder?.length || 0})</span>
                        {istKoordination && (
                            <button className="flow-btn flow-btn--primary flow-btn--sm"
                                onClick={() => setShowMitgliedForm(!showMitgliedForm)}>
                                + Mitglied
                            </button>
                        )}
                    </div>

                    {showMitgliedForm && (
                        <div className="flow-panel__body" style={{ borderBottom: '1px solid var(--flow-border)' }}>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={labelStyle}>User-ID</label>
                                    <input type="number" value={neuesMitgliedId} onChange={(e) => setNeuesMitgliedId(e.target.value)}
                                        placeholder="User-ID" style={fieldStyle} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={labelStyle}>Rolle</label>
                                    <select value={neuesMitgliedRolle} onChange={(e) => setNeuesMitgliedRolle(e.target.value as FlowArbeitspaketRolle)} style={fieldStyle}>
                                        <option value="mitwirkende">Mitwirkende</option>
                                        <option value="koordination">Koordination</option>
                                        <option value="lesezugriff">Lesezugriff</option>
                                    </select>
                                </div>
                                <button className="flow-btn flow-btn--primary flow-btn--sm"
                                    onClick={() => addMitgliedMutation.mutate()}
                                    disabled={!neuesMitgliedId || addMitgliedMutation.isPending}>
                                    Hinzufuegen
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="flow-panel__body--flush">
                        {(Array.isArray(mitglieder) ? mitglieder : paket.mitglieder || []).map((m) => (
                            <div key={m.userId || m.id} className="flow-task-row">
                                <div className="flow-avatar" style={{ background: 'var(--flow-brand)' }}>
                                    {m.vorname?.[0]}{m.nachname?.[0]}
                                </div>
                                <div style={{ flex: 1 }}>{m.vorname} {m.nachname}</div>
                                {istKoordination ? (
                                    <select value={m.rolle}
                                        onChange={(e) => updateRolleMutation.mutate({ userId: m.userId, rolle: e.target.value })}
                                        style={{ ...fieldStyle, width: 'auto', padding: '4px 8px', fontSize: 12 }}>
                                        <option value="koordination">Koordination</option>
                                        <option value="mitwirkende">Mitwirkende</option>
                                        <option value="lesezugriff">Lesezugriff</option>
                                    </select>
                                ) : (
                                    <span className="flow-status-badge flow-status-badge--geplant">{m.rolle}</span>
                                )}
                                {istKoordination && (
                                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--flow-red)', fontSize: 12 }}
                                        onClick={() => { if (confirm(`${m.vorname} ${m.nachname} entfernen?`)) removeMitgliedMutation.mutate(m.userId); }}>
                                        Entfernen
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Tab: Dateien ─────────────────────────────────────────── */}
            {activeTab === 'dateien' && (
                <div className="flow-panel">
                    <div className="flow-panel__header">
                        <span className="flow-panel__title">Dateien</span>
                        {kannSchreiben && (
                            <button className="flow-btn flow-btn--primary flow-btn--sm"
                                onClick={() => setShowDateiForm(!showDateiForm)}>
                                + Datei / Link
                            </button>
                        )}
                    </div>

                    {showDateiForm && (
                        <div className="flow-panel__body" style={{ borderBottom: '1px solid var(--flow-border)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <div>
                                    <label style={labelStyle}>Name *</label>
                                    <input type="text" value={dateiName} onChange={(e) => setDateiName(e.target.value)}
                                        placeholder="z.B. Protokoll Kick-off.pdf" style={fieldStyle} autoFocus />
                                </div>
                                <div>
                                    <label style={labelStyle}>Externer Link (optional)</label>
                                    <input type="url" value={dateiUrl} onChange={(e) => setDateiUrl(e.target.value)}
                                        placeholder="https://..." style={fieldStyle} maxLength={2048} />
                                </div>
                                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                    <button className="flow-btn flow-btn--secondary flow-btn--sm" onClick={() => setShowDateiForm(false)}>Abbrechen</button>
                                    <button className="flow-btn flow-btn--primary flow-btn--sm"
                                        onClick={() => addDateiMutation.mutate()}
                                        disabled={!dateiName.trim() || addDateiMutation.isPending}>
                                        Hinzufuegen
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flow-panel__body--flush">
                        {Array.isArray(dateien) && dateien.length > 0 ? (
                            dateien.map((d) => (
                                <div key={d.id} className="flow-task-row">
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--flow-text)' }}>
                                            {d.externalUrl && /^https?:\/\//i.test(d.externalUrl) ? (
                                                <a href={d.externalUrl} target="_blank" rel="noopener noreferrer"
                                                    style={{ color: 'var(--flow-brand)', textDecoration: 'none' }}>
                                                    {d.originalName || d.name}
                                                </a>
                                            ) : (
                                                d.originalName || d.name
                                            )}
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--flow-text-muted)', marginTop: 2 }}>
                                            {d.hochgeladenVonName && `${d.hochgeladenVonName} \u2022 `}
                                            {new Date(d.createdAt).toLocaleDateString('de-DE')}
                                            {d.groesse > 0 && ` \u2022 ${(d.groesse / 1024).toFixed(0)} KB`}
                                        </div>
                                    </div>
                                    {istKoordination && (
                                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--flow-red)', fontSize: 12 }}
                                            onClick={() => { if (confirm('Datei entfernen?')) deleteDateiMutation.mutate(d.id); }}>
                                            Entfernen
                                        </button>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="flow-empty"><div className="flow-empty__text">Noch keine Dateien</div></div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Tab: Aktivitaeten ────────────────────────────────────── */}
            {activeTab === 'aktivitaeten' && (
                <div className="flow-panel">
                    <div className="flow-panel__header">
                        <span className="flow-panel__title">Aktivitaeten</span>
                    </div>
                    <div className="flow-panel__body--flush">
                        {Array.isArray(aktivitaeten) && aktivitaeten.length > 0 ? (
                            aktivitaeten.map((a) => (
                                <div key={a.id} className="flow-task-row">
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 13, color: 'var(--flow-text)' }}>
                                            {a.akteurName && <strong>{a.akteurName}</strong>}{' '}
                                            {formatAktivitaet(a.typ)}
                                        </div>
                                    </div>
                                    <span style={{ fontSize: 11, color: 'var(--flow-text-muted)', fontFamily: 'var(--flow-font-mono)', whiteSpace: 'nowrap' }}>
                                        {new Date(a.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            ))
                        ) : (
                            <div className="flow-empty"><div className="flow-empty__text">Noch keine Aktivitaeten</div></div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Abschluss-Dialog ────────────────────────────────────── */}
            {showAbschluss && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
                }}>
                    <div style={{
                        background: 'var(--flow-surface)', borderRadius: 8, padding: 24,
                        width: '100%', maxWidth: 520, boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                    }}>
                        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: 'var(--flow-text)' }}>Arbeitspaket abschliessen</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div>
                                <label style={labelStyle}>Zusammenfassung *</label>
                                <textarea value={abschlussText} onChange={(e) => setAbschlussText(e.target.value)}
                                    placeholder="Was wurde erreicht?" rows={4} style={fieldStyle} autoFocus />
                            </div>
                            <div>
                                <label style={labelStyle}>Reflexion (optional)</label>
                                <textarea value={reflexionText} onChange={(e) => setReflexionText(e.target.value)}
                                    placeholder="Was lief gut, was kann verbessert werden?" rows={3} style={fieldStyle} />
                            </div>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                <button className="flow-btn flow-btn--secondary" onClick={() => setShowAbschluss(false)}>Abbrechen</button>
                                <button className="flow-btn flow-btn--primary"
                                    onClick={() => abschliessenMutation.mutate()}
                                    disabled={!abschlussText.trim() || abschliessenMutation.isPending}>
                                    {abschliessenMutation.isPending ? 'Speichern...' : 'Abschliessen'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

function formatAktivitaet(typ: string): string {
    const labels: Record<string, string> = {
        aufgabe_erstellt: 'hat eine Aufgabe erstellt',
        aufgabe_erledigt: 'hat eine Aufgabe als erledigt markiert',
        aufgabe_status_geaendert: 'hat den Aufgabenstatus geaendert',
        aufgabe_geloescht: 'hat eine Aufgabe geloescht',
        tagung_erstellt: 'hat eine Tagung erstellt',
        tagung_dokumentiert: 'hat eine Tagung dokumentiert',
        datei_hochgeladen: 'hat eine Datei hinzugefuegt',
        arbeitspaket_erstellt: 'hat das Arbeitspaket erstellt',
        arbeitspaket_status_geaendert: 'hat den Status geaendert',
        arbeitspaket_abgeschlossen: 'hat das Arbeitspaket abgeschlossen',
        arbeitspaket_wiederaufgenommen: 'hat das Arbeitspaket wiederaufgenommen',
        mitglied_hinzugefuegt: 'hat ein Mitglied hinzugefuegt',
        mitglied_entfernt: 'hat ein Mitglied entfernt',
        rolle_geaendert: 'hat eine Rolle geaendert',
    };
    return labels[typ] || typ;
}
