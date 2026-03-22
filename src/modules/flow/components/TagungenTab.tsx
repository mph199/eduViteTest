import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';
import { fieldStyle, labelStyle } from './formStyles';
import type { FlowTagungSummary } from '../../../types/index';

interface TagungenTabProps {
    paketId: number;
    id: string;
    tagungen: FlowTagungSummary[] | undefined;
    istKoordination: boolean;
    onError: (msg: string) => void;
}

export function TagungenTab({ paketId, id, tagungen, istKoordination, onError }: TagungenTabProps) {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [titel, setTitel] = useState('');
    const [start, setStart] = useState('');
    const [raum, setRaum] = useState('');

    const createMutation = useMutation({
        mutationFn: () => api.flow.createTagung(paketId, {
            titel: titel.trim(),
            startAt: start,
            raum: raum.trim() || null,
            teilnehmende: [],
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['flow', 'tagungen', id] });
            queryClient.invalidateQueries({ queryKey: ['flow', 'arbeitspakete', id] });
            queryClient.invalidateQueries({ queryKey: ['flow', 'dashboard'] });
            setShowForm(false);
            setTitel('');
            setStart('');
            setRaum('');
        },
        onError: () => onError('Tagung konnte nicht erstellt werden'),
    });

    return (
        <div className="flow-panel">
            <div className="flow-panel__header">
                <span className="flow-panel__title">Tagungen</span>
                {istKoordination && (
                    <button className="flow-btn flow-btn--primary flow-btn--sm"
                        onClick={() => setShowForm(!showForm)}>
                        + Tagung
                    </button>
                )}
            </div>

            {showForm && (
                <div className="flow-panel__body" style={{ borderBottom: '1px solid var(--flow-border)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div>
                            <label style={labelStyle}>Titel *</label>
                            <input type="text" value={titel} onChange={(e) => setTitel(e.target.value)}
                                placeholder="z.B. Kick-off Lehrplanrevision" style={fieldStyle} autoFocus />
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <div style={{ flex: 1 }}>
                                <label style={labelStyle}>Start *</label>
                                <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} style={fieldStyle} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={labelStyle}>Raum</label>
                                <input type="text" value={raum} onChange={(e) => setRaum(e.target.value)}
                                    placeholder="z.B. A203" style={fieldStyle} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button className="flow-btn flow-btn--secondary flow-btn--sm" onClick={() => setShowForm(false)}>Abbrechen</button>
                            <button className="flow-btn flow-btn--primary flow-btn--sm"
                                onClick={() => createMutation.mutate()}
                                disabled={!titel.trim() || !start || createMutation.isPending}>
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
    );
}
