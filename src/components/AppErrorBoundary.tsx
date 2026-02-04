import React from 'react';

type Props = { children: React.ReactNode };
type State = { hasError: boolean; message?: string };

export class AppErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown, info: unknown) {
    // Optionally log to an error service
    console.error('AppErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24 }}>
          <h2>Es ist ein Fehler aufgetreten.</h2>
          <p style={{ color: '#c33' }}>{this.state.message}</p>
          <button onClick={() => window.location.reload()} style={{ padding: '8px 12px' }}>
            Seite neu laden
          </button>
        </div>
      );
    }
    return this.props.children as React.ReactElement;
  }
}
