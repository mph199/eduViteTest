import { useOutletContext } from 'react-router-dom';
import { BLSprechzeitenTab } from './BLSprechzeitenTab';
import type { BLCounselorContext } from './BLCounselorLayout';

export function BLCounselorSprechzeitenPage() {
  const { profile, schedule, showFlash } = useOutletContext<BLCounselorContext>();
  if (!profile) return <p>Kein Beratungslehrer-Profil gefunden.</p>;
  return <BLSprechzeitenTab profile={profile} initialSchedule={schedule} showFlash={showFlash} />;
}
