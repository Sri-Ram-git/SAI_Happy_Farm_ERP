import re

with open('frontend/src/pages/FarmerFormPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove setData(INITIAL_FARM_FORM_DATA); from handleConfirmCorrection
old_handleConfirmCorrection = r'''  const handleConfirmCorrection = \(\) => \{
    setShowDisclaimerModal\(false\);
    if \(userProfile\?\.uid && farmId\) \{
      clearFarmerDraft\(userProfile\.uid, farmId, reportDate\);
    \}
    setData\(INITIAL_FARM_FORM_DATA\);
    setErrors\(\{\}\);
    setStep\(0\);
    setSubmitted\(false\);
    setSubmittedOffline\(false\);
    setSubmitError\(''\);
    setShowLimitModal\(false\);
    setHasDismissedModal\(true\);
  \};'''

new_handleConfirmCorrection = '''  const handleConfirmCorrection = () => {
    setShowDisclaimerModal(false);
    if (userProfile?.uid && farmId) {
      clearFarmerDraft(userProfile.uid, farmId, reportDate);
    }
    setErrors({});
    setStep(0);
    setSubmitted(false);
    setSubmittedOffline(false);
    setSubmitError('');
    setShowLimitModal(false);
    setHasDismissedModal(true);
  };'''

content = re.sub(old_handleConfirmCorrection, new_handleConfirmCorrection, content)

# 2. Remove handleReset entirely
old_handleReset = r'''\s*const handleReset = \(\) => \{
    if \(userProfile\?\.uid && farmId\) \{
      clearFarmerDraft\(userProfile\.uid, farmId, reportDate\);
    \}
    setData\(INITIAL_FARM_FORM_DATA\);
    setErrors\(\{\}\);
    setStep\(0\);
    setSubmitted\(false\);
    setSubmittedOffline\(false\);
    setSubmitError\(''\);
    setShowLimitModal\(false\);
    setShowDisclaimerModal\(false\);
    setHasDismissedModal\(true\);
  \};'''

content = re.sub(old_handleReset, '', content)

with open('frontend/src/pages/FarmerFormPage.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
