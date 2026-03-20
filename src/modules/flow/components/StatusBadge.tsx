import type { FlowArbeitspaketStatus, FlowAufgabenStatus } from '../../../types/index';

const STATUS_LABELS: Record<string, string> = {
    entwurf: 'Entwurf',
    geplant: 'Geplant',
    aktiv: 'Aktiv',
    abgeschlossen: 'Abgeschlossen',
    offen: 'Offen',
    in_bearbeitung: 'In Bearbeitung',
    erledigt: 'Erledigt',
};

interface StatusBadgeProps {
    status: FlowArbeitspaketStatus | FlowAufgabenStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
    return (
        <span className={`flow-status-badge flow-status-badge--${status}`}>
            {STATUS_LABELS[status] || status}
        </span>
    );
}
