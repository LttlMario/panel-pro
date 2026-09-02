from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
EXCLUDED = {"changelog.html", "developer.html", "thank-you.html"}

HEAD_SNIPPET = """    <link rel="stylesheet" href="css/global-footer.css">
    <script src="js/project-version.js"></script>
"""
BODY_SNIPPET = """    <script src="js/global-footer.js"></script>
"""

def remove_legacy_support(html):
    patterns = [
        r'<footer[^>]*(?:support|sustine|susține)[\s\S]*?</footer>',
        r'<div[^>]+id=["\']support-modal["\'][\s\S]*?</div>\s*</div>',
        r'<button[^>]+id=["\']support-project-btn["\'][\s\S]*?</button>',
        r'<script[^>]+src=["\'][^"\']*support\.js["\'][^>]*></script>',
    ]
    for pattern in patterns:
        html = re.sub(pattern, "", html, flags=re.I)
    return html

changed = []
for page in ROOT.glob("*.html"):
    if page.name in EXCLUDED:
        continue

    html = page.read_text(encoding="utf-8")
    original = html
    html = remove_legacy_support(html)

    if "css/global-footer.css" not in html:
        html = html.replace("</head>", HEAD_SNIPPET + "</head>", 1)

    if "js/project-version.js" not in html:
        html = html.replace("</head>", '    <script src="js/project-version.js"></script>\n</head>', 1)

    if "js/global-footer.js" not in html:
        html = html.replace("</body>", BODY_SNIPPET + "</body>", 1)

    if html != original:
        page.write_text(html, encoding="utf-8")
        changed.append(page.name)

print("Pagini actualizate:")
for name in changed:
    print(" -", name)
print(f"Total: {len(changed)}")
