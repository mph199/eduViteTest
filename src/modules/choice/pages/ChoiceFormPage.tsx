import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { ChoicePublicGroup, ChoiceSubmissionItem } from '../../../types';
import api from '../../../services/api';
import { DynamicIcon } from '../../../shared/components/IconPicker';
import '../choice-form.css';

export function ChoiceFormPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();

  const [group, setGroup] = useState<ChoicePublicGroup | null>(null);
  const [items, setItems] = useState<ChoiceSubmissionItem[]>([]);
  const [submissionStatus, setSubmissionStatus] = useState<string>('none');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [flash, setFlash] = useState('');
  const [flashType, setFlashType] = useState<'success' | 'error'>('success');

  const loadData = useCallback(async () => {
    if (!groupId) return;
    try {
      const [groupData, submissionData] = await Promise.all([
        api.choicePublic.getGroup(groupId),
        api.choicePublic.getSubmission(groupId),
      ]);
      setGroup(groupData);
      if (submissionData?.items) {
        setItems(submissionData.items);
        setSubmissionStatus(submissionData.status || 'none');
      }
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 401 || status === 403) {
        setError('Sitzung abgelaufen oder kein Zugriff. Bitte fordern Sie einen neuen Zugangslink an.');
      } else {
        setError(err instanceof Error ? err.message : 'Fehler beim Laden der Wahldaten.');
      }
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleOption = (optionId: string) => {
    setItems((prev) => {
      const exists = prev.find((i) => i.option_id === optionId);
      if (exists) {
        const filtered = prev.filter((i) => i.option_id !== optionId);
        return filtered.map((i, idx) => ({ ...i, priority: idx + 1 }));
      }
      if (group && prev.length >= group.max_choices) return prev;
      return [...prev, { option_id: optionId, priority: prev.length + 1 }];
    });
  };

  const movePriority = (optionId: string, direction: -1 | 1) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.option_id === optionId);
      if (idx < 0) return prev;
      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
      return copy.map((i, j) => ({ ...i, priority: j + 1 }));
    });
  };

  const handleSaveDraft = async () => {
    if (saving || !groupId) return;
    setSaving(true);
    setFlash('');
    try {
      await api.choicePublic.saveDraft(groupId, items.map((i) => ({ option_id: i.option_id, priority: i.priority })));
      setSubmissionStatus('draft');
      setFlashType('success');
      setFlash('Entwurf gespeichert.');
    } catch (err) {
      setFlashType('error');
      setFlash(err instanceof Error ? err.message : 'Fehler beim Speichern.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (submitting || !groupId || !group) return;
    if (items.length < group.min_choices) {
      setFlashType('error');
      setFlash(`Bitte mindestens ${group.min_choices} Wahl(en) treffen.`);
      return;
    }
    setSubmitting(true);
    setFlash('');
    try {
      await api.choicePublic.submit(groupId, items.map((i) => ({ option_id: i.option_id, priority: i.priority })));
      navigate(`/wahl/${groupId}/bestaetigung`, { replace: true });
    } catch (err) {
      setFlashType('error');
      setFlash(err instanceof Error ? err.message : 'Fehler beim Abgeben.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="cf-page"><p>Lade Wahldaten...</p></div>;
  }

  if (error) {
    return (
      <div className="cf-page">
        <p className="cf-flash cf-flash--error">{error}</p>
        <p><a href="/wahl/zugang" style={{ color: 'var(--brand-primary)' }}>Neuen Zugangslink anfordern</a></p>
      </div>
    );
  }

  if (!group) return null;

  const selectedIds = new Set(items.map((i) => i.option_id));
  const isRanking = group.ranking_mode === 'required';
  const canSubmit = items.length >= group.min_choices && items.length <= group.max_choices;

  return (
    <div className="cf-page">
      <h2 className="cf-title">{group.title}</h2>
      {group.description && <p className="cf-description">{group.description}</p>}
      <p className="cf-hint">
        Wählen Sie {group.min_choices === group.max_choices
          ? `genau ${group.min_choices}`
          : `${group.min_choices} bis ${group.max_choices}`} Option(en).
        {isRanking && ' Ordnen Sie Ihre Wahlen nach Priorität.'}
      </p>

      {submissionStatus === 'submitted' && (
        <div className="cf-submitted-notice">
          Ihre Wahl wurde bereits abgegeben. Sie können sie hier noch bearbeiten und erneut abgeben.
        </div>
      )}

      {flash && (
        <div className={`cf-flash${flashType === 'error' ? ' cf-flash--error' : ''}`}>
          {flash}
        </div>
      )}

      <div className="cf-options">
        {(group.options || []).map((opt) => {
          const selected = selectedIds.has(opt.id);
          const item = items.find((i) => i.option_id === opt.id);
          return (
            <div
              key={opt.id}
              className={`cf-option${selected ? ' cf-option--selected' : ''}`}
              onClick={() => toggleOption(opt.id)}
            >
              <div className="cf-option__checkbox">
                {selected && (isRanking ? item?.priority : '\u2713')}
              </div>
              {opt.icon && (
                <DynamicIcon name={opt.icon} size={24} className="cf-option__icon" />
              )}
              <div className="cf-option__body">
                <div className="cf-option__title">{opt.title}</div>
                {opt.description && <div className="cf-option__desc">{opt.description}</div>}
              </div>
              {selected && isRanking && (
                <div className="cf-option__rank-controls" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="cf-option__rank-btn"
                    onClick={() => movePriority(opt.id, -1)}
                    disabled={item?.priority === 1}
                  >
                    &#9650;
                  </button>
                  <button
                    className="cf-option__rank-btn"
                    onClick={() => movePriority(opt.id, 1)}
                    disabled={item?.priority === items.length}
                  >
                    &#9660;
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="cf-actions">
        <button onClick={handleSaveDraft} disabled={saving} className="cf-btn-draft">
          {saving ? 'Speichere...' : 'Entwurf speichern'}
        </button>
        <button onClick={handleSubmit} disabled={submitting || !canSubmit} className="cf-btn-submit">
          {submitting ? 'Wird abgegeben...' : 'Wahl abgeben'}
        </button>
      </div>
    </div>
  );
}
