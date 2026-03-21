import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';
import { DeadlineAnzeige } from './DeadlineAnzeige';
import { fieldStyle, labelStyle } from './formStyles';
import type {
    FlowAufgabe, FlowAufgabenStatus,
    FlowArbeitspaketMitglied,
} from '../../../types/index';

const CHECKMARK = '\u2713';

interface AufgabenTabProps {
    paketId: number;
    id: string;
    aufgaben: FlowAufgabe[] | undefined;
    mitglieder: FlowArbeitspaketMitglied[] | undefined;
    kannSchreiben: boolean;
    istKoordination: boolean;
    onError: (msg: string) => void;
}

export function AufgabenTab({ paketId, id, aufgaben, mitglieder, kannSchreiben, istKoordination, onError }: AufgabenTabProps) {
    const queryClient = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [titel, setTitel] = useState('');
    const [zustaendig, setZustaendig] = useState<number | null>(null);
    const [deadline, setDeadline] = useState('');

    const invalidateAll = () => {
        queryClient.invalidateQueries({ queryKey: ['flow', 'arbeitspakete', id] });
        queryClient.invalidateQueries({ queryKey: ['flow', 'aufgaben', id] });
        queryClient.invalidateQueries({ queryKey: ['flow', 'dashboard'] });
    };

    const statusMutation = useMutation({
        mutationFn: ({ aufgabeId, status }: { aufgabeId: number; status: FlowAufgabenStatus }) =>
            api.flow.updateAufgabeStatus(aufgabeId, status),
        onSuccess: invalidateAll,
    });

    const createMutation = useMutation({
        mutationFn: () => api.flow.createAufgabe(paketId, {
            titel: titel.trim(),
            zustaendig: zustaendig ?? 0,
            deadline: deadline || null,
        }),
        onSuccess: () => {
            invalidateAll();
            setShowForm(false);
            setTitel('');
            setZustaendig(null);
            setDeadline('');
        },
        onError: () => onError('Fehler beim Erstellen der Aufgabe'),
    });

    const deleteMutation = useMutation({
        mutationFn: (aufgabeId: number) => api.flow.deleteAufgabe(aufgabeId),
        onSuccess: invalidateAll,
        onError: () => onError('Aufgabe konnte nicht geloescht werden'),
    });

    return (
        <div className="flow-panel">
            <div className="flow-panel__header">
                <span className="flow-panel__title">Aufgaben ({Array.isArray(aufgaben) ? aufgaben.length : 0})</span>
                {kannSchreiben && (
                    <button className="flow-btn flow-btn--primary flow-btn--sm"
                        onClick={() => setShowForm(!showForm)}>
                        + Aufgabe
                    </button>
                )}
            </div>

            {showForm && (
                <div className="flow-panel__body" style={{ borderBottom: '1px solid var(--flow-border)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div>
                            <label style={labelStyle}>Titel *</label>
                            <input type="text" value={titel} onChange={(e) => setTitel(e.target.value)}
                                placeholder="Aufgabe beschreiben" style={fieldStyle} autoFocus />
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <div style={{ flex: 1 }}>
                                <label style={labelStyle}>Zustaendig</label>
                                <select value={zustaendig ?? ''} onChange={(e) => setZustaendig(e.target.value ? Number(e.target.value) : null)}
                                    style={fieldStyle}>
                                    <option value="">-- Nicht zugewiesen --</option>
                                    {Array.isArray(mitglieder) && mitglieder.map((m) => (
                                        <option key={m.userId} value={m.userId}>{m.vorname} {m.nachname}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={labelStyle}>Deadline</label>
                                <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} style={fieldStyle} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button className="flow-btn flow-btn--secondary flow-btn--sm" onClick={() => setShowForm(false)}>Abbrechen</button>
                            <button className="flow-btn flow-btn--primary flow-btn--sm"
                                onClick={() => createMutation.mutate()}
                                disabled={!titel.trim() || zustaendig === null || createMutation.isPending}>
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
                                onClick={() => statusMutation.mutate({
                                    aufgabeId: aufgabe.id,
                                    status: aufgabe.status === 'erledigt' ? 'offen' : 'erledigt'
                                })}
                                aria-label={aufgabe.status === 'erledigt' ? 'Als offen markieren' : 'Als erledigt markieren'}
                            >
                                {aufgabe.status === 'erledigt' && CHECKMARK}
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
                                        onClick={() => { if (confirm('Aufgabe loeschen?')) deleteMutation.mutate(aufgabe.id); }}>
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
    );
}
