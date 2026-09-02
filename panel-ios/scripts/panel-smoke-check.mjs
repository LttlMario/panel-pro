import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const failures = [];

const read = (path) => readFile(join(root, path), 'utf8');
const fail = (message) => failures.push(message);

for (const group of [
  ['js/craft-mechanic-recipes.js', 'panel-ios/js/craft-mechanic-recipes.js', 'panel-android/web-src/js/craft-mechanic-recipes.js'],
  ['calculator.html', 'panel-ios/calculator.html', 'panel-android/web-src/calculator.html'],
  ['calculatorilegal.html', 'panel-ios/calculatorilegal.html', 'panel-android/web-src/calculatorilegal.html'],
]) {
  const contents = await Promise.all(group.map(read));
  if (!contents.every((value) => value === contents[0])) fail(`Paritate ruptă: ${group.join(' | ')}`);
}

for (const path of ['descarca-android.html', 'panel-ios/descarca-android.html', 'panel-android/web-src/descarca-android.html']) {
  const content = await read(path);
  if (/releases\/download\/v1\.0\.2|Versiunea 1\.0\.2/.test(content)) fail(`Fallback Android vechi în ${path}`);
}

const ignoredDirectories = new Set(['.git', 'node_modules', 'panel-project-versions', 'android', 'www', '.gradle-user-home', 'build', 'dist']);
const allowedExtensions = new Set(['.html', '.js', '.ts', '.css', '.json']);
const walk = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (allowedExtensions.has(entry.name.slice(entry.name.lastIndexOf('.')).toLowerCase())) files.push(path);
  }
  return files;
};

for (const path of await walk(root)) {
  const content = await readFile(path, 'utf8');
  const displayPath = relative(root, path);
  if (/https:\/\/discord\.com\/api\/webhooks\/\d+\//i.test(content)) fail(`Webhook cu token în ${displayPath}`);
  if (/\uFFFD/.test(content)) fail(`Caracter de înlocuire corupt în ${displayPath}`);
}

if (!/operations/.test(await read('supabase/functions/_shared/package-features.ts'))) fail('Pachetul Operations lipsește din politica server-side');
if (failures.length) {
  console.error(failures.map((item) => `FAIL: ${item}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log('Panel smoke check: OK');
}
