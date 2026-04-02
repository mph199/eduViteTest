import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { ChoicePublicGroup, ChoiceSubmissionItem } from '../../../types';
import api from '../../../services/api';

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
        // Remove and reorder priorities
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
    return <div style={{ textAlign: 'center', padding: '3rem 1rem' }}><p>Lade Wahldaten...</p></div>;
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
        <p style={{ color: 'var(--color-error)' }}>{error}</p>
        <p style={{ marginTop: '1rem' }}>
          <a href="/wahl/zugang" style={{ color: 'var(--brand-primary)' }}>Neuen Zugangslink anfordern</a>
        </p>
      </div>
    );
  }

  if (!group) return null;

  const selectedIds = new Set(items.map((i) => i.option_id));
  const isRanking = group.ranking_mode === 'required';
  const canSubmit = items.length >= group.min_choices && items.length <= group.max_choices;

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1.5rem 1rem' }}>
      <h2 style={{ marginBottom: '0.5rem' }}>{group.title}</h2>
      {group.description && (
        <p style={{ color: 'var(--color-gray-600)', marginBottom: '1rem', fontSize: '0.9rem' }}>{group.description}</p>
      )}
      <p style={{ marginBottom: '1.5rem', fontSize: '0.85rem', color: 'var(--color-gray-500)' }}>
        Wählen Sie {group.min_choices === group.max_choices
          ? `genau ${group.min_choices}`
          : `${group.min_choices} bis ${group.max_choices}`} Option(en).
        {isRanking && ' Ordnen Sie Ihre Wahlen nach Priorität.'}
      </p>

      {submissionStatus === 'submitted' && (
        <div style={{ padding: '0.75rem 1rem', background: 'var(--color-gray-50)', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.9rem' }}>
          Ihre Wahl wurde bereits abgegeben. Sie können sie hier noch bearbeiten und erneut abgeben.
        </div>
      )}

      {flash && (
        <div style={{
          padding: '0.5rem 1rem', marginBottom: '1rem', borderRadius: '4px', fontSize: '0.9rem',
          background: flashType === 'error' ? 'var(--color-error-light)' : 'var(--color-gray-100)',
          color: flashType === 'error' ? 'var(--color-error)' : 'inherit',
        }}>
          {flash}
        </div>
      )}

      {/* Options list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {(group.options || []).map((opt) => {
          const selected = selectedIds.has(opt.id);
          const item = items.find((i) => i.option_id === opt.id);
          return (
            <div
              key={opt.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                border: `2px solid ${selected ? 'var(--brand-primary)' : 'var(--color-gray-200)'}`,
                borderRadius: '8px',
                cursor: 'pointer',
                background: selected ? 'rgba(var(--brand-primary-rgb), 0.05)' : 'var(--color-white)',
                transition: 'border-color 0.15s',
              }}
              onClick={() => toggleOption(opt.id)}
            >
              <div style={{
                width: '24px', height: '24px', borderRadius: '4px', flexShrink: 0,
                border: `2px solid ${selected ? 'var(--brand-primary)' : 'var(--color-gray-300)'}`,
                background: selected ? 'var(--brand-primary)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--color-white)', fontSize: '0.75rem', fontWeight: 700,
              }}>
                {selected && (isRanking ? item?.priority : '\u2713')}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500 }}>{opt.title}</div>
                {opt.description && <div style={{ fontSize: '0.85rem', color: 'var(--color-gray-500)', marginTop: '0.25rem' }}>{opt.description}</div>}
              </div>
              {selected && isRanking && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }} onClick={(e) => e.stopPropagation()}>
                  <button
                    style={{ background: 'none', border: '1px solid var(--color-gray-300)', borderRadius: '3px', padding: '0 4px', cursor: 'pointer', fontSize: '0.75rem' }}
                    onClick={() => movePriority(opt.id, -1)}
                    disabled={item?.priority === 1}
                  >
                    &#9650;
                  </button>
                  <button
                    style={{ background: 'none', border: '1px solid var(--color-gray-300)', borderRadius: '3px', padding: '0 4px', cursor: 'pointer', fontSize: '0.75rem' }}
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

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button
          onClick={handleSaveDraft}
          disabled={saving}
          style={{
            padding: '0.6rem 1.25rem',
            border: '1px solid var(--color-gray-300)',
            borderRadius: '4px',
            background: 'var(--color-white)',
            cursor: saving ? 'wait' : 'pointer',
          }}
        >
          {saving ? 'Speichere...' : 'Entwurf speichern'}
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting || !canSubmit}
          style={{
            padding: '0.6rem 1.25rem',
            border: 'none',
            borderRadius: '4px',
            background: canSubmit ? 'var(--brand-primary)' : 'var(--color-gray-300)',
            color: 'var(--color-white)',
            cursor: submitting || !canSubmit ? 'not-allowed' : 'pointer',
            fontWeight: 500,
          }}
        >
          {submitting ? 'Wird abgegeben...' : 'Wahl abgeben'}
        </button>
      </div>
    </div>
  );
}
