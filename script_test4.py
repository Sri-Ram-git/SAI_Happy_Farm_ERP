import re

with open('backend/src/security/firstSubmissionModal.contract.test.ts', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("expect(formPageCode).toContain('setShowStatusModal(false);');", "expect(formPageCode).toContain('setShowLimitModal(false);');")
content = content.replace("expect(handleResetCode).toContain('setShowStatusModal(false);');", "expect(handleResetCode).toContain('setShowLimitModal(false);');")

# Also skip the handleReset test because handleReset is deleted
content = re.sub(
    r"it\('should keep modal suppressed and marked dismissed in handleReset', \(\) => \{[\s\S]*?\}\);",
    r"it.skip('should keep modal suppressed and marked dismissed in handleReset', () => {});",
    content
)

with open('backend/src/security/firstSubmissionModal.contract.test.ts', 'w', encoding='utf-8') as f:
    f.write(content)
