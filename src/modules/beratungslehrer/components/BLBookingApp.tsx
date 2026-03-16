import { CounselorBookingApp } from '../../../shared/components/CounselorBookingApp';
import { CounselorBookingLayout } from '../../../shared/components/CounselorBookingLayout';
import type { CounselorBookingConfig } from '../../../shared/components/CounselorBookingApp';

const config: CounselorBookingConfig = {
  title: 'Beratungslehrkräfte',
  subtitle: 'Buche eine Sprechstunde bei einer Beratungslehrkraft.',
  counselorLabel: 'Beratungslehrkraft',
  confidentialNotice:
    'Alle Beratungsgespräche sind vertraulich. Deine Angaben werden nur an die gewählte Beratungslehrkraft weitergegeben.',
  topicLabel: 'Thema',
  topicFieldKey: 'topic_id',
  successCounselorLabel: 'Beratungslehrkraft',
  successMessage: 'Die Beratungslehrkraft wird sich bei dir melden, um den Termin zu bestätigen.',
  apiPathPrefix: '/bl',
  topicEndpoint: '/topics',
  topicResponseKey: 'topics',
};

export function BLBookingApp() {
  return (
    <CounselorBookingLayout moduleId="beratungslehrer">
      <CounselorBookingApp config={config} />
    </CounselorBookingLayout>
  );
}
