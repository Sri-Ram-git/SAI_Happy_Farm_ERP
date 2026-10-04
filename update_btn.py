import re

with open('frontend/src/pages/FarmerFormPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace offline button
offline_btn = r'''<button className="btn btn--primary btn--full" style=\{\{ marginTop: 20 \}\} onClick=\{handleStartCorrection\}>\s*\{t\('farmer\.submitCorrection'\)\}\s*</button>'''
offline_new = r'''{(!todayReport || (todayReport.submissionVersion ?? 1) < 2) && (
              <button className="btn btn--primary btn--full" style={{ marginTop: 20 }} onClick={handleStartCorrection}>
                {t('farmer.submitCorrection')}
              </button>
            )}'''
content = re.sub(offline_btn, offline_new, content)

# Replace success messages
success_msg = r'''<p>\{t\('farmer\.successMessage'\)\}</p>\s*<p className="text-muted">\{t\('common\.date'\)'''
success_new = r'''<p>
              {todayReport && todayReport.submissionVersion >= 2 
                ? t('farmer.correctionSuccessMsg', 'Correction submitted successfully.') 
                : t('farmer.successMessage')}
            </p>
            <p className="text-muted">{t('common.date')'''
content = re.sub(success_msg, success_new, content)

with open('frontend/src/pages/FarmerFormPage.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
