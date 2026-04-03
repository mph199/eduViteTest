import { useState, useEffect, useCallback } from 'react';
import type { ChoiceGroup, ChoiceOption, ChoiceParticipant, ChoiceSubmission } from '../../../types';
import { useActiveView } from '../../../hooks/useActiveView';
import { useBgStyle } from '../../../hooks/useBgStyle';
import { useFlash } from '../../../hooks/useFlash';
import api from '../../../services/api';
import { AdminPageWrapper } from '../../../shared/components/AdminPageWrapper';
import { ChoiceGroupsTab } from './ChoiceGroupsTab';
import { ChoiceOptionsTab } from './ChoiceOptionsTab';
import { ChoiceParticipantsTab } from './ChoiceParticipantsTab';
import { ChoiceSubmissionsTab } from './ChoiceSubmissionsTab';
import '../../../pages/AdminDashboard.css';
import '../choice-admin.css';

type ChoiceTabId = 'groups' | 'options' | 'participants' | 'submissions';

const TAB_LABELS: Record<ChoiceTabId, string> = {
  groups: 'Wahldächer',
  options: 'Optionen',
  participants: 'Teilnehmer',
  submissions: 'Abgaben',
};

export function ChoiceAdmin() {
  useActiveView('admin');
  const adminBgStyle = useBgStyle('admin', '--page-bg');
  const [flash, showFlash] = useFlash();

  const [activeTab, setActiveTab] = useState<ChoiceTabId>('groups');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

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

  const handleSelectGroup = (id: string) => {
    setSelectedGroupId(id);
    setActiveTab('options');
  };

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) || null;

  if (loading) return <AdminPageWrapper style={adminBgStyle}><p>Lade...</p></AdminPageWrapper>;

  return (
    <AdminPageWrapper style={adminBgStyle}>
      <div className="admin-section-header">
        <h2>Differenzierungswahl</h2>
      </div>

      {flash && <div className="admin-success">{flash}</div>}
      {error && <div className="admin-error">{error}</div>}

      <div className="choice-tabs">
        {(Object.entries(TAB_LABELS) as [ChoiceTabId, string][]).map(([id, label]) => {
          const needsGroup = id !== 'groups';
          const disabled = needsGroup && !selectedGroupId;
          return (
            <button
              key={id}
              className={`choice-tab-btn${activeTab === id ? ' choice-tab-btn--active' : ''}`}
              onClick={() => !disabled && setActiveTab(id)}
              disabled={disabled}
            >
              {label}
            </button>
          );
        })}
      </div>

      {selectedGroup && activeTab !== 'groups' && (
        <div className="choice-context-bar">
          <span>Wahldach: <strong>{selectedGroup.title}</strong></span>
          <button
            className="btn-secondary btn--sm"
            onClick={() => { setSelectedGroupId(null); setActiveTab('groups'); }}
          >
            Wechseln
          </button>
        </div>
      )}

      {activeTab === 'groups' && (
        <ChoiceGroupsTab
          groups={groups}
          showFlash={showFlash}
          loadGroups={loadGroups}
          onSelectGroup={handleSelectGroup}
        />
      )}
      {activeTab === 'options' && selectedGroupId && (
        <ChoiceOptionsTab
          groupId={selectedGroupId}
          options={options}
          showFlash={showFlash}
          loadOptions={() => loadGroupDetails(selectedGroupId)}
        />
      )}
      {activeTab === 'participants' && selectedGroupId && (
        <ChoiceParticipantsTab
          groupId={selectedGroupId}
          group={selectedGroup}
          participants={participants}
          showFlash={showFlash}
          loadParticipants={() => loadGroupDetails(selectedGroupId)}
        />
      )}
      {activeTab === 'submissions' && selectedGroupId && (
        <ChoiceSubmissionsTab
          groupId={selectedGroupId}
          submissions={submissions}
          showFlash={showFlash}
        />
      )}
    </AdminPageWrapper>
  );
}
