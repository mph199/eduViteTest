import type { CounselorTopic as Topic } from '../../../types';
import api from '../../../services/api';
import { TopicCategoryTab } from '../../../components/TopicCategoryTab';

interface Props {
  topics: Topic[];
  showFlash: (msg: string) => void;
  loadAdminData: () => void;
}

const blApi = { create: api.bl.createTopic, update: api.bl.updateTopic };
const blLabels = { created: 'Thema erstellt.', updated: 'Thema aktualisiert.' };

export function BLTopicsTab({ topics, showFlash, loadAdminData }: Props) {
  return (
    <TopicCategoryTab
      items={topics}
      showFlash={showFlash}
      loadData={loadAdminData}
      api={blApi}
      labels={blLabels}
      idPrefix="bl-topic"
    />
  );
}
