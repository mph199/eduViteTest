import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';
import { DeadlineAnzeige } from '../components/DeadlineAnzeige';
import type { FlowAufgabe, FlowAufgabenStatus } from '../../../types/index';

export function MeineAufgabenPage() {
    const queryClient = useQueryClient();
    const [statusFilter, setStatusFilter] = useState<string>('');

    const { data: aufgaben, isLoading } = useQuery<FlowAufgabe[]>({
        queryKey: ['flow', 'aufgaben', 'meine', statusFilter],
        queryFn: () => api.flow.getMeineAufgaben(statusFilter ? { status: statusFilter } : undefined),
    });

    const statusMutation = useMutation({
        mutationFn: ({ id, status }: { id: number; status: FlowAufgabenStatus }) =>
            api.flow.updateAufgabeStatus(id, status),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['flow', 'aufgaben', 'meine'] });
            queryClient.invalidateQueries({ queryKey: ['flow', 'dashboard'] });
        },
    });

    const toggleStatus = (aufgabe: FlowAufgabe) => {
        const neuerStatus: FlowAufgabenStatus = aufgabe.status === 'erledigt' ? 'offen' : 'erledigt';
        statusMutation.mutate({ id: aufgabe.id, status: neuerStatus });
    };

    return (
        <>
            <h1 className="flow-page-title">Meine Aufgaben</h1>
            <p className="flow-page-subtitle">Alle dir zugewiesenen Aufgaben</p>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {[
                    { value: '', label: 'Alle' },
                    { value: 'offen', label: 'Offen' },
                    { value: 'in_bearbeitung', label: 'In Bearbeitung' },
                    { value: 'erledigt', label: 'Erledigt' },
                ].map(f => (
                    <button
                        key={f.value}
                        className={`flow-btn flow-btn--sm ${statusFilter === f.value ? 'flow-btn--primary' : 'flow-btn--secondary'}`}
                        onClick={() => setStatusFilter(f.value)}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            <div className="flow-panel">
                <div className="flow-panel__body--flush">
                    {isLoading ? (
                        <div className="flow-empty"><div className="flow-empty__text">Laden...</div></div>
                    ) : Array.isArray(aufgaben) && aufgaben.length > 0 ? (
                        aufgaben.map((aufgabe) => (
                            <div key={aufgabe.id} className="flow-task-row">
                                <button
                                    className={`flow-task-row__checkbox ${
                                        aufgabe.status === 'erledigt' ? 'flow-task-row__checkbox--done' :
                                        aufgabe.status === 'in_bearbeitung' ? 'flow-task-row__checkbox--in-progress' : ''
                                    }`}
                                    onClick={() => toggleStatus(aufgabe)}
                                    aria-label={aufgabe.status === 'erledigt' ? 'Als offen markieren' : 'Als erledigt markieren'}
                                >
                                    {aufgabe.status === 'erledigt' && '\u2713'}
                                </button>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div className={`flow-task-row__title ${aufgabe.status === 'erledigt' ? 'flow-task-row__title--done' : ''}`}>
                                        {aufgabe.titel}
                                    </div>
                                    {aufgabe.arbeitspaketTitel && (
                                        <div style={{ fontSize: 11, color: 'var(--flow-text-muted)', marginTop: 2 }}>
                                            {aufgabe.arbeitspaketTitel}
                                        </div>
                                    )}
                                </div>
                                <div className="flow-task-row__meta">
                                    <DeadlineAnzeige
                                        deadline={aufgabe.deadline}
                                        erledigt={aufgabe.status === 'erledigt'}
                                    />
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="flow-empty"><div className="flow-empty__text">Keine Aufgaben gefunden</div></div>
                    )}
                </div>
            </div>
        </>
    );
}
