import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';
import { useAuth } from '../../../contexts/useAuth';
import type { FlowBildungsgangRolle } from '../../../types/index';
import '../flow.css';

interface BGListItem {
    id: number;
    name: string;
    erlaubt_mitgliedern_paket_erstellung: boolean;
    mitglieder_count: string;
    arbeitspakete_count: string;
}

interface BGMitglied {
    id: number;
    user_id: number;
    vorname: string;
    nachname: string;
    rolle: FlowBildungsgangRolle;
    hinzugefuegt_am: string;
}

interface FlowUser {
    id: number;
    username: string;
    vorname: string | null;
    nachname: string | null;
    role: string;
}

export function AdminBGLVerwaltung() {
    const { user } = useAuth();
    const qc = useQueryClient();
    const [selectedBgId, setSelectedBgId] = useState<number | null>(null);
    const [neuerName, setNeuerName] = useState('');
    const [neuerUserRolle, setNeuerUserRolle] = useState<FlowBildungsgangRolle>('mitglied');
    const [neuerUserId, setNeuerUserId] = useState<number | ''>('');

    const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
    if (!isAdmin) {
        return (
            <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 32px' }}>
                <div className="flow-empty"><div className="flow-empty__text">Zugriff nur fuer Administratoren</div></div>
            </div>
        );
    }

    // ── Queries ──
    const { data: bildungsgaenge = [], isLoading: bgLoading } = useQuery<BGListItem[]>({
        queryKey: ['flow', 'admin', 'bildungsgaenge'],
        queryFn: () => api.flow.adminGetBildungsgaenge(),
    });

    const { data: mitglieder = [], isLoading: mitgliederLoading } = useQuery<BGMitglied[]>({
        queryKey: ['flow', 'admin', 'bildungsgaenge', selectedBgId, 'mitglieder'],
        queryFn: () => api.flow.adminGetBildungsgangMitglieder(selectedBgId!),
        enabled: selectedBgId !== null,
    });

    const { data: users = [] } = useQuery<FlowUser[]>({
        queryKey: ['flow', 'admin', 'users'],
        queryFn: () => api.flow.adminGetUsers(),
    });

    // ── Mutations ──
    const createBg = useMutation({
        mutationFn: (name: string) => api.flow.adminCreateBildungsgang({ name }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['flow', 'admin', 'bildungsgaenge'] });
            setNeuerName('');
        },
    });

    const addMitglied = useMutation({
        mutationFn: ({ userId, rolle }: { userId: number; rolle: string }) =>
            api.flow.adminAddBildungsgangMitglied(selectedBgId!, userId, rolle),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['flow', 'admin', 'bildungsgaenge', selectedBgId, 'mitglieder'] });
            qc.invalidateQueries({ queryKey: ['flow', 'admin', 'bildungsgaenge'] });
            setNeuerUserId('');
        },
    });

    const updateRolle = useMutation({
        mutationFn: ({ userId, rolle }: { userId: number; rolle: string }) =>
            api.flow.adminUpdateBildungsgangMitgliedRolle(selectedBgId!, userId, rolle),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['flow', 'admin', 'bildungsgaenge', selectedBgId, 'mitglieder'] });
        },
    });

    const removeMitglied = useMutation({
        mutationFn: (userId: number) => api.flow.adminRemoveBildungsgangMitglied(selectedBgId!, userId),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['flow', 'admin', 'bildungsgaenge', selectedBgId, 'mitglieder'] });
            qc.invalidateQueries({ queryKey: ['flow', 'admin', 'bildungsgaenge'] });
        },
    });

    const selectedBg = bildungsgaenge.find((bg) => bg.id === selectedBgId);

    // User die noch nicht Mitglied sind
    const verfuegbareUsers = users.filter(
        (u) => !mitglieder.some((m) => m.user_id === u.id)
    );

    const userName = (u: FlowUser) =>
        u.vorname && u.nachname ? `${u.nachname}, ${u.vorname}` : u.username;

    return (
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 32px' }}>
            <h1 className="flow-page-title">Bildungsgang-Verwaltung</h1>
            <p className="flow-page-subtitle">Bildungsgaenge anlegen und Leitungen zuweisen</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 20 }}>
                {/* ── Linke Spalte: Bildungsgaenge ── */}
                <div className="flow-panel">
                    <div className="flow-panel__header">
                        <h2 className="flow-panel__title">Bildungsgaenge</h2>
                    </div>
                    <div className="flow-panel__body--flush">
                        {bgLoading ? (
                            <div className="flow-empty"><div className="flow-empty__text">Laden...</div></div>
                        ) : bildungsgaenge.length === 0 ? (
                            <div className="flow-empty"><div className="flow-empty__text">Noch keine Bildungsgaenge angelegt</div></div>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--flow-border)', textAlign: 'left' }}>
                                        <th style={{ padding: '10px 18px', fontWeight: 600, color: 'var(--flow-text)' }}>Name</th>
                                        <th style={{ padding: '10px 18px', fontWeight: 600, color: 'var(--flow-text)', textAlign: 'center' }}>Mitglieder</th>
                                        <th style={{ padding: '10px 18px', fontWeight: 600, color: 'var(--flow-text)', textAlign: 'center' }}>Pakete</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {bildungsgaenge.map((bg) => (
                                        <tr
                                            key={bg.id}
                                            onClick={() => setSelectedBgId(bg.id)}
                                            style={{
                                                borderBottom: '1px solid var(--flow-border)',
                                                cursor: 'pointer',
                                                background: bg.id === selectedBgId ? 'var(--flow-bg-hover)' : undefined,
                                            }}
                                        >
                                            <td style={{ padding: '10px 18px' }}>{bg.name}</td>
                                            <td style={{ padding: '10px 18px', textAlign: 'center', color: 'var(--flow-text-muted)' }}>{bg.mitglieder_count}</td>
                                            <td style={{ padding: '10px 18px', textAlign: 'center', color: 'var(--flow-text-muted)' }}>{bg.arbeitspakete_count}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}

                        {/* Neuen Bildungsgang anlegen */}
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                if (neuerName.trim()) createBg.mutate(neuerName.trim());
                            }}
                            style={{ display: 'flex', gap: 8, padding: '12px 18px', borderTop: '1px solid var(--flow-border)' }}
                        >
                            <input
                                type="text"
                                value={neuerName}
                                onChange={(e) => setNeuerName(e.target.value)}
                                placeholder="Neuer Bildungsgang..."
                                style={{
                                    flex: 1, padding: '6px 10px', fontSize: 13,
                                    border: '1px solid var(--flow-border)', borderRadius: 6,
                                    background: 'var(--flow-bg)', color: 'var(--flow-text)',
                                }}
                            />
                            <button
                                type="submit"
                                disabled={!neuerName.trim() || createBg.isPending}
                                className="flow-btn flow-btn--primary"
                                style={{ fontSize: 13 }}
                            >
                                Anlegen
                            </button>
                        </form>
                    </div>
                </div>

                {/* ── Rechte Spalte: Mitglieder ── */}
                <div className="flow-panel">
                    <div className="flow-panel__header">
                        <h2 className="flow-panel__title">
                            {selectedBg ? `Mitglieder: ${selectedBg.name}` : 'Mitglieder'}
                        </h2>
                    </div>
                    <div className="flow-panel__body--flush">
                        {!selectedBgId ? (
                            <div className="flow-empty"><div className="flow-empty__text">Bildungsgang auswaehlen</div></div>
                        ) : mitgliederLoading ? (
                            <div className="flow-empty"><div className="flow-empty__text">Laden...</div></div>
                        ) : mitglieder.length === 0 ? (
                            <div className="flow-empty"><div className="flow-empty__text">Noch keine Mitglieder zugewiesen</div></div>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--flow-border)', textAlign: 'left' }}>
                                        <th style={{ padding: '10px 18px', fontWeight: 600, color: 'var(--flow-text)' }}>Name</th>
                                        <th style={{ padding: '10px 18px', fontWeight: 600, color: 'var(--flow-text)' }}>Rolle</th>
                                        <th style={{ padding: '10px 18px', fontWeight: 600, color: 'var(--flow-text)' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {mitglieder.map((m) => (
                                        <tr key={m.id} style={{ borderBottom: '1px solid var(--flow-border)' }}>
                                            <td style={{ padding: '10px 18px' }}>
                                                {m.nachname}, {m.vorname}
                                            </td>
                                            <td style={{ padding: '10px 18px' }}>
                                                <select
                                                    value={m.rolle}
                                                    onChange={(e) =>
                                                        updateRolle.mutate({ userId: m.user_id, rolle: e.target.value })
                                                    }
                                                    style={{
                                                        padding: '4px 8px', fontSize: 12,
                                                        border: '1px solid var(--flow-border)', borderRadius: 4,
                                                        background: 'var(--flow-bg)', color: 'var(--flow-text)',
                                                    }}
                                                >
                                                    <option value="leitung">Leitung</option>
                                                    <option value="mitglied">Mitglied</option>
                                                </select>
                                            </td>
                                            <td style={{ padding: '10px 18px', textAlign: 'right' }}>
                                                <button
                                                    onClick={() => removeMitglied.mutate(m.user_id)}
                                                    className="flow-btn flow-btn--danger"
                                                    style={{ fontSize: 12, padding: '4px 10px' }}
                                                >
                                                    Entfernen
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}

                        {/* Mitglied hinzufuegen */}
                        {selectedBgId && (
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    if (neuerUserId !== '') {
                                        addMitglied.mutate({ userId: Number(neuerUserId), rolle: neuerUserRolle });
                                    }
                                }}
                                style={{
                                    display: 'flex', gap: 8, padding: '12px 18px',
                                    borderTop: '1px solid var(--flow-border)', alignItems: 'center',
                                }}
                            >
                                <select
                                    value={neuerUserId}
                                    onChange={(e) => setNeuerUserId(e.target.value ? Number(e.target.value) : '')}
                                    style={{
                                        flex: 1, padding: '6px 10px', fontSize: 13,
                                        border: '1px solid var(--flow-border)', borderRadius: 6,
                                        background: 'var(--flow-bg)', color: 'var(--flow-text)',
                                    }}
                                >
                                    <option value="">User auswaehlen...</option>
                                    {verfuegbareUsers.map((u) => (
                                        <option key={u.id} value={u.id}>{userName(u)}</option>
                                    ))}
                                </select>
                                <select
                                    value={neuerUserRolle}
                                    onChange={(e) => setNeuerUserRolle(e.target.value as FlowBildungsgangRolle)}
                                    style={{
                                        padding: '6px 10px', fontSize: 13,
                                        border: '1px solid var(--flow-border)', borderRadius: 6,
                                        background: 'var(--flow-bg)', color: 'var(--flow-text)',
                                    }}
                                >
                                    <option value="leitung">Leitung</option>
                                    <option value="mitglied">Mitglied</option>
                                </select>
                                <button
                                    type="submit"
                                    disabled={neuerUserId === '' || addMitglied.isPending}
                                    className="flow-btn flow-btn--primary"
                                    style={{ fontSize: 13 }}
                                >
                                    Hinzufuegen
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

