import { useOutletContext } from 'react-router-dom';
import { BLTermineTab } from './BLTermineTab';
import type { BLCounselorContext } from './BLCounselorLayout';

export function BLCounselorTerminePage() {
  const { profile, showFlash } = useOutletContext<BLCounselorContext>();
  if (!profile) return <p>Kein Beratungslehrer-Profil gefunden.</p>;
  return <BLTermineTab profile={profile} showFlash={showFlash} />;
}
