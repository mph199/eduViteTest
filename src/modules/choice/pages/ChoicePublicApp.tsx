import { Routes, Route } from 'react-router-dom';
import { CounselorBookingLayout } from '../../../shared/components/CounselorBookingLayout';
import { VerifyPage } from './VerifyPage';
import { RequestAccessPage } from './RequestAccessPage';
import { ChoiceFormPage } from './ChoiceFormPage';
import { ConfirmationPage } from './ConfirmationPage';

export function ChoicePublicApp() {
  return (
    <CounselorBookingLayout moduleId="choice">
      <div className="cb-app">
        <Routes>
          <Route path=":groupId/verify" element={<VerifyPage />} />
          <Route path=":groupId/bestaetigung" element={<ConfirmationPage />} />
          <Route path=":groupId" element={<ChoiceFormPage />} />
          <Route path="zugang" element={<RequestAccessPage />} />
        </Routes>
      </div>
    </CounselorBookingLayout>
  );
}
