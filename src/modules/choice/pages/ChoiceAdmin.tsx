import { useState, useEffect, useCallback } from 'react';
import type { ChoiceGroup, ChoiceOption, ChoiceParticipant, ChoiceSubmission } from '../../../types';
import { useActiveView } from '../../../hooks/useActiveView';
import { useBgStyle } from '../../../hooks/useBgStyle';
import { useFlash } from '../../../hooks/useFlash';
import api from '../../../services/api';
import { AdminPageWrapper } from '../../../shared/components/AdminPageWrapper';
import { ChoiceGroupsOverview } from './ChoiceGroupsTab';
import { ChoiceOptionsTab } from './ChoiceOptionsTab';
import { ChoiceParticipantsTab } from './ChoiceParticipantsTab';
import { ChoiceSubmissionsTab } from './ChoiceSubmissionsTab';
import '../../../pages/AdminDashboard.css';
import '../choice-admin.css';

type DetailTabId = 'options' | 'participants' | 'submissions';

const DETAIL_TAB_LABELS: Record<DetailTabId, string> = {
  options: 'Optionen',
  participants: 'Teilnehmer',
  submissions: 'Abgaben',
};

export function ChoiceAdmin() {
  useActiveView('admin');
  const adminBgStyle = useBgStyle('admin', '--page-bg');
  const [flash, showFlash] = useFlash();

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTabId>('options');

  const [groups, setGroups] = useState<ChoiceGroup[]>([]);
  const [options, setOptions] = useState<ChoiceOption[]>([]);
  const [participants, setParticipants] = useState<ChoiceParticipant[]>([]);
  const [submissions, setSubmissions] = useState<ChoiceSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadGroups = useCallback(async () => {
    try {
      const res = await api.choice.listGroups();
      setGroups(Array.isArray(res) ? res : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    }
  }, []);

  const loadGroupDetails = useCallback(async (groupId: string) => {
    try {
      const [opts, parts, subs] = await Promise.all([
        api.choice.listOptions(groupId),
        api.choice.listParticipants(groupId),
        api.choice.listSubmissions(groupId),
      ]);
      setOptions(Array.isArray(opts) ? opts : []);
      setParticipants(Array.isArray(parts) ? parts : []);
      setSubmissions(Array.isArray(subs) ? subs : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Details');
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    await loadGroups();
    setLoading(false);
  }, [loadGroups]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (selectedGroupId) {
      loadGroupDetails(selectedGroupId);
    } else {
      setOptions([]);
      setParticipants([]);
      setSubmissions([]);
    }
  }, [selectedGroupId, loadGroupDetails]);

  const handleOpenGroup = (id: string) => {
    setSelectedGroupId(id);
    setDetailTab('options');
  };

  const handleBack = () => {
    setSelectedGroupId(null);
  };

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) || null;

  if (loading) return <AdminPageWrapper style={adminBgStyle}><p>Lade...</p></AdminPageWrapper>;

  /* ── Screen 1: Overview ─────────────────────────────────────────── */
  if (!selectedGroupId) {
    return (
      <AdminPageWrapper style={adminBgStyle}>
        <div className="admin-section-header">
          <h2>Differenzierungswahl</h2>
        </div>

        {flash && <div className="admin-success">{flash}</div>}
        {error && <div className="admin-error">{error}</div>}

        <ChoiceGroupsOverview
          groups={groups}
          showFlash={showFlash}
          loadGroups={loadGroups}
          onOpenGroup={handleOpenGroup}
        />
      </AdminPageWrapper>
    );
  }

  /* ── Screen 2: Detail ───────────────────────────────────────────── */
  return (
    <AdminPageWrapper style={adminBgStyle}>
      <button className="choice-back-btn" onClick={handleBack}>
        Alle Wahldächer
      </button>

      <div className="admin-section-header">
        <h2>{selectedGroup?.title || 'Wahldach'}</h2>
        {selectedGroup && (
          <span className={`choice-status choice-status--${selectedGroup.status}`}>
            {selectedGroup.status === 'draft' ? 'Entwurf' : selectedGroup.status === 'open' ? 'Offen' : selectedGroup.status === 'closed' ? 'Geschlossen' : 'Archiviert'}
          </span>
        )}
      </div>

      {flash && <div className="admin-success">{flash}</div>}
      {error && <div className="admin-error">{error}</div>}

      <div className="choice-tabs">
        {(Object.entries(DETAIL_TAB_LABELS) as [DetailTabId, string][]).map(([id, label]) => (
          <button
            key={id}
            className={`choice-tab-btn${detailTab === id ? ' choice-tab-btn--active' : ''}`}
            onClick={() => setDetailTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {detailTab === 'options' && (
        <ChoiceOptionsTab
          groupId={selectedGroupId}
          options={options}
          showFlash={showFlash}
          loadOptions={() => loadGroupDetails(selectedGroupId)}
        />
      )}
      {detailTab === 'participants' && (
        <ChoiceParticipantsTab
          groupId={selectedGroupId}
          group={selectedGroup}
          participants={participants}
          showFlash={showFlash}
          loadParticipants={() => loadGroupDetails(selectedGroupId)}
        />
      )}
      {detailTab === 'submissions' && (
        <ChoiceSubmissionsTab
          groupId={selectedGroupId}
          submissions={submissions}
          showFlash={showFlash}
        />
      )}
    </AdminPageWrapper>
  );
}
