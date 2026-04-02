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

      {/* Tab-Navigation */}
      <div className="admin-tabs" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '2px solid var(--color-gray-200)' }}>
        {(Object.entries(TAB_LABELS) as [ChoiceTabId, string][]).map(([id, label]) => {
          const needsGroup = id !== 'groups';
          const disabled = needsGroup && !selectedGroupId;
          return (
            <button
              key={id}
              className={`btn-secondary${activeTab === id ? ' active' : ''}`}
              style={{
                padding: '0.5rem 1rem',
                borderBottom: activeTab === id ? '2px solid var(--brand-primary)' : '2px solid transparent',
                opacity: disabled ? 0.5 : 1,
                cursor: disabled ? 'not-allowed' : 'pointer',
                background: 'none',
                border: 'none',
                borderRadius: 0,
                fontWeight: activeTab === id ? 600 : 400,
                color: activeTab === id ? 'var(--brand-primary)' : 'var(--color-gray-600)',
              }}
              onClick={() => !disabled && setActiveTab(id)}
              disabled={disabled}
            >
              {label}
            </button>
          );
        })}
      </div>

      {selectedGroup && activeTab !== 'groups' && (
        <div style={{ marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--color-gray-600)' }}>
          Wahldach: <strong>{selectedGroup.title}</strong>
          <button
            className="btn-secondary"
            style={{ marginLeft: '0.75rem', fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}
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
