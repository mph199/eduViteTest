import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';
import { StatusBadge } from '../components/StatusBadge';
import { FortschrittsBalken } from '../components/FortschrittsBalken';
import { DeadlineAnzeige } from '../components/DeadlineAnzeige';
import { ErrorBanner } from '../components/ErrorBanner';
import { AufgabenTab } from '../components/AufgabenTab';
import { TagungenTab } from '../components/TagungenTab';
import { MitgliederTab } from '../components/MitgliederTab';
import { DateienTab } from '../components/DateienTab';
import { AktivitaetenTab } from '../components/AktivitaetenTab';
import { fieldStyle, labelStyle } from '../components/formStyles';
import type {
    FlowArbeitspaket, FlowAufgabe,
    FlowArbeitspaketMitglied,
    FlowTagungSummary, FlowDatei, FlowAktivitaet,
} from '../../../types/index';

type Tab = 'aufgaben' | 'tagungen' | 'mitglieder' | 'dateien' | 'aktivitaeten';

const STATUS_UEBERGAENGE: Record<string, string[]> = {
    entwurf: ['geplant'],
    geplant: ['aktiv', 'entwurf'],
    aktiv: [],
    abgeschlossen: [],
};

export function ArbeitspaketPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const paketId = Number(id);

    const [activeTab, setActiveTab] = useState<Tab>('aufgaben');
    const [showAbschluss, setShowAbschluss] = useState(false);
    const [abschlussText, setAbschlussText] = useState('');
    const [reflexionText, setReflexionText] = useState('');
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

    // ── Mutations (page-level only) ───────────────────────────────────
    const invalidateAll = () => {
        queryClient.invalidateQueries({ queryKey: ['flow', 'arbeitspakete', id] });
        queryClient.invalidateQueries({ queryKey: ['flow', 'aufgaben', id] });
        queryClient.invalidateQueries({ queryKey: ['flow', 'dashboard'] });
    };

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

            <ErrorBanner error={error} onDismiss={() => setError('')} />

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

            {activeTab === 'aufgaben' && (
                <AufgabenTab paketId={paketId} id={id!} aufgaben={aufgaben} mitglieder={paket.mitglieder}
                    kannSchreiben={kannSchreiben} istKoordination={istKoordination} onError={setError} />
            )}
            {activeTab === 'tagungen' && (
                <TagungenTab paketId={paketId} id={id!} tagungen={tagungen}
                    istKoordination={istKoordination} onError={setError} />
            )}
            {activeTab === 'mitglieder' && (
                <MitgliederTab paketId={paketId} id={id!} mitglieder={mitglieder} paketMitglieder={paket.mitglieder}
                    istKoordination={istKoordination} onError={setError} />
            )}
            {activeTab === 'dateien' && (
                <DateienTab paketId={paketId} id={id!} dateien={dateien}
                    kannSchreiben={kannSchreiben} istKoordination={istKoordination} onError={setError} />
            )}
            {activeTab === 'aktivitaeten' && (
                <AktivitaetenTab aktivitaeten={aktivitaeten} />
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
