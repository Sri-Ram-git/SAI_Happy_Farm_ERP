import re

with open('backend/src/validators/businessRules.test.ts', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('''  it('should accept valid non-negative integer damagedEggs and floorEggs', () => {
    expect(() =>
      validateDailyReportBusinessRules({
        ...validInput,
        damagedEggs: 12,
        floorEggs: 6,
      }),''', '''  it('should accept valid non-negative integer damagedEggs and floorEggs', () => {
    expect(() =>
      validateDailyReportBusinessRules({
        ...validInput,
        damagedEggs: 12,
        floorEggs: 6,
        selectionEggs: 4482,
      }),''')

with open('backend/src/validators/businessRules.test.ts', 'w', encoding='utf-8') as f:
    f.write(content)
