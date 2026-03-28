/**
 * CalendarSetupBanner — Einzeiliger, dismissbarer Hinweis wenn kein Abo aktiv.
 *
 * Zustand 1: Kein Abo, Banner sichtbar → "Einrichten"-Link
 * Zustand 2: Kein Abo, Banner dismissed → nur "Kalender-Sync" Link im Header
 * Zustand 3: Token gerade erstellt → URL + Kopieren + Kalender-App öffnen
 */

import { useState } from 'react';
import { Calendar, X, Copy, Check, ExternalLink } from 'lucide-react';
import type { useCalendarSubscription } from './useCalendarSubscription';

interface Props {
  sub: ReturnType<typeof useCalendarSubscription>;
}

export function CalendarSetupBanner({ sub }: Props) {
  const [copied, setCopied] = useState(false);

  if (sub.isLoading) return null;

  // Token gerade erstellt — URL-Anzeige hat Vorrang (auch wenn isActive=true)
  if (sub.token) {
    const url = sub.buildUrl(sub.token);
    const webcalUrl = sub.buildWebcalUrl(sub.token);

    const handleCopy = async () => {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      } catch { /* clipboard not available */ }
    };

    return (
      <div className="cal-banner cal-banner--setup">
        <div className="cal-banner__row">
          <Calendar size={16} aria-hidden="true" />
          <span className="cal-banner__text">Kalender-Abo eingerichtet! Kopieren Sie die URL oder öffnen Sie sie in Ihrer Kalender-App.</span>
        </div>
        <div className="cal-banner__url-row">
          <input
            type="text"
            className="cal-banner__url"
            value={url}
            readOnly
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
          <button type="button" className="cal-banner__btn cal-banner__btn--sm" onClick={handleCopy}>
            {copied ? <><Check size={14} aria-hidden="true" /> Kopiert</> : <><Copy size={14} aria-hidden="true" /> Kopieren</>}
          </button>
          <a href={webcalUrl} className="cal-banner__btn cal-banner__btn--sm">
            <ExternalLink size={14} aria-hidden="true" /> Kalender-App
          </a>
        </div>
        <p className="cal-banner__hint">
          Diese URL wird nur einmal angezeigt. Kopieren Sie sie jetzt.
        </p>
        {sub.error && <p className="cal-banner__error">{sub.error}</p>}
      </div>
    );
  }

  // Abo aktiv (ohne gerade erzeugten Token) — kein Banner nötig
  if (sub.isActive) return null;

  const isExpired = sub.isExpired;
  const label = isExpired
    ? 'Ihr Kalender-Abo ist abgelaufen. Erneuern Sie es, um Termine weiter zu synchronisieren.'
    : 'Termine automatisch in Ihren Kalender übernehmen';
  const actionLabel = isExpired ? 'Erneuern' : 'Einrichten';

  // Dismissed — kein Banner
  if (sub.dismissed) return null;

  return (
    <div className={`cal-banner${isExpired ? ' cal-banner--expired' : ''}`}>
      <div className="cal-banner__row">
        <Calendar size={16} aria-hidden="true" />
        <span className="cal-banner__text">{label}</span>
        <div className="cal-banner__actions">
          <button
            type="button"
            className="cal-banner__link"
            onClick={sub.handleCreate}
          >
            {actionLabel}
          </button>
          {!isExpired && (
            <button type="button" className="cal-banner__dismiss" onClick={sub.dismiss} aria-label="Hinweis schließen">
              <X size={16} />
            </button>
          )}
        </div>
      </div>
      {sub.error && <p className="cal-banner__error">{sub.error}</p>}
    </div>
  );
}

/** Kleiner Link für den Seitenheader wenn Banner dismissed ist */
export function CalendarSyncLink({ sub }: Props) {
  if (sub.isLoading || sub.isActive || !sub.dismissed) return null;

  return (
    <button
      type="button"
      className="cal-sync-link"
      onClick={sub.handleCreate}
    >
      <Calendar size={14} aria-hidden="true" /> Kalender-Sync
    </button>
  );
}
