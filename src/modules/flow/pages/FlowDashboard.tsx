import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../../../services/api';
import { StatusBadge } from '../components/StatusBadge';
import { FortschrittsBalken } from '../components/FortschrittsBalken';
import { DeadlineAnzeige } from '../components/DeadlineAnzeige';
import type { FlowDashboard as FlowDashboardType } from '../../../types/index';

export function FlowDashboard() {
    const navigate = useNavigate();

    const { data: dashboard, isLoading } = useQuery<FlowDashboardType>({
        queryKey: ['flow', 'dashboard'],
        queryFn: () => api.flow.getDashboard(),
    });

    if (isLoading) {
        return <div className="flow-empty"><div className="flow-empty__text">Laden...</div></div>;
    }

    if (!dashboard) {
        return <div className="flow-empty"><div className="flow-empty__text">Dashboard konnte nicht geladen werden.</div></div>;
    }

    return (
        <>
            <h1 className="flow-page-title">Dashboard</h1>
            <p className="flow-page-subtitle">Persönliche Übersicht</p>

            <div className="flow-stat-strip">
                <div className="flow-stat-card" style={{ '--stat-accent': 'var(--flow-brand)' } as React.CSSProperties}>
                    <div className="flow-stat-card__label">Offene Aufgaben</div>
                    <div className="flow-stat-card__value">{dashboard.statistik.offen}</div>
                </div>
                <div className="flow-stat-card" style={{ '--stat-accent': 'var(--flow-red)' } as React.CSSProperties}>
                    <div className="flow-stat-card__label">Überfällig</div>
                    <div className="flow-stat-card__value">{dashboard.statistik.ueberfaellig}</div>
                </div>
                <div className="flow-stat-card" style={{ '--stat-accent': 'var(--flow-green)' } as React.CSSProperties}>
                    <div className="flow-stat-card__label">Erledigt (Monat)</div>
                    <div className="flow-stat-card__value">{dashboard.statistik.erledigtDiesenMonat}</div>
                </div>
            </div>

            {/* Aktive Arbeitspakete */}
            <div className="flow-panel" style={{ marginBottom: 16 }}>
                <div className="flow-panel__header">
                    <span className="flow-panel__title">Aktive Arbeitspakete</span>
                </div>
                <div className="flow-panel__body--flush">
                    {Array.isArray(dashboard.aktiveArbeitspakete) && dashboard.aktiveArbeitspakete.length > 0 ? (
                        dashboard.aktiveArbeitspakete.map((ap) => (
                            <div
                                key={ap.id}
                                className="flow-task-row"
                                style={{ cursor: 'pointer' }}
                                onClick={() => navigate(`/teacher/flow/arbeitspaket/${ap.id}`)}
                            >
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div className="flow-paket-card__title">{ap.titel}</div>
                                    <div style={{ fontSize: 11, color: 'var(--flow-text-muted)', marginTop: 2 }}>
                                        {ap.bildungsgangName}
                                    </div>
                                </div>
                                <StatusBadge status={ap.status} />
                                <FortschrittsBalken erledigt={ap.fortschritt.erledigt} gesamt={ap.fortschritt.gesamt} />
                                <DeadlineAnzeige deadline={ap.deadline} />
                            </div>
                        ))
                    ) : (
                        <div className="flow-empty"><div className="flow-empty__text">Keine aktiven Arbeitspakete</div></div>
                    )}
                </div>
            </div>

            {/* Meine Aufgaben */}
            <div className="flow-panel" style={{ marginBottom: 16 }}>
                <div className="flow-panel__header">
                    <span className="flow-panel__title">Meine Aufgaben</span>
                    <button
                        className="flow-btn flow-btn--secondary flow-btn--sm"
                        onClick={() => navigate('/teacher/flow/aufgaben')}
                    >
                        Alle anzeigen
                    </button>
                </div>
                <div className="flow-panel__body--flush">
                    {Array.isArray(dashboard.meineAufgaben) && dashboard.meineAufgaben.length > 0 ? (
                        dashboard.meineAufgaben.map((aufgabe) => (
                            <div key={aufgabe.id} className="flow-task-row">
                                <div className="flow-task-row__title">{aufgabe.titel}</div>
                                <div className="flow-task-row__meta">
                                    <DeadlineAnzeige deadline={aufgabe.deadline} />
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="flow-empty"><div className="flow-empty__text">Keine offenen Aufgaben</div></div>
                    )}
                </div>
            </div>

            {/* Naechste Tagungen */}
            <div className="flow-panel">
                <div className="flow-panel__header">
                    <span className="flow-panel__title">Naechste Tagungen</span>
                </div>
                <div className="flow-panel__body--flush">
                    {Array.isArray(dashboard.naechsteTagungen) && dashboard.naechsteTagungen.length > 0 ? (
                        dashboard.naechsteTagungen.map((tagung) => (
                            <div key={tagung.id} className="flow-task-row" style={{ cursor: 'pointer' }}
                                onClick={() => navigate(`/teacher/flow/tagung/${tagung.id}`)}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--flow-text)' }}>{tagung.titel}</div>
                                    <div style={{ fontSize: 11, color: 'var(--flow-text-muted)', marginTop: 2 }}>
                                        {tagung.arbeitspaketTitel}
                                        {tagung.raum && ` \u2022 ${tagung.raum}`}
                                    </div>
                                </div>
                                <span className="flow-deadline flow-deadline--ok" style={{ fontFamily: 'var(--flow-font-mono)' }}>
                                    {new Date(tagung.startAt).toLocaleDateString('de-DE', {
                                        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                                    })}
                                </span>
                            </div>
                        ))
                    ) : (
                        <div className="flow-empty"><div className="flow-empty__text">Keine anstehenden Tagungen</div></div>
                    )}
                </div>
            </div>
        </>
    );
}
