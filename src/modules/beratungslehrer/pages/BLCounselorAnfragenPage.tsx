import { useOutletContext } from 'react-router-dom';
import { BLAnfragenTab } from './BLAnfragenTab';
import type { BLCounselorContext } from './BLCounselorLayout';

export function BLCounselorAnfragenPage() {
  const { showFlash } = useOutletContext<BLCounselorContext>();
  return <BLAnfragenTab showFlash={showFlash} />;
}
