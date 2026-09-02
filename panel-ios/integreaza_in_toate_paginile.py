from pathlib import Path

SCRIPT_TAG = '    <script src="js/support.js"></script>\n'
ROOT = Path(__file__).resolve().parent

updated = []
skipped = []

for html_file in ROOT.glob('*.html'):
    content = html_file.read_text(encoding='utf-8')
    if 'js/support.js' in content:
        skipped.append(html_file.name)
        continue
    if '</body>' not in content:
        skipped.append(html_file.name)
        continue
    html_file.write_text(content.replace('</body>', SCRIPT_TAG + '</body>'), encoding='utf-8')
    updated.append(html_file.name)

print('Pagini actualizate:')
for name in updated:
    print(f'  + {name}')

if skipped:
    print('\nPagini nemodificate/deja configurate:')
    for name in skipped:
        print(f'  - {name}')
