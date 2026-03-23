import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';
import { ErrorBanner } from '../components/ErrorBanner';
import { fieldStyle, labelStyle } from '../components/formStyles';
import '../flow.css';

export function ArbeitspaketErstellenPage() {
    const { bildungsgangId } = useParams<{ bildungsgangId: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [titel, setTitel] = useState('');
    const [istZustand, setIstZustand] = useState('');
    const [sollZustand, setSollZustand] = useState('');
    const [beteiligteBeschreibung, setBeteiligteBeschreibung] = useState('');
    const [error, setError] = useState('');

    const bgId = Number(bildungsgangId);

    const createMutation = useMutation({
        mutationFn: () =>
            api.flow.createArbeitspaket(bgId, {
                titel: titel.trim(),
                istZustand: istZustand.trim(),
                sollZustand: sollZustand.trim(),
                beteiligteBeschreibung: beteiligteBeschreibung.trim(),
            }),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['flow', 'bildungsgang', String(bgId)] });
            queryClient.invalidateQueries({ queryKey: ['flow', 'dashboard'] });
            navigate(`/teacher/flow/arbeitspaket/${data.id}`);
        },
        onError: () => {
            setError('Fehler beim Erstellen des Arbeitspakets');
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!titel.trim()) {
            setError('Titel ist erforderlich');
            return;
        }
        createMutation.mutate();
    };

    return (
        <>
            <div className="flow-breadcrumb">
                <a onClick={() => navigate('/teacher/flow')}>Dashboard</a>
                <span className="flow-breadcrumb__separator">/</span>
                <a onClick={() => navigate(`/teacher/flow/bildungsgang/${bgId}`)}>Bildungsgang</a>
                <span className="flow-breadcrumb__separator">/</span>
                <span>Neues Arbeitspaket</span>
            </div>

            <h1 className="flow-page-title">Neues Arbeitspaket</h1>
            <p className="flow-page-subtitle">Erstellen Sie ein neues Arbeitspaket für diesen Bildungsgang</p>

            <ErrorBanner error={error} onDismiss={() => setError('')} style={{ marginBottom: 14 }} />

            <div className="flow-panel" style={{ maxWidth: 680 }}>
                <div className="flow-panel__body">
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div>
                            <label style={labelStyle}>Titel *</label>
                            <input
                                type="text"
                                value={titel}
                                onChange={(e) => setTitel(e.target.value)}
                                placeholder="z.B. Lehrplanrevision Informatik"
                                style={fieldStyle}
                                autoFocus
                            />
                        </div>

                        <div>
                            <label style={labelStyle}>Ist-Zustand</label>
                            <textarea
                                value={istZustand}
                                onChange={(e) => setIstZustand(e.target.value)}
                                placeholder="Beschreiben Sie die aktuelle Situation..."
                                rows={3}
                                style={fieldStyle}
                            />
                        </div>

                        <div>
                            <label style={labelStyle}>Soll-Zustand</label>
                            <textarea
                                value={sollZustand}
                                onChange={(e) => setSollZustand(e.target.value)}
                                placeholder="Beschreiben Sie das angestrebte Ergebnis..."
                                rows={3}
                                style={fieldStyle}
                            />
                        </div>

                        <div>
                            <label style={labelStyle}>Beteiligte</label>
                            <textarea
                                value={beteiligteBeschreibung}
                                onChange={(e) => setBeteiligteBeschreibung(e.target.value)}
                                placeholder="Wer ist an diesem Arbeitspaket beteiligt?"
                                rows={2}
                                style={fieldStyle}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                            <button
                                type="button"
                                className="flow-btn"
                                onClick={() => navigate(`/teacher/flow/bildungsgang/${bgId}`)}
                            >
                                Abbrechen
                            </button>
                            <button
                                type="submit"
                                className="flow-btn flow-btn--primary"
                                disabled={createMutation.isPending || !titel.trim()}
                            >
                                {createMutation.isPending ? 'Erstellen...' : 'Arbeitspaket erstellen'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
}
