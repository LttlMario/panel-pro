import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'web-src');
const output = join(root, 'www');
const sourceDirectories = ['css', 'img', 'js', 'supabase', 'minigames'];
const androidRuntime = join(root, 'js', 'android-oauth-runtime.js');

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const directory of sourceDirectories) {
  await cp(join(source, directory), join(output, directory), { recursive: true });
}

await cp(androidRuntime, join(output, 'js', 'android-oauth-runtime.js'));

const sourceEntries = await readdir(source, { withFileTypes: true });
for (const entry of sourceEntries) {
  if (!entry.isFile() || !entry.name.endsWith('.html')) continue;

  const sourcePath = join(source, entry.name);
  const destinationPath = join(output, entry.name);
  let html = await readFile(sourcePath, 'utf8');
  if (!html.includes('android-oauth-runtime.js')) {
    html = html.replace('</head>', '    <script src="js/android-oauth-runtime.js"></script>\n</head>');
  }
  await writeFile(destinationPath, html, 'utf8');
}

console.log(`Aplicatia Android a fost generata din ${relative(root, source)}.`);
