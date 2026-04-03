import { useParams } from 'react-router-dom';
import '../choice-form.css';

export function ConfirmationPage() {
  const { groupId } = useParams<{ groupId: string }>();

  return (
    <div className="cf-confirm-page">
      <div className="cf-confirm-page__icon">&#10003;</div>
      <h2 className="cf-confirm-page__title">Wahl erfolgreich abgegeben</h2>
      <p className="cf-confirm-page__text">
        Ihre Differenzierungswahl wurde gespeichert. Sie können dieses Fenster jetzt schliessen.
      </p>
      {groupId && (
        <a href={`/wahl/${encodeURIComponent(groupId)}`} className="cf-confirm-page__link">
          Wahl bearbeiten
        </a>
      )}
    </div>
  );
}
