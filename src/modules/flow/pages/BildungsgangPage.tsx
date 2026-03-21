import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../../../services/api';
import { StatusBadge } from '../components/StatusBadge';
import { FortschrittsBalken } from '../components/FortschrittsBalken';
import { DeadlineAnzeige } from '../components/DeadlineAnzeige';
import type { FlowBildungsgang } from '../../../types/index';

export function BildungsgangPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const { data: bg, isLoading } = useQuery<FlowBildungsgang & { arbeitspakete: Array<{ id: number; titel: string; status: string; deadline: string | null; fortschritt: { erledigt: number; gesamt: number } }> }>({
        queryKey: ['flow', 'bildungsgang', id],
        queryFn: () => api.flow.getBildungsgang(Number(id)),
        enabled: !!id,
    });

    if (isLoading) {
        return <div className="flow-empty"><div className="flow-empty__text">Laden...</div></div>;
    }

    if (!bg) {
        return <div className="flow-empty"><div className="flow-empty__text">Bildungsgang nicht gefunden</div></div>;
    }

    const mitglieder = Array.isArray(bg.mitglieder) ? bg.mitglieder : [];

    return (
        <>
            <div className="flow-breadcrumb">
                <a onClick={() => navigate('/teacher/flow')}>Dashboard</a>
                <span className="flow-breadcrumb__separator">/</span>
                <span>{bg.name}</span>
            </div>

            <h1 className="flow-page-title">{bg.name}</h1>
            <p className="flow-page-subtitle">{mitglieder.length} Mitglieder</p>

            {/* Mitglieder-Anzeige */}
            {mitglieder.length > 0 && (
                <div className="flow-panel" style={{ marginBottom: 16 }}>
                    <div className="flow-panel__header">
                        <span className="flow-panel__title">Mitglieder ({mitglieder.length})</span>
                    </div>
                    <div className="flow-panel__body--flush">
                        {mitglieder.map((m) => (
                            <div key={m.id} className="flow-task-row">
                                <div className="flow-avatar" style={{ background: 'var(--flow-brand)' }}>
                                    {m.vorname?.[0]}{m.nachname?.[0]}
                                </div>
                                <div style={{ flex: 1 }}>{m.vorname} {m.nachname}</div>
                                <span className="flow-status-badge flow-status-badge--geplant">{m.rolle}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Arbeitspakete */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--flow-text)', margin: 0 }}>
                    Arbeitspakete
                </h2>
                <button
                    className="flow-btn flow-btn--primary flow-btn--sm"
                    onClick={() => navigate(`/teacher/flow/arbeitspaket/neu/${id}`)}
                >
                    + Neues Arbeitspaket
                </button>
            </div>

            {Array.isArray(bg.arbeitspakete) && bg.arbeitspakete.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {bg.arbeitspakete.map((ap) => (
                        <div
                            key={ap.id}
                            className="flow-paket-card"
                            onClick={() => navigate(`/teacher/flow/arbeitspaket/${ap.id}`)}
                        >
                            <div className="flow-paket-card__header">
                                <span className="flow-paket-card__title">{ap.titel}</span>
                                <StatusBadge status={ap.status as 'entwurf' | 'geplant' | 'aktiv' | 'abgeschlossen'} />
                            </div>
                            <div className="flow-paket-card__footer">
                                <FortschrittsBalken erledigt={ap.fortschritt.erledigt} gesamt={ap.fortschritt.gesamt} />
                                <DeadlineAnzeige deadline={ap.deadline} />
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flow-empty">
                    <div className="flow-empty__text">Noch keine Arbeitspakete angelegt</div>
                </div>
            )}
        </>
    );
}
