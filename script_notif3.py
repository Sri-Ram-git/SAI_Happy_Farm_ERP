import re

with open('frontend/src/styles.css', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("width: min(calc(100vw - 24px), 400px);\n  background: var(--white);", "width: min(calc(100vw - 24px), 400px);\n  background: var(--white);\n  z-index: 1000;")

with open('frontend/src/styles.css', 'w', encoding='utf-8') as f:
    f.write(content)
