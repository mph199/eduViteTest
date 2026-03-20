interface FortschrittsBalkenProps {
    erledigt: number;
    gesamt: number;
}

export function FortschrittsBalken({ erledigt, gesamt }: FortschrittsBalkenProps) {
    const prozent = gesamt > 0 ? Math.round((erledigt / gesamt) * 100) : 0;

    return (
        <div className="flow-progress-bar">
            <div className="flow-progress-bar__track">
                <div
                    className="flow-progress-bar__fill"
                    style={{ width: `${prozent}%` }}
                />
            </div>
            <span className="flow-progress-bar__label">
                {erledigt}/{gesamt}
            </span>
        </div>
    );
}
