import re

with open('frontend/src/utils/formValidation.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the block that handles the old constraint and floorEggs parsing
old_block = r'''      // Production, Selection, and Damaged Eggs Constraint:
      // Selection Eggs \+ Damaged Eggs must never exceed Egg Production
      if \(!errors\.eggsProduced && !errors\.selectionEggs && !errors\.damagedEggs\) \{
        if \(se \+ de > ep\) \{
          errors\.selectionEggs = tr\(
            'validation\.selectionDamagedExceeds',
            'Selection \+ Damaged eggs cannot exceed Egg Production'
          \);
          if \(data\.damagedEggs !== '' && de > 0\) \{
            errors\.damagedEggs = tr\(
              'validation\.selectionDamagedExceeds',
              'Selection \+ Damaged eggs cannot exceed Egg Production'
            \);
          \}
        \}
      \}

      if \(data\.floorEggs !== ''\) \{
        const fe = Number\(data\.floorEggs\);
        if \(isNaN\(fe\) \|\| !Number\.isInteger\(fe\) \|\| fe < 0\) \{
          errors\.floorEggs = tr\('validation\.invalidWholeNumber', 'Enter a valid non-negative whole number'\);
        \}
      \}'''

new_block = '''      let fe = 0;
      if (data.floorEggs !== '') {
        const parsedFe = Number(data.floorEggs);
        if (isNaN(parsedFe) || !Number.isInteger(parsedFe) || parsedFe < 0) {
          errors.floorEggs = tr('validation.invalidWholeNumber', 'Enter a valid non-negative whole number');
        } else {
          fe = parsedFe;
        }
      }

      // Production, Selection, Damaged, and Floor Eggs Constraint:
      // Egg Production must equal Selection Eggs + Damaged Eggs + Floor Eggs
      if (!errors.eggsProduced && !errors.selectionEggs && !errors.damagedEggs && !errors.floorEggs) {
        if (se + de + fe !== ep) {
          errors.eggsProduced = tr(
            'validation.eggProductionMismatch',
            'Egg Production must equal Selection Eggs + Damaged Eggs + Floor Eggs.'
          );
        }
      }'''

content = re.sub(old_block, new_block, content)

with open('frontend/src/utils/formValidation.ts', 'w', encoding='utf-8') as f:
    f.write(content)
