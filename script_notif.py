import re

with open('frontend/src/services/notificationService.ts', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("createdAt: new Date().toISOString(),\n    }, { merge: true });", "createdAt: new Date().toISOString(),\n      readBy: [],\n    }, { merge: true });")

with open('frontend/src/services/notificationService.ts', 'w', encoding='utf-8') as f:
    f.write(content)
