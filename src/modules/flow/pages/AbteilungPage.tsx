import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../../../services/api';
import { useAuth } from '../../../contexts/useAuth';
import { StatusBadge } from '../components/StatusBadge';
import { DeadlineAnzeige } from '../components/DeadlineAnzeige';
import type { FlowAbteilungsPaket } from '../../../types/index';

export function AbteilungPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { data: pakete, isLoading, isError } = useQuery<FlowAbteilungsPaket[]>({
        queryKey: ['flow', 'abteilung'],
        queryFn: () => api.flow.getAbteilungsPakete(),
        enabled: user?.role === 'admin' || user?.role === 'superadmin',
    });

    const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
    if (!isAdmin) {
        return (
            <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 32px' }}>
                <div className="flow-empty"><div className="flow-empty__text">Zugriff nur für Administratoren</div></div>
            </div>
        );
    }

    if (isLoading) {
        return <div className="flow-empty"><div className="flow-empty__text">Laden...</div></div>;
    }

    if (isError) {
        return <div className="flow-empty"><div className="flow-empty__text">Fehler beim Laden der Abteilungsdaten</div></div>;
    }

    return (
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 32px' }}>
            <h1 className="flow-page-title">Abteilungsübersicht</h1>
            <p className="flow-page-subtitle">Aggregierte Sicht auf alle Arbeitspakete</p>

            <div className="flow-panel">
                <div className="flow-panel__body--flush">
                    {Array.isArray(pakete) && pakete.length > 0 ? (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--flow-border)', textAlign: 'left' }}>
                                    <th style={{ padding: '10px 18px', fontWeight: 600, color: 'var(--flow-text)' }}>Titel</th>
                                    <th style={{ padding: '10px 18px', fontWeight: 600, color: 'var(--flow-text)' }}>Bildungsgang</th>
                                    <th style={{ padding: '10px 18px', fontWeight: 600, color: 'var(--flow-text)' }}>Status</th>
                                    <th style={{ padding: '10px 18px', fontWeight: 600, color: 'var(--flow-text)' }}>Deadline</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pakete.map((p) => (
                                    <tr key={p.id}
                                        style={{ borderBottom: '1px solid var(--flow-border)', cursor: 'pointer' }}
                                        onClick={() => navigate(`/teacher/flow/arbeitspaket/${p.id}`)}
                                    >
                                        <td style={{ padding: '10px 18px', color: 'var(--flow-brand)', fontWeight: 500 }}>{p.titel}</td>
                                        <td style={{ padding: '10px 18px', color: 'var(--flow-text-muted)' }}>{p.bildungsgang}</td>
                                        <td style={{ padding: '10px 18px' }}><StatusBadge status={p.status} /></td>
                                        <td style={{ padding: '10px 18px' }}><DeadlineAnzeige deadline={p.deadline} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="flow-empty"><div className="flow-empty__text">Keine Arbeitspakete vorhanden</div></div>
                    )}
                </div>
            </div>
        </div>
    );
}
