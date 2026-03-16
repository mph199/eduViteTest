import { CounselorBookingApp } from '../../../shared/components/CounselorBookingApp';
import type { CounselorBookingConfig } from '../../../shared/components/CounselorBookingApp';

const config: CounselorBookingConfig = {
  title: 'Beratungslehrer',
  subtitle: 'Buche eine Sprechstunde bei einem Beratungslehrer.',
  counselorLabel: 'Beratungslehrer',
  confidentialNotice:
    'Alle Beratungsgespraeche sind vertraulich. Deine Angaben werden nur an den gewaehlten Beratungslehrer weitergegeben.',
  topicLabel: 'Thema',
  topicFieldKey: 'topic_id',
  successCounselorLabel: 'Beratungslehrer',
  successMessage: 'Der Beratungslehrer wird sich bei dir melden, um den Termin zu bestaetigen.',
  apiPathPrefix: '/bl',
  topicEndpoint: '/topics',
  topicResponseKey: 'topics',
};

export function BLBookingApp() {
  return <CounselorBookingApp config={config} />;
}
