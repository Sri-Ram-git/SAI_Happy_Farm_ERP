import re

with open('backend/src/validators/businessRules.test.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# I will catch the error and log it so I know what failed
test_body = r'''  it\('should accept valid non-negative integer damagedEggs and floorEggs', \(\) => \{
    expect\(\(\) =>
      validateDailyReportBusinessRules\(\{
        \.\.\.validInput,
        damagedEggs: 5,
        floorEggs: 6,
        selectionEggs: 4489,
      \}\),
    \)\.not\.toThrow\(\);
  \}\);'''

new_test_body = '''  it('should accept valid non-negative integer damagedEggs and floorEggs', () => {
    try {
      validateDailyReportBusinessRules({
        ...validInput,
        damagedEggs: 5,
        floorEggs: 6,
        selectionEggs: 4489,
      });
    } catch (err: any) {
      console.log('TEST FAILED WITH:', err.fields);
      throw err;
    }
  });'''

content = re.sub(test_body, new_test_body, content)

with open('backend/src/validators/businessRules.test.ts', 'w', encoding='utf-8') as f:
    f.write(content)
