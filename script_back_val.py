import re

with open('backend/src/validators/report.validator.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the old constraint
old_rule = r'''  if \(input\.selectionEggs > input\.eggsProduced\) \{
    fields\['selectionEggs'\] = 'Selection eggs cannot exceed egg production';
  \}'''

# Wait, we need to enforce the NEW constraint: Egg Production = Selection + Damaged + Floor
new_rule = r'''  const se = input.selectionEggs || 0;
  const de = input.damagedEggs || 0;
  const fe = input.floorEggs || 0;
  if (se + de + fe !== input.eggsProduced) {
    fields['eggsProduced'] = 'Egg Production must equal Selection Eggs + Damaged Eggs + Floor Eggs.';
  }'''

content = re.sub(old_rule, new_rule, content)

with open('backend/src/validators/report.validator.ts', 'w', encoding='utf-8') as f:
    f.write(content)
