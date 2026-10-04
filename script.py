import re

with open('frontend/src/pages/FarmerFormPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove ReportStatusModal import
content = re.sub(r"import \{ ReportStatusModal \} from '\.\./components/ReportStatusModal';\n", "", content)

# 2. Modals state
content = re.sub(
    r"const \[showStatusModal, setShowStatusModal\] = useState<boolean>\(false\);",
    "const [showLimitModal, setShowLimitModal] = useState<boolean>(false);\n  const [showDisclaimerModal, setShowDisclaimerModal] = useState<boolean>(false);",
    content
)
content = content.replace("setShowStatusModal(false);", "setShowLimitModal(false);\n    setShowDisclaimerModal(false);")

# 3. isInitial fix
isInitialOld = r"if \(\s*isInitial &&\s*rep &&\s*rep\.submissionMethod !== 'HISTORICAL_IMPORT' &&\s*\(rep\.submissionVersion != null \|\| rep\.status\) &&\s*!hasSubmittedInSessionRef\.current &&\s*!hasDismissedModal\s*\) \{\s*setShowStatusModal\(true\);\s*\}"
isInitialNew = '''if (
        isInitial &&
        rep &&
        rep.submissionMethod !== 'HISTORICAL_IMPORT' &&
        (rep.submissionVersion != null || rep.status) &&
        !hasSubmittedInSessionRef.current
      ) {
        setSubmitted(true);
      }'''
content = re.sub(isInitialOld, isInitialNew, content)

# 4. handleStartCorrection instead of handleReset
handleResetOld = r"const handleReset = \(\) => \{[\s\S]*?setHasDismissedModal\(true\);\n  \};"
handleResetNew = '''const handleStartCorrection = () => {
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
    setShowLimitModal(false);
    setHasDismissedModal(true);
  };
  
  const handleReset = () => {
    if (userProfile?.uid && farmId) {
      clearFarmerDraft(userProfile.uid, farmId, reportDate);
    }
    setData(INITIAL_FARM_FORM_DATA);
    setErrors({});
    setStep(0);
    setSubmitted(false);
    setSubmittedOffline(false);
    setSubmitError('');
    setShowLimitModal(false);
    setShowDisclaimerModal(false);
    setHasDismissedModal(true);
  };'''
content = re.sub(handleResetOld, handleResetNew, content)

# 5. Modify button in success summaries
buttonOld = r'<button className="btn btn--primary btn--full" style=\{\{ marginTop: 20 \}\} onClick=\{handleReset\}>\s*\{t\(\'common\.save\'\)\}\s*</button>'
buttonNew = '''<button className="btn btn--primary btn--full" style={{ marginTop: 20 }} onClick={handleStartCorrection}>
              {t('farmer.submitCorrection')}
            </button>'''
content = re.sub(buttonOld, buttonNew, content)

# 6. Render modals component
modalsFunc = '''
  const renderModals = () => (
    <>
      {showLimitModal && (
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
      )}
    </>
  );
'''

# 7. Insert renderModals before submittedOffline
content = content.replace("  if (submittedOffline) {", modalsFunc + "\n  if (submittedOffline) {")

# 8. Add {renderModals()} to the early returns
content = re.sub(
    r'(</div>\s*</main>\s*</div>\s*\);\s*\}\s*if \(submitted\) {)',
    r'{renderModals()}\n        \1',
    content
)

content = re.sub(
    r'(</div>\s*</main>\s*</div>\s*\);\s*\}\s*const displayOpeningBirds)',
    r'{renderModals()}\n        \1',
    content
)

# 9. Add {renderModals()} at the bottom and remove ReportStatusModal
content = re.sub(
    r'<ReportStatusModal[\s\S]*?/>',
    r'{renderModals()}',
    content
)

with open('frontend/src/pages/FarmerFormPage.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
