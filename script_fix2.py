import re

with open('frontend/src/pages/FarmerFormPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

parts = content.split("  const renderModals = () => (")
if len(parts) == 3:
    # First part is up to the first bad injection.
    # Second part is the bad injection body up to '  if (submittedOffline) {'
    # Third part is the rest of the file
    first_part = parts[0]
    second_part = parts[1]
    
    # We want to remove the bad injection body entirely and restore what was there.
    # What was there? Just if (submittedOffline) { inside syncPendingSubmissions.
    # Let's find if (submittedOffline) { inside second_part
    idx = second_part.find("  if (submittedOffline) {")
    rest_of_second_part = second_part[idx:]
    
    content = first_part + rest_of_second_part + "  const renderModals = () => (" + parts[2]

with open('frontend/src/pages/FarmerFormPage.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
