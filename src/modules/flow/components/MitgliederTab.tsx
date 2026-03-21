import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';
import { fieldStyle, labelStyle } from './formStyles';
import type { FlowArbeitspaketMitglied, FlowArbeitspaketRolle } from '../../../types/index';

interface MitgliederTabProps {
    paketId: number;
    id: string;
    mitglieder: FlowArbeitspaketMitglied[] | undefined;
    paketMitglieder: FlowArbeitspaketMitglied[] | undefined;
    istKoordination: boolean;
    onError: (msg: string) => void;
}

export function MitgliederTab({ paketId, id, mitglieder, paketMitglieder, istKoordination, onError }: MitgliederTabProps) {
    const queryClient = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [neuesMitgliedId, setNeuesMitgliedId] = useState('');
    const [neuesMitgliedRolle, setNeuesMitgliedRolle] = useState<FlowArbeitspaketRolle>('mitwirkende');

    const invalidateAll = () => {
        queryClient.invalidateQueries({ queryKey: ['flow', 'arbeitspakete', id] });
        queryClient.invalidateQueries({ queryKey: ['flow', 'aufgaben', id] });
        queryClient.invalidateQueries({ queryKey: ['flow', 'dashboard'] });
    };

    const addMutation = useMutation({
        mutationFn: () => api.flow.addMitglied(paketId, Number(neuesMitgliedId), neuesMitgliedRolle),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['flow', 'mitglieder', id] });
            invalidateAll();
            setShowForm(false);
            setNeuesMitgliedId('');
        },
        onError: () => onError('Mitglied konnte nicht hinzugefuegt werden'),
    });

    const updateRolleMutation = useMutation({
        mutationFn: ({ userId, rolle }: { userId: number; rolle: string }) =>
            api.flow.updateMitgliedRolle(paketId, userId, rolle),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['flow', 'mitglieder', id] }),
        onError: () => onError('Rolle konnte nicht geaendert werden'),
    });

    const removeMutation = useMutation({
        mutationFn: (userId: number) => api.flow.removeMitglied(paketId, userId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['flow', 'mitglieder', id] });
            invalidateAll();
        },
        onError: () => onError('Mitglied konnte nicht entfernt werden'),
    });

    const displayList = Array.isArray(mitglieder) ? mitglieder : paketMitglieder || [];

    return (
        <div className="flow-panel">
            <div className="flow-panel__header">
                <span className="flow-panel__title">Mitglieder ({displayList.length})</span>
                {istKoordination && (
                    <button className="flow-btn flow-btn--primary flow-btn--sm"
                        onClick={() => setShowForm(!showForm)}>
                        + Mitglied
                    </button>
                )}
            </div>

            {showForm && (
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
                            onClick={() => addMutation.mutate()}
                            disabled={!neuesMitgliedId || addMutation.isPending}>
                            Hinzufuegen
                        </button>
                    </div>
                </div>
            )}

            <div className="flow-panel__body--flush">
                {displayList.map((m) => (
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
                                onClick={() => { if (confirm(`${m.vorname} ${m.nachname} entfernen?`)) removeMutation.mutate(m.userId); }}>
                                Entfernen
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
