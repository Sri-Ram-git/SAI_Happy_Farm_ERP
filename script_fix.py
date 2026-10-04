import re

with open('frontend/src/pages/FarmerFormPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# The first renderModals definition is wrongly placed inside useEffect
bad_def = r'''          if \(synced > 0\) \{
            console\.log\(\[FarmerForm\] Successfully synced \$\{synced\} pending report\(s\)\.\);
          
  const renderModals = \(\) => \(
    <>
      \{showLimitModal && \([\s\S]*?</>\n  \);\n\n  if \(submittedOffline\) \{'''

content = re.sub(bad_def, r'''          if (synced > 0) {
            console.log([FarmerForm] Successfully synced  pending report(s).);
            if (submittedOffline) {''', content)

with open('frontend/src/pages/FarmerFormPage.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
