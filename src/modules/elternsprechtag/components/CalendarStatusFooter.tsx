/**
 * CalendarStatusFooter — Dezenter Footer wenn Abo aktiv.
 * Zeigt Sync-Status + "Verwalten"-Dialog.
 */

import { useState } from 'react';
import { Calendar, RefreshCw, Trash2 } from 'lucide-react';
import type { useCalendarSubscription } from './useCalendarSubscription';

interface Props {
  sub: ReturnType<typeof useCalendarSubscription>;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return iso;
  }
}

export function CalendarStatusFooter({ sub }: Props) {
  const [showManage, setShowManage] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (sub.isLoading || !sub.isActive) return null;

  return (
    <div className="cal-footer">
      <div className="cal-footer__row">
        <Calendar size={14} aria-hidden="true" />
        <span className="cal-footer__text">
          Kalender-Abo aktiv — Termine werden synchronisiert
          {sub.expiresSoon && sub.expiresAt && (
            <span className="cal-footer__expiry-warn"> — Läuft ab am {formatDate(sub.expiresAt)}</span>
          )}
        </span>
        <button type="button" className="cal-footer__btn" onClick={() => setShowManage(!showManage)}>
          {showManage ? 'Schließen' : 'Verwalten'}
        </button>
      </div>

      {showManage && (
        <div className="cal-footer__manage">
          {sub.expiresAt && (
            <p className="cal-footer__detail">Läuft ab am {formatDate(sub.expiresAt)}</p>
          )}

          {sub.error && <p className="cal-footer__error">{sub.error}</p>}

          <div className="cal-footer__manage-actions">
            <button
              type="button"
              className="cal-footer__manage-btn"
              onClick={async () => {
                await sub.handleRotate();
                setShowManage(false);
              }}
            >
              <RefreshCw size={14} aria-hidden="true" /> Neu erzeugen
            </button>

            {!confirmDelete ? (
              <button
                type="button"
                className="cal-footer__manage-btn cal-footer__manage-btn--danger"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 size={14} aria-hidden="true" /> Deaktivieren
              </button>
            ) : (
              <div className="cal-footer__confirm">
                <span className="cal-footer__confirm-text">
                  Kalender-Abo wirklich deaktivieren? Termine werden nicht mehr automatisch synchronisiert.
                </span>
                <button
                  type="button"
                  className="cal-footer__manage-btn cal-footer__manage-btn--danger"
                  onClick={async () => {
                    await sub.handleDelete();
                    setShowManage(false);
                    setConfirmDelete(false);
                  }}
                >
                  Ja, deaktivieren
                </button>
                <button
                  type="button"
                  className="cal-footer__manage-btn"
                  onClick={() => setConfirmDelete(false)}
                >
                  Abbrechen
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
