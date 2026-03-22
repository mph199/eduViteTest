import type { FlowAktivitaet } from '../../../types/index';

interface AktivitaetenTabProps {
    aktivitaeten: FlowAktivitaet[] | undefined;
}

const AKTIVITAET_LABELS: Record<string, string> = {
    aufgabe_erstellt: 'hat eine Aufgabe erstellt',
    aufgabe_erledigt: 'hat eine Aufgabe als erledigt markiert',
    aufgabe_status_geaendert: 'hat den Aufgabenstatus geaendert',
    aufgabe_geloescht: 'hat eine Aufgabe geloescht',
    tagung_erstellt: 'hat eine Tagung erstellt',
    tagung_dokumentiert: 'hat eine Tagung dokumentiert',
    datei_hochgeladen: 'hat eine Datei hinzugefuegt',
    arbeitspaket_erstellt: 'hat das Arbeitspaket erstellt',
    arbeitspaket_status_geaendert: 'hat den Status geaendert',
    arbeitspaket_abgeschlossen: 'hat das Arbeitspaket abgeschlossen',
    arbeitspaket_wiederaufgenommen: 'hat das Arbeitspaket wiederaufgenommen',
    mitglied_hinzugefuegt: 'hat ein Mitglied hinzugefuegt',
    mitglied_entfernt: 'hat ein Mitglied entfernt',
    rolle_geaendert: 'hat eine Rolle geaendert',
};

function formatAktivitaet(typ: string): string {
    return AKTIVITAET_LABELS[typ] || typ;
}

export function AktivitaetenTab({ aktivitaeten }: AktivitaetenTabProps) {
    return (
        <div className="flow-panel">
            <div className="flow-panel__header">
                <span className="flow-panel__title">Aktivitaeten</span>
            </div>
            <div className="flow-panel__body--flush">
                {Array.isArray(aktivitaeten) && aktivitaeten.length > 0 ? (
                    aktivitaeten.map((a) => (
                        <div key={a.id} className="flow-task-row">
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, color: 'var(--flow-text)' }}>
                                    {a.akteurName && <strong>{a.akteurName}</strong>}{' '}
                                    {formatAktivitaet(a.typ)}
                                </div>
                            </div>
                            <span style={{ fontSize: 11, color: 'var(--flow-text-muted)', fontFamily: 'var(--flow-font-mono)', whiteSpace: 'nowrap' }}>
                                {new Date(a.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    ))
                ) : (
                    <div className="flow-empty"><div className="flow-empty__text">Noch keine Aktivitaeten</div></div>
                )}
            </div>
        </div>
    );
}
