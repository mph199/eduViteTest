interface DeadlineAnzeigeProps {
    deadline: string | null;
    erledigt?: boolean;
}

export function DeadlineAnzeige({ deadline, erledigt }: DeadlineAnzeigeProps) {
    if (!deadline) return null;

    const d = new Date(deadline);
    const now = new Date();
    const diffMs = d.getTime() - now.getTime();
    const diffTage = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    let klasse = 'flow-deadline--ok';
    if (erledigt) {
        klasse = 'flow-deadline--done';
    } else if (diffTage < 0) {
        klasse = 'flow-deadline--overdue';
    } else if (diffTage <= 7) {
        klasse = 'flow-deadline--soon';
    }

    const formatiert = d.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
    });

    return (
        <span className={`flow-deadline ${klasse}`}>
            {formatiert}
        </span>
    );
}
