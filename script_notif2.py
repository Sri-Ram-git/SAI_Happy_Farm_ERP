import re

with open('frontend/src/services/notificationService.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Add readBy: [] to any object literal right before }, { merge: true });
content = re.sub(r'createdAt: new Date\(\)\.toISOString\(\),\s*\}, \{ merge: true \}\);\s*', r'createdAt: new Date().toISOString(),\n      readBy: [],\n    }, { merge: true });\n    ', content)

with open('frontend/src/services/notificationService.ts', 'w', encoding='utf-8') as f:
    f.write(content)
