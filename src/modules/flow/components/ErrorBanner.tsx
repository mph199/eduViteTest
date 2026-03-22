interface ErrorBannerProps {
    error: string;
    onDismiss: () => void;
    style?: React.CSSProperties;
}

export function ErrorBanner({ error, onDismiss, style }: ErrorBannerProps) {
    if (!error) return null;
    return (
        <div className="flow-hinweis-chip flow-hinweis-chip--alert" style={{ marginBottom: 12, ...style }}>
            <span className="flow-hinweis-chip__dot" />{error}
            <button onClick={onDismiss} aria-label="Schliessen" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', marginLeft: 8 }}>{'\u00d7'}</button>
        </div>
    );
}
