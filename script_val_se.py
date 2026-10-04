import re

with open('frontend/src/utils/formValidation.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the se > ep rule
old_rule = r'''      \} else if \(!isNaN\(ep\) && ep >= 0 && se > ep\) \{
        errors\.selectionEggs = tr\('validation\.exceedsEggsProduced', 'Cannot exceed eggs produced'\);
      \}'''

content = re.sub(old_rule, '      }', content)

with open('frontend/src/utils/formValidation.ts', 'w', encoding='utf-8') as f:
    f.write(content)
