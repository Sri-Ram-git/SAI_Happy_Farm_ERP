import re

with open('backend/src/validators/businessRules.test.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1
content = content.replace('''      expect(() =>
      validateDailyReportBusinessRules({
        ...validInput,
        eggsProduced: 4750,
      }),''', '''      expect(() =>
      validateDailyReportBusinessRules({
        ...validInput,
        eggsProduced: 4750,
        selectionEggs: 4750,
      }),''')

# Fix 2
content = content.replace('''      expect(() =>
      validateDailyReportBusinessRules({
        ...validInput,
        damagedEggs: 5,
        floorEggs: 6,
      }),''', '''      expect(() =>
      validateDailyReportBusinessRules({
        ...validInput,
        damagedEggs: 5,
        floorEggs: 6,
        selectionEggs: 4489, # 4489 + 5 + 6 = 4500
      }),''')

with open('backend/src/validators/businessRules.test.ts', 'w', encoding='utf-8') as f:
    f.write(content)
