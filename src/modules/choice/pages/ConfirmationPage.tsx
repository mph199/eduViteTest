import { useParams } from 'react-router-dom';

export function ConfirmationPage() {
  const { groupId } = useParams<{ groupId: string }>();

  return (
    <div style={{ textAlign: 'center', padding: '3rem 1rem', maxWidth: '480px', margin: '0 auto' }}>
      <div style={{
        width: '64px', height: '64px', borderRadius: '50%',
        background: 'var(--brand-primary)', color: 'var(--color-white)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 1.5rem', fontSize: '1.75rem',
      }}>
        &#10003;
      </div>
      <h2 style={{ marginBottom: '0.75rem' }}>Wahl erfolgreich abgegeben</h2>
      <p style={{ color: 'var(--color-gray-600)', marginBottom: '1.5rem' }}>
        Ihre Differenzierungswahl wurde gespeichert. Sie können dieses Fenster jetzt schliessen.
      </p>
      {groupId && (
        <a
          href={`/wahl/${encodeURIComponent(groupId)}`}
          style={{
            color: 'var(--brand-primary)',
            textDecoration: 'underline',
            fontSize: '0.9rem',
          }}
        >
          Wahl bearbeiten
        </a>
      )}
    </div>
  );
}
