import { CounselorBookingApp } from '../../../shared/components/CounselorBookingApp';
import { CounselorBookingLayout } from '../../../shared/components/CounselorBookingLayout';
import type { CounselorBookingConfig } from '../../../shared/components/CounselorBookingApp';

const config: CounselorBookingConfig = {
  title: 'Schulsozialarbeit',
  subtitle: 'Buche einen vertraulichen Beratungstermin.',
  counselorLabel: 'Berater/in',
  confidentialNotice:
    'Alle Beratungsgespräche sind vertraulich. Deine Angaben werden nur an die gewählte Beratungsperson weitergegeben.',
  topicLabel: 'Thema',
  topicFieldKey: 'category_id',
  successCounselorLabel: 'Berater/in',
  successMessage: 'Die Beratungsperson wird sich bei dir melden, um den Termin zu bestätigen.',
  apiPathPrefix: '/ssw',
  topicEndpoint: '/categories',
  topicResponseKey: 'categories',
  moduleId: 'schulsozialarbeit',
};

export function SSWBookingApp() {
  return (
    <CounselorBookingLayout moduleId="schulsozialarbeit">
      <CounselorBookingApp config={config} />
    </CounselorBookingLayout>
  );
}
