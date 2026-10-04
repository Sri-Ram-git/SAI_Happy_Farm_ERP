import re

with open('backend/src/validators/businessRules.test.ts', 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(r'eggsProduced: 4750,\s*\}\),', r'eggsProduced: 4750,\n        selectionEggs: 4750,\n        damagedEggs: 0,\n        floorEggs: 0,\n      }),', content)

content = re.sub(r'damagedEggs: 5,\s*floorEggs: 6,\s*\}\),', r'damagedEggs: 5,\n        floorEggs: 6,\n        selectionEggs: 4489,\n      }),', content)

with open('backend/src/validators/businessRules.test.ts', 'w', encoding='utf-8') as f:
    f.write(content)
