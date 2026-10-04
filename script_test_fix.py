import re

with open('backend/src/validators/businessRules.test.ts', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("selectionEggs: 100,", "selectionEggs: 4500,\n    damagedEggs: 0,\n    floorEggs: 0,")

with open('backend/src/validators/businessRules.test.ts', 'w', encoding='utf-8') as f:
    f.write(content)
