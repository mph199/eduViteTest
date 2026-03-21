import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';
import { fieldStyle, labelStyle } from './formStyles';
import type { FlowDatei } from '../../../types/index';

interface DateienTabProps {
    paketId: number;
    id: string;
    dateien: FlowDatei[] | undefined;
    kannSchreiben: boolean;
    istKoordination: boolean;
    onError: (msg: string) => void;
}

export function DateienTab({ paketId, id, dateien, kannSchreiben, istKoordination, onError }: DateienTabProps) {
    const queryClient = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [name, setName] = useState('');
    const [url, setUrl] = useState('');

    const addMutation = useMutation({
        mutationFn: () => api.flow.addDateiMetadaten(paketId, {
            name: name.trim(),
            originalName: name.trim(),
            mimeType: 'application/octet-stream',
            groesse: 0,
            externalUrl: url.trim() || undefined,
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['flow', 'dateien', id] });
            setShowForm(false);
            setName('');
            setUrl('');
        },
        onError: () => onError('Datei konnte nicht hinzugefuegt werden'),
    });

    const deleteMutation = useMutation({
        mutationFn: (dateiId: number) => api.flow.deleteDatei(dateiId),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['flow', 'dateien', id] }),
        onError: () => onError('Datei konnte nicht entfernt werden'),
    });

    return (
        <div className="flow-panel">
            <div className="flow-panel__header">
                <span className="flow-panel__title">Dateien</span>
                {kannSchreiben && (
                    <button className="flow-btn flow-btn--primary flow-btn--sm"
                        onClick={() => setShowForm(!showForm)}>
                        + Datei / Link
                    </button>
                )}
            </div>

            {showForm && (
                <div className="flow-panel__body" style={{ borderBottom: '1px solid var(--flow-border)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div>
                            <label style={labelStyle}>Name *</label>
                            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                                placeholder="z.B. Protokoll Kick-off.pdf" style={fieldStyle} autoFocus />
                        </div>
                        <div>
                            <label style={labelStyle}>Externer Link (optional)</label>
                            <input type="url" value={url} onChange={(e) => setUrl(e.target.value)}
                                placeholder="https://..." style={fieldStyle} maxLength={2048} />
                        </div>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button className="flow-btn flow-btn--secondary flow-btn--sm" onClick={() => setShowForm(false)}>Abbrechen</button>
                            <button className="flow-btn flow-btn--primary flow-btn--sm"
                                onClick={() => addMutation.mutate()}
                                disabled={!name.trim() || addMutation.isPending}>
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
                                    onClick={() => { if (confirm('Datei entfernen?')) deleteMutation.mutate(d.id); }}>
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
    );
}
