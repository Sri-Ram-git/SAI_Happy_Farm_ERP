const fs = require('fs');
let content = fs.readFileSync('frontend/src/pages/FarmerFormPage.tsx', 'utf8');

// 1. Remove ReportStatusModal import
content = content.replace(/import \{ ReportStatusModal \} from '\.\.\/components\/ReportStatusModal';\r?\n/, '');

// 2. State replacements
content = content.replace(/const \[showStatusModal, setShowStatusModal\] = useState<boolean>\(false\);/, 'const [showLimitModal, setShowLimitModal] = useState<boolean>(false);\n  const [showDisclaimerModal, setShowDisclaimerModal] = useState<boolean>(false);');
content = content.replace(/setShowStatusModal\(false\);/g, 'setShowLimitModal(false); setShowDisclaimerModal(false);');

// 3. Fix isInitial logic
const isInitialOld = /if \(\s*isInitial &&\s*rep &&\s*rep\.submissionMethod !== 'HISTORICAL_IMPORT' &&\s*\(rep\.submissionVersion != null \|\| rep\.status\) &&\s*!hasSubmittedInSessionRef\.current &&\s*!hasDismissedModal\s*\) \{\s*setShowStatusModal\(true\);\s*\}/;
const isInitialNew = if (
        isInitial &&
        rep &&
        rep.submissionMethod !== 'HISTORICAL_IMPORT' &&
        (rep.submissionVersion != null || rep.status) &&
        !hasSubmittedInSessionRef.current
      ) {
        setSubmitted(true);
      };
content = content.replace(isInitialOld, isInitialNew);

// 4. Update handleReset logic inside Success Summary
const handleResetRegex = /const handleReset = \(\) => \{[\s\S]*?\};/;
const handleResetNew = const handleStartCorrection = () => {
    if (todayReport?.submissionVersion >= 2 || todayReport?.status === 'finalized') {
      setShowLimitModal(true);
    } else {
      setShowDisclaimerModal(true);
    }
  };

  const handleConfirmCorrection = () => {
    setShowDisclaimerModal(false);
    if (userProfile?.uid && farmId) {
      clearFarmerDraft(userProfile.uid, farmId, reportDate);
    }
    setData(INITIAL_FARM_FORM_DATA);
    setErrors({});
    setStep(0);
    setSubmitted(false);
    setSubmittedOffline(false);
    setSubmitError('');
    setHasDismissedModal(true);
  };;
content = content.replace(handleResetRegex, handleResetNew);

// 5. Update the button in Success Summary to use handleStartCorrection
content = content.replace(/<button className="btn btn--primary btn--full" style=\{\{ marginTop: 20 \}\} onClick=\{handleReset\}>\s*\{t\('common\.save'\)\}\s*<\/button>/g, '<button className="btn btn--primary btn--full" style={{ marginTop: 20 }} onClick={handleStartCorrection}>\n              {t(\'farmer.submitCorrection\', \'Submit another report (Correction)\')}\n            </button>');

// 6. Replace <ReportStatusModal /> with the inline modals
const modalRegex = /<ReportStatusModal[\s\S]*?\/>/;
const modalsNew = {showLimitModal && (
        <div className="farmer-modal-overlay" onClick={() => setShowLimitModal(false)} role="dialog">
          <div className="farmer-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="farmer-modal-icon-badge" style={{ background: '#fef2f2', color: '#dc2626' }}>
              <AlertTriangle size={26} strokeWidth={2.5} />
            </div>
            <h3 className="farmer-modal-title">Daily submission limit reached</h3>
            <p className="farmer-modal-desc">
              You have already completed the maximum of 2 submissions for today. Your next submission will be available on the next allowed day.
            </p>
            <button type="button" className="farmer-modal-action-btn" onClick={() => setShowLimitModal(false)}>
              {t('common.ok', 'OK')}
            </button>
          </div>
        </div>
      )}

      {showDisclaimerModal && (
        <div className="farmer-modal-overlay" onClick={() => setShowDisclaimerModal(false)} role="dialog">
          <div className="farmer-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="farmer-modal-icon-badge" style={{ background: '#fffbeb', color: '#d97706' }}>
              <AlertTriangle size={26} strokeWidth={2.5} />
            </div>
            <h3 className="farmer-modal-title">Second submission for today</h3>
            <p className="farmer-modal-desc">
              You have already submitted today's farm report once. You are allowed one additional submission today. Please continue only if you need to submit the second report.
            </p>
            <div className="farmer-modal-tiles" style={{ display: 'flex', gap: '10px', marginTop: '20px', flexDirection: 'column' }}>
              <button type="button" className="btn btn--primary" style={{ width: '100%', padding: '14px', borderRadius: '8px' }} onClick={handleConfirmCorrection}>
                Continue to Second Submission
              </button>
              <button type="button" className="btn btn--outline" style={{ width: '100%', padding: '14px', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'transparent' }} onClick={() => setShowDisclaimerModal(false)}>
                {t('common.cancel', 'Cancel')}
              </button>
            </div>
          </div>
        </div>
      )};
content = content.replace(modalRegex, modalsNew);

fs.writeFileSync('frontend/src/pages/FarmerFormPage.tsx', content, 'utf8');
