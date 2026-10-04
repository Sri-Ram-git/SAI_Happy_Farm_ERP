import re

with open('firestore.rules', 'r', encoding='utf-8') as f:
    content = f.read()

# Insert the notifications rule just before the closing } of match /databases/...
new_rule = '''
    // Notifications Collection
    match /notifications/{notificationId} {
      allow create: if isUserActive();
      allow read: if isUserActive() && getUserData().role in ['admin', 'supervisor'];
      allow update: if isUserActive() && getUserData().role in ['admin', 'supervisor']
                    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['readBy']);
      allow delete: if isAdmin();
    }
  }
}'''

content = re.sub(r'  \}\s*\}\s*$', new_rule, content)

with open('firestore.rules', 'w', encoding='utf-8') as f:
    f.write(content)
