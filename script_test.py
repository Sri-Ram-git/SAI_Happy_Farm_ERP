import re

with open('backend/src/validators/businessRules.test.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the test
old_test = r'''  it\('should reject selectionEggs > eggsProduced', \(\) => \{
    expect\(\(\) =>
      validateDailyReportBusinessRules\(\{
        \.\.\.validInput,
        selectionEggs: 5000,
      \}\),
    \)\.toThrow\(\);
  \}\);'''

new_test = '''  it('should reject when eggsProduced !== selectionEggs + damagedEggs + floorEggs', () => {
    expect(() =>
      validateDailyReportBusinessRules({
        ...validInput,
        eggsProduced: 4500,
        selectionEggs: 4000,
        damagedEggs: 100,
        floorEggs: 0,
      }),
    ).toThrow();
  });

  it('should allow when eggsProduced === selectionEggs + damagedEggs + floorEggs', () => {
    expect(() =>
      validateDailyReportBusinessRules({
        ...validInput,
        eggsProduced: 4500,
        selectionEggs: 4000,
        damagedEggs: 400,
        floorEggs: 100,
      }),
    ).not.toThrow();
  });'''

content = re.sub(old_test, new_test, content)

with open('backend/src/validators/businessRules.test.ts', 'w', encoding='utf-8') as f:
    f.write(content)
