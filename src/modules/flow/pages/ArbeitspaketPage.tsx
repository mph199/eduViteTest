import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';
import { StatusBadge } from '../components/StatusBadge';
import { FortschrittsBalken } from '../components/FortschrittsBalken';
import { DeadlineAnzeige } from '../components/DeadlineAnzeige';
import type { FlowArbeitspaket, FlowAufgabe, FlowAufgabenStatus } from '../../../types/index';

export function ArbeitspaketPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const { data: paket, isLoading } = useQuery<FlowArbeitspaket>({
        queryKey: ['flow', 'arbeitspakete', id],
        queryFn: () => api.flow.getArbeitspaket(Number(id)),
        enabled: !!id,
    });

    const { data: aufgaben } = useQuery<FlowAufgabe[]>({
        queryKey: ['flow', 'aufgaben', id],
        queryFn: () => api.flow.getAufgaben(Number(id)),
        enabled: !!id,
    });

    const statusMutation = useMutation({
        mutationFn: ({ aufgabeId, status }: { aufgabeId: number; status: FlowAufgabenStatus }) =>
            api.flow.updateAufgabeStatus(aufgabeId, status),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['flow', 'aufgaben', id] });
            queryClient.invalidateQueries({ queryKey: ['flow', 'arbeitspakete', id] });
            queryClient.invalidateQueries({ queryKey: ['flow', 'dashboard'] });
        },
    });

    if (isLoading) {
        return <div className="flow-empty"><div className="flow-empty__text">Laden...</div></div>;
    }

    if (!paket) {
        return <div className="flow-empty"><div className="flow-empty__text">Arbeitspaket nicht gefunden</div></div>;
    }

    return (
        <>
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

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                <h1 className="flow-page-title" style={{ margin: 0 }}>{paket.titel}</h1>
                <StatusBadge status={paket.status} />
            </div>

            {paket.meineRolle && (
                <p className="flow-page-subtitle" style={{ marginBottom: 20 }}>
                    Deine Rolle: {paket.meineRolle}
                    {paket.deadline && <> &bull; <DeadlineAnzeige deadline={paket.deadline} /></>}
                </p>
            )}

            {/* Fortschritt + Tagungen */}
            <div className="flow-stat-strip">
                <div className="flow-stat-card" style={{ '--stat-accent': 'var(--flow-green)' } as React.CSSProperties}>
                    <div className="flow-stat-card__label">Fortschritt</div>
                    <FortschrittsBalken
                        erledigt={paket.fortschritt?.erledigt || 0}
                        gesamt={paket.fortschritt?.gesamt || 0}
                    />
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

            {/* Aufgaben */}
            <div className="flow-panel">
                <div className="flow-panel__header">
                    <span className="flow-panel__title">
                        Aufgaben ({Array.isArray(aufgaben) ? aufgaben.length : 0})
                    </span>
                </div>
                <div className="flow-panel__body--flush">
                    {Array.isArray(aufgaben) && aufgaben.length > 0 ? (
                        aufgaben.map((aufgabe) => (
                            <div key={aufgabe.id} className="flow-task-row">
                                <button
                                    className={`flow-task-row__checkbox ${
                                        aufgabe.status === 'erledigt' ? 'flow-task-row__checkbox--done' :
                                        aufgabe.status === 'in_bearbeitung' ? 'flow-task-row__checkbox--in-progress' : ''
                                    }`}
                                    onClick={() => statusMutation.mutate({
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
                                        <span style={{ fontSize: 11, color: 'var(--flow-text-muted)' }}>
                                            {aufgabe.zustaendigName}
                                        </span>
                                    )}
                                    <DeadlineAnzeige deadline={aufgabe.deadline} erledigt={aufgabe.status === 'erledigt'} />
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="flow-empty"><div className="flow-empty__text">Noch keine Aufgaben</div></div>
                    )}
                </div>
            </div>

            {/* Mitglieder */}
            {Array.isArray(paket.mitglieder) && paket.mitglieder.length > 0 && (
                <div className="flow-panel" style={{ marginTop: 16 }}>
                    <div className="flow-panel__header">
                        <span className="flow-panel__title">Mitglieder ({paket.mitglieder.length})</span>
                    </div>
                    <div className="flow-panel__body--flush">
                        {paket.mitglieder.map((m) => (
                            <div key={m.id} className="flow-task-row">
                                <div className="flow-avatar" style={{ background: 'var(--flow-brand)' }}>
                                    {m.vorname?.[0]}{m.nachname?.[0]}
                                </div>
                                <div style={{ flex: 1 }}>
                                    {m.vorname} {m.nachname}
                                </div>
                                <span className="flow-status-badge flow-status-badge--geplant">
                                    {m.rolle}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </>
    );
}
